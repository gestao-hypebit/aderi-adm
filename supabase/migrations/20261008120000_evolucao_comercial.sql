-- ============================================================
-- Evolução comercial: clientes, visitas e cotações
--  · configurações (margem mínima, validade, follow-up)
--  · clientes: inscrição do produtor, localização, responsável, contatos, aviso de duplicado
--  · visitas: check-in/check-out, relatório técnico (checklist), retorno, link público
--  · cotações: validade, envio, motivo de perda, vínculo com visita, PTAX automática,
--    link público, aprovação de margem mínima, acompanhamento do pedido
-- Rollback: supabase/rollback/20261008120000_evolucao_comercial_down.sql
-- ============================================================

-- ── 1. Configurações gerais (linha única) ──────────────────
CREATE TABLE public.configuracoes (
  id                    int         PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  margem_minima         numeric     NOT NULL DEFAULT 0,      -- margem líquida mínima sem aprovação (0,02 = 2%)
  validade_cotacao_dias int         NOT NULL DEFAULT 7,
  dias_followup         int         NOT NULL DEFAULT 3,      -- "enviada há X dias sem resposta"
  updated_at            timestamptz DEFAULT now()
);
INSERT INTO public.configuracoes (id) VALUES (1);

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_configuracoes" ON public.configuracoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_update_configuracoes" ON public.configuracoes FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── 2. Clientes ────────────────────────────────────────────
ALTER TABLE public.clientes
  ADD COLUMN inscricao_produtor text,
  ADD COLUMN latitude           double precision,
  ADD COLUMN longitude          double precision,
  ADD COLUMN responsavel_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

UPDATE public.clientes SET responsavel_id = criado_por WHERE responsavel_id IS NULL;
ALTER TABLE public.clientes ALTER COLUMN responsavel_id SET DEFAULT auth.uid();
CREATE INDEX clientes_responsavel_idx ON public.clientes (responsavel_id);

-- Responsável também enxerga e edita o cliente
DROP POLICY IF EXISTS "select_clientes" ON public.clientes;
CREATE POLICY "select_clientes" ON public.clientes
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR criado_por = auth.uid()
    OR responsavel_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.visitas v WHERE v.cliente_id = clientes.id AND v.funcionario_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_clientes" ON public.clientes;
CREATE POLICY "update_clientes" ON public.clientes
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR criado_por = auth.uid()
    OR responsavel_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.visitas v WHERE v.cliente_id = clientes.id AND v.funcionario_id = auth.uid())
  )
  WITH CHECK (true);

-- Só admin define/transfere o responsável; consultor que cadastra vira o responsável
CREATE OR REPLACE FUNCTION public.proteger_responsavel_cliente()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.responsavel_id := auth.uid();
  ELSIF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id THEN
    NEW.responsavel_id := OLD.responsavel_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER proteger_responsavel_cliente
  BEFORE INSERT OR UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.proteger_responsavel_cliente();

-- Aviso de cliente duplicado pelo CPF/CNPJ, mesmo fora da carteira de quem consulta.
-- Devolve só o mínimo (id, nome, responsável).
CREATE OR REPLACE FUNCTION public.cliente_por_documento(doc text, ignorar uuid DEFAULT NULL)
  RETURNS TABLE (id uuid, nome text, nome_fazenda text, responsavel text)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT c.id, c.nome, c.nome_fazenda, p.nome_completo
  FROM public.clientes c
  LEFT JOIN public.profiles p ON p.id = c.responsavel_id
  WHERE length(regexp_replace(coalesce(doc, ''), '\D', '', 'g')) >= 11
    AND regexp_replace(coalesce(c.cpf_cnpj, ''), '\D', '', 'g') = regexp_replace(doc, '\D', '', 'g')
    AND (ignorar IS NULL OR c.id <> ignorar)
  LIMIT 5;
$$;
REVOKE ALL ON FUNCTION public.cliente_por_documento(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cliente_por_documento(text, uuid) TO authenticated;

-- Contatos do cliente (dono, gerente, agrônomo...)
CREATE TABLE public.cliente_contatos (
  id         uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid        NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nome       text        NOT NULL,
  funcao     text,
  telefone   text,
  email      text,
  principal  boolean     NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX cliente_contatos_cliente_idx ON public.cliente_contatos (cliente_id);
ALTER TABLE public.cliente_contatos ENABLE ROW LEVEL SECURITY;
-- acesso segue o acesso ao cliente (a subconsulta respeita o RLS de clientes)
CREATE POLICY "contatos_do_cliente" ON public.cliente_contatos
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id));

-- ── 3. Visitas ─────────────────────────────────────────────
ALTER TABLE public.visitas
  ADD COLUMN checkin_em       timestamptz,
  ADD COLUMN checkin_lat      double precision,
  ADD COLUMN checkin_lng      double precision,
  ADD COLUMN checkout_em      timestamptz,
  ADD COLUMN checkout_lat     double precision,
  ADD COLUMN checkout_lng     double precision,
  ADD COLUMN checklist        jsonb,
  ADD COLUMN visita_origem_id uuid REFERENCES public.visitas(id) ON DELETE SET NULL,
  ADD COLUMN token_publico    uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX visitas_token_publico_idx ON public.visitas (token_publico);

-- Relatório da visita para o produtor (link sem login): só dados da visita, sem nada interno
CREATE OR REPLACE FUNCTION public.visita_publica(token uuid)
  RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'data_visita', v.data_visita, 'hora_visita', v.hora_visita, 'status', v.status,
    'motivo', CASE WHEN v.motivo_visita = 'Outros' THEN coalesce(v.motivo_outro, 'Outros') ELSE v.motivo_visita END,
    'descricao', v.descricao, 'recomendacoes', v.recomendacoes, 'observacao', v.observacao_finalizacao,
    'checklist', v.checklist, 'checkin_em', v.checkin_em, 'checkout_em', v.checkout_em, 'proximo_contato', v.proximo_contato,
    'cliente', json_build_object('nome', c.nome, 'fazenda', c.nome_fazenda, 'cidade', c.cidade, 'estado', c.estado),
    'consultor', json_build_object('nome', p.nome_completo, 'telefone', p.telefone),
    'fotos', coalesce((SELECT json_agg(json_build_object('url', f.url, 'legenda', f.legenda) ORDER BY f.created_at)
                       FROM public.visita_fotos f WHERE f.visita_id = v.id), '[]'::json)
  )
  FROM public.visitas v
  JOIN public.clientes c ON c.id = v.cliente_id
  LEFT JOIN public.profiles p ON p.id = v.funcionario_id
  WHERE v.token_publico = token;
$$;
REVOKE ALL ON FUNCTION public.visita_publica(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.visita_publica(uuid) TO anon, authenticated;

-- ── 4. Cotações ────────────────────────────────────────────
ALTER TABLE public.cotacoes
  ADD COLUMN validade         date,
  ADD COLUMN enviada_em       timestamptz,
  ADD COLUMN motivo_perda     text,
  ADD COLUMN visita_id        uuid REFERENCES public.visitas(id) ON DELETE SET NULL,
  ADD COLUMN ptax_modo        text NOT NULL DEFAULT 'manual' CHECK (ptax_modo IN ('manual', 'auto')),
  ADD COLUMN ptax_data        date,
  ADD COLUMN token_publico    uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN aprovacao_status text CHECK (aprovacao_status IN ('pendente', 'aprovada', 'reprovada')),
  ADD COLUMN aprovacao_obs    text,
  ADD COLUMN aprovacao_margem numeric,
  ADD COLUMN aprovado_por     uuid REFERENCES public.profiles(id),
  ADD COLUMN aprovado_em      timestamptz,
  ADD COLUMN pedido_status    text CHECK (pedido_status IN ('aguardando', 'faturado', 'entregue', 'cancelado')),
  ADD COLUMN nota_fiscal      text,
  ADD COLUMN faturado_em      date,
  ADD COLUMN entregue_em      date,
  ADD COLUMN pagamento_status text CHECK (pagamento_status IN ('em_aberto', 'parcial', 'pago')),
  ADD COLUMN pago_em          date,
  ADD COLUMN pedido_obs       text;
CREATE UNIQUE INDEX cotacoes_token_publico_idx ON public.cotacoes (token_publico);
CREATE INDEX cotacoes_visita_idx ON public.cotacoes (visita_id);
UPDATE public.cotacoes SET validade = (created_at::date + 7) WHERE validade IS NULL;
UPDATE public.cotacoes SET enviada_em = updated_at WHERE status IN ('enviada', 'aprovada', 'perdida') AND enviada_em IS NULL;

-- Menor margem líquida entre os itens com preço (mesma fórmula de lib/cotacao.ts, coluna V)
CREATE OR REPLACE FUNCTION public.margem_liquida_item(
  preco_cliente numeric, preco_tabela numeric, desconto numeric, frete numeric, margem numeric, comissao numeric,
  data_inicial date, data_final date, ptax numeric, juros_mes numeric, icms numeric, ir numeric)
  RETURNS numeric LANGUAGE sql IMMUTABLE
AS $$
  WITH b AS (
    SELECT preco_cliente AS r, (preco_tabela - desconto) * ptax AS h, frete AS i, comissao AS com,
           1 - (margem + comissao) AS div, coalesce(data_final - data_inicial, 0) AS dias
  ), o AS (
    SELECT b.*, CASE WHEN b.div <> 0 THEN (b.h + b.i) / b.div ELSE 0 END * b.dias * (juros_mes / 30) AS fin FROM b
  )
  SELECT CASE WHEN r > 0 THEN (r - h - i - fin - (r * icms - h * icms) - (r - h - i) * ir - r * com) / r END FROM o;
$$;

CREATE OR REPLACE FUNCTION public.cotacao_margem_minima(cot uuid)
  RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT min(public.margem_liquida_item(i.preco_cliente, i.preco_tabela, i.desconto, i.frete, i.margem, i.comissao,
                                        i.data_inicial, i.data_final, c.ptax, c.juros_mes, c.aliquota_icms, c.aliquota_ir))
  FROM public.cotacao_itens i JOIN public.cotacoes c ON c.id = i.cotacao_id
  WHERE i.cotacao_id = cot AND i.preco_cliente > 0;
$$;

-- A cotação está liberada se a menor margem respeita o mínimo, ou se o admin aprovou e o preço não piorou
CREATE OR REPLACE FUNCTION public.cotacao_liberada(cot uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT coalesce(m.minima, 1) >= cfg.margem_minima - 0.000001
      OR (c.aprovacao_status = 'aprovada' AND coalesce(m.minima, 1) >= coalesce(c.aprovacao_margem, 1) - 0.000001)
  FROM public.cotacoes c
  CROSS JOIN public.configuracoes cfg
  CROSS JOIN LATERAL (SELECT public.cotacao_margem_minima(c.id) AS minima) m
  WHERE c.id = cot;
$$;
GRANT EXECUTE ON FUNCTION public.cotacao_margem_minima(uuid), public.cotacao_liberada(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cotacoes_regras()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  eh_admin boolean := auth.uid() IS NULL OR public.is_admin();
  mudou_status boolean := TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status;
BEGIN
  IF NEW.status = 'enviada' AND mudou_status AND NEW.enviada_em IS NULL THEN
    NEW.enviada_em := now();
  END IF;

  IF NEW.status = 'perdida' AND coalesce(trim(NEW.motivo_perda), '') = '' THEN
    RAISE EXCEPTION 'Informe o motivo da perda da cotação';
  END IF;

  IF NEW.status = 'aprovada' AND mudou_status AND NEW.pedido_status IS NULL THEN
    NEW.pedido_status := 'aguardando';
    NEW.pagamento_status := coalesce(NEW.pagamento_status, 'em_aberto');
  END IF;

  IF NOT eh_admin THEN
    -- consultor só pode pedir aprovação (pendente) ou limpar; decisão é do admin
    IF TG_OP = 'INSERT' THEN
      IF NEW.aprovacao_status IN ('aprovada', 'reprovada') THEN NEW.aprovacao_status := NULL; END IF;
      NEW.aprovado_por := NULL; NEW.aprovado_em := NULL; NEW.aprovacao_margem := NULL;
    ELSE
      IF NEW.aprovacao_status IN ('aprovada', 'reprovada') AND NEW.aprovacao_status IS DISTINCT FROM OLD.aprovacao_status THEN
        NEW.aprovacao_status := OLD.aprovacao_status;
      END IF;
      -- pode voltar para "pendente" (pedir de novo, ex.: baixou o preço depois de aprovado)
      NEW.aprovado_por := OLD.aprovado_por; NEW.aprovado_em := OLD.aprovado_em; NEW.aprovacao_margem := OLD.aprovacao_margem;
    END IF;

    IF TG_OP = 'UPDATE' AND mudou_status AND NEW.status IN ('enviada', 'aprovada') AND NOT public.cotacao_liberada(NEW.id) THEN
      RAISE EXCEPTION 'Preço abaixo da margem mínima: solicite a aprovação do administrador antes de enviar';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER cotacoes_regras
  BEFORE INSERT OR UPDATE ON public.cotacoes
  FOR EACH ROW EXECUTE FUNCTION public.cotacoes_regras();

-- Itens salvos de uma vez (troca atômica) e conferidos depois: cotação já enviada/aprovada
-- não pode ficar abaixo da margem mínima sem aprovação.
CREATE OR REPLACE FUNCTION public.salvar_itens_cotacao(p_cotacao uuid, p_itens jsonb)
  RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public'
AS $$
DECLARE
  st text;
BEGIN
  SELECT status INTO st FROM public.cotacoes WHERE id = p_cotacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotação não encontrada'; END IF;

  DELETE FROM public.cotacao_itens WHERE cotacao_id = p_cotacao;
  INSERT INTO public.cotacao_itens (cotacao_id, ordem, produto_id, produto_nome, fornecedor, quantidade, unidade, preco_tabela,
                                    desconto, frete, data_inicial, data_final, margem, comissao, preco_cliente, vencimento)
  SELECT p_cotacao, x.ordem, x.produto_id, x.produto_nome, x.fornecedor, coalesce(x.quantidade, 0), x.unidade, coalesce(x.preco_tabela, 0),
         coalesce(x.desconto, 0), coalesce(x.frete, 0), x.data_inicial, x.data_final, coalesce(x.margem, 0), coalesce(x.comissao, 0),
         coalesce(x.preco_cliente, 0), x.vencimento
  FROM jsonb_to_recordset(p_itens) AS x(ordem int, produto_id uuid, produto_nome text, fornecedor text, quantidade numeric, unidade text,
       preco_tabela numeric, desconto numeric, frete numeric, data_inicial date, data_final date, margem numeric, comissao numeric,
       preco_cliente numeric, vencimento date);

  IF st IN ('enviada', 'aprovada') AND NOT public.is_admin() AND NOT public.cotacao_liberada(p_cotacao) THEN
    RAISE EXCEPTION 'Preço abaixo da margem mínima: volte a cotação para rascunho e solicite aprovação';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.salvar_itens_cotacao(uuid, jsonb) TO authenticated;

-- Orçamento para o cliente (link sem login): só preços de venda, nada de custo/margem
CREATE OR REPLACE FUNCTION public.orcamento_publico(token uuid)
  RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'numero', c.numero, 'created_at', c.created_at, 'validade', c.validade, 'status', c.status,
    'cliente_nome', c.cliente_nome, 'empresa_rural', c.empresa_rural, 'cidade', c.cidade, 'cpf_cnpj', c.cpf_cnpj,
    'inscricao_produtor', c.inscricao_produtor, 'contato', c.contato, 'observacoes_cliente', c.observacoes_cliente,
    'consultor', json_build_object('nome', p.nome_completo, 'telefone', p.telefone),
    'itens', coalesce((SELECT json_agg(json_build_object('produto', i.produto_nome, 'quantidade', i.quantidade, 'unidade', i.unidade,
                                                         'preco', i.preco_cliente, 'vencimento', coalesce(i.vencimento, i.data_final)) ORDER BY i.ordem)
                       FROM public.cotacao_itens i WHERE i.cotacao_id = c.id), '[]'::json)
  )
  FROM public.cotacoes c
  LEFT JOIN public.profiles p ON p.id = c.criado_por
  WHERE c.token_publico = token AND c.status IN ('enviada', 'aprovada');
$$;
REVOKE ALL ON FUNCTION public.orcamento_publico(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.orcamento_publico(uuid) TO anon, authenticated;

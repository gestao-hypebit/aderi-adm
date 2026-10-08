-- ============================================================
-- Cotações: novo status "efetivada" e cadastro rápido de produto
--  · "aprovada" passa a ser a aprovação da gestão (só admin marca)
--  · "efetivada" = o cliente fechou; é ela que gera o pedido
--  · as cotações que estavam "aprovada" (cliente fechou) viram "efetivada"
--  · produto digitado fora do cadastro é cadastrado automaticamente
-- Rollback: supabase/rollback/20261009090000_cotacao_efetivada_down.sql
-- ============================================================

-- ── 1. Status ──────────────────────────────────────────────
ALTER TABLE public.cotacoes DROP CONSTRAINT IF EXISTS cotacoes_status_check;
ALTER TABLE public.cotacoes ADD CONSTRAINT cotacoes_status_check
  CHECK (status IN ('rascunho', 'aprovada', 'enviada', 'efetivada', 'perdida'));

ALTER TABLE public.cotacoes ADD COLUMN efetivada_em timestamptz;

-- ── 2. Regras de status ────────────────────────────────────
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

  -- Cliente fechou: abre o pedido
  IF NEW.status = 'efetivada' AND mudou_status THEN
    NEW.efetivada_em := coalesce(NEW.efetivada_em, now());
    IF NEW.pedido_status IS NULL THEN
      NEW.pedido_status := 'aguardando';
      NEW.pagamento_status := coalesce(NEW.pagamento_status, 'em_aberto');
    END IF;
  END IF;

  -- Aprovação da gestão: só admin marca "aprovada", e isso libera o preço atual
  IF NEW.status = 'aprovada' AND mudou_status THEN
    IF NOT eh_admin THEN
      RAISE EXCEPTION 'Somente a gestão pode aprovar a cotação';
    END IF;
    IF auth.uid() IS NOT NULL THEN
      NEW.aprovacao_status := 'aprovada';
      NEW.aprovado_por := auth.uid();
      NEW.aprovado_em := now();
      NEW.aprovacao_margem := public.cotacao_margem_minima(NEW.id);
    END IF;
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
      NEW.aprovado_por := OLD.aprovado_por; NEW.aprovado_em := OLD.aprovado_em; NEW.aprovacao_margem := OLD.aprovacao_margem;
    END IF;

    IF TG_OP = 'UPDATE' AND mudou_status AND NEW.status IN ('enviada', 'efetivada') AND NOT public.cotacao_liberada(NEW.id) THEN
      RAISE EXCEPTION 'Preço abaixo da margem mínima: solicite a aprovação do administrador antes de enviar';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Cotações que o cliente já tinha fechado (antigo "aprovada") passam para "efetivada"
UPDATE public.cotacoes SET status = 'efetivada', efetivada_em = coalesce(updated_at, created_at) WHERE status = 'aprovada';

-- ── 3. Itens: cotação aprovada/enviada/efetivada não pode cair abaixo da margem ──
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

  IF st IN ('aprovada', 'enviada', 'efetivada') AND NOT public.is_admin() AND NOT public.cotacao_liberada(p_cotacao) THEN
    RAISE EXCEPTION 'Preço abaixo da margem mínima: volte a cotação para rascunho e solicite aprovação';
  END IF;
END;
$$;

-- ── 4. Orçamento público: vale para aprovada, enviada e efetivada ──
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
  WHERE c.token_publico = token AND c.status IN ('aprovada', 'enviada', 'efetivada');
$$;

-- ── 5. Produto digitado fora do cadastro entra no cadastro ──
-- Qualquer usuário logado pode cadastrar; se já existe um produto com o mesmo nome, devolve ele.
CREATE OR REPLACE FUNCTION public.cadastrar_produto_rapido(p_nome text, p_fornecedor text, p_unidade text, p_preco numeric)
  RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF coalesce(trim(p_nome), '') = '' THEN RETURN NULL; END IF;

  SELECT id INTO v_id FROM public.produtos
  WHERE upper(trim(nome)) = upper(trim(p_nome))
  ORDER BY ativo DESC, created_at
  LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  INSERT INTO public.produtos (nome, fornecedor, unidade, preco_tabela, observacoes)
  VALUES (trim(p_nome), nullif(trim(coalesce(p_fornecedor, '')), ''), coalesce(nullif(trim(coalesce(p_unidade, '')), ''), 'TON'),
          greatest(coalesce(p_preco, 0), 0), 'Cadastrado automaticamente a partir de uma cotação')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.cadastrar_produto_rapido(text, text, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cadastrar_produto_rapido(text, text, text, numeric) TO authenticated;

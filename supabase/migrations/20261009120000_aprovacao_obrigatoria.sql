-- ============================================================
-- Cotações: aprovação da gestão obrigatória antes de enviar o orçamento
-- Fluxo: cotação (rascunho) → aprovação da gestão (aprovada) → orçamento enviado (enviada)
--        → cliente aprova (efetivada = pedido) ou não (perdida)
--  · consultor só envia/efetiva se a gestão aprovou e o preço não caiu depois da aprovação
--  · admin que envia/efetiva direto já registra a aprovação
--  · cotações já enviadas/efetivadas antes desta regra ficam como aprovadas
-- Rollback: supabase/rollback/20261009120000_aprovacao_obrigatoria_down.sql
-- ============================================================

-- Aprovada pela gestão e sem preço abaixo do que foi aprovado
CREATE OR REPLACE FUNCTION public.cotacao_coberta(cot uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT c.aprovacao_status = 'aprovada'
     AND coalesce(public.cotacao_margem_minima(c.id), 1) >= coalesce(c.aprovacao_margem, -1) - 0.000001
  FROM public.cotacoes c
  WHERE c.id = cot;
$$;
GRANT EXECUTE ON FUNCTION public.cotacao_coberta(uuid) TO authenticated;

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

  -- Cliente aprovou: abre o pedido
  IF NEW.status = 'efetivada' AND mudou_status THEN
    NEW.efetivada_em := coalesce(NEW.efetivada_em, now());
    IF NEW.pedido_status IS NULL THEN
      NEW.pedido_status := 'aguardando';
      NEW.pagamento_status := coalesce(NEW.pagamento_status, 'em_aberto');
    END IF;
  END IF;

  -- Aprovação da gestão: obrigatória para aprovar, enviar e efetivar
  IF NEW.status IN ('aprovada', 'enviada', 'efetivada') AND mudou_status THEN
    IF eh_admin THEN
      IF auth.uid() IS NOT NULL AND (NEW.status = 'aprovada' OR NOT coalesce(public.cotacao_coberta(NEW.id), false)) THEN
        NEW.aprovacao_status := 'aprovada';
        NEW.aprovado_por := auth.uid();
        NEW.aprovado_em := now();
        NEW.aprovacao_margem := public.cotacao_margem_minima(NEW.id);
      END IF;
    ELSIF NEW.status = 'aprovada' THEN
      RAISE EXCEPTION 'Somente a gestão pode aprovar a cotação';
    ELSIF NOT coalesce(public.cotacao_coberta(NEW.id), false) THEN
      RAISE EXCEPTION 'A cotação precisa ser aprovada pela gestão antes de enviar o orçamento ao cliente';
    END IF;
  END IF;

  IF NOT eh_admin THEN
    -- consultor só pode pedir aprovação (pendente) ou limpar; decisão é da gestão
    IF TG_OP = 'INSERT' THEN
      IF NEW.aprovacao_status IN ('aprovada', 'reprovada') THEN NEW.aprovacao_status := NULL; END IF;
      NEW.aprovado_por := NULL; NEW.aprovado_em := NULL; NEW.aprovacao_margem := NULL;
    ELSE
      IF NEW.aprovacao_status IN ('aprovada', 'reprovada') AND NEW.aprovacao_status IS DISTINCT FROM OLD.aprovacao_status THEN
        NEW.aprovacao_status := OLD.aprovacao_status;
      END IF;
      NEW.aprovado_por := OLD.aprovado_por; NEW.aprovado_em := OLD.aprovado_em; NEW.aprovacao_margem := OLD.aprovacao_margem;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Itens: depois de aprovada, o consultor não pode baixar o preço sem nova aprovação
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

  IF st IN ('aprovada', 'enviada', 'efetivada') AND NOT public.is_admin() AND NOT coalesce(public.cotacao_coberta(p_cotacao), false) THEN
    RAISE EXCEPTION 'Preço abaixo do aprovado pela gestão: envie a cotação para aprovação de novo';
  END IF;
END;
$$;

-- Cotações que já tinham ido para o cliente ficam registradas como aprovadas
UPDATE public.cotacoes
SET aprovacao_status = 'aprovada',
    aprovacao_margem = public.cotacao_margem_minima(id),
    aprovado_em = coalesce(aprovado_em, enviada_em, updated_at, created_at)
WHERE status IN ('enviada', 'efetivada') AND aprovacao_status IS DISTINCT FROM 'aprovada';

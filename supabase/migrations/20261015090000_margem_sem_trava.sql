-- ============================================================
-- Cotações: margem não trava mais o orçamento (temporário, pedido do cliente em 2026-10-15)
--  · a aprovação da gestão continua obrigatória antes de enviar/efetivar
--  · depois de aprovada, baixar o preço NÃO devolve a cotação para a gestão
-- Rollback: supabase/rollback/20261015090000_margem_sem_trava_down.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.cotacao_coberta(cot uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT c.aprovacao_status = 'aprovada'
  FROM public.cotacoes c
  WHERE c.id = cot;
$$;

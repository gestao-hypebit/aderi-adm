-- ============================================================
-- Rollback de 20261015090000_margem_sem_trava.sql (volta a travar quando o preço cai abaixo do aprovado)
-- Executar no SQL Editor do Supabase e depois:
--   npx supabase migration repair 20261015090000 --status reverted
-- ============================================================

CREATE OR REPLACE FUNCTION public.cotacao_coberta(cot uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT c.aprovacao_status = 'aprovada'
     AND coalesce(public.cotacao_margem_minima(c.id), 1) >= coalesce(c.aprovacao_margem, -1) - 0.000001
  FROM public.cotacoes c
  WHERE c.id = cot;
$$;

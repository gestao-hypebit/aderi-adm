-- ============================================================
-- Rollback de 20261009150000_cotacao_datas_etapas.sql
-- Executar no SQL Editor do Supabase e depois:
--   npx supabase migration repair 20261009150000 --status reverted
-- ============================================================

DROP TRIGGER IF EXISTS cotacoes_datas ON public.cotacoes;
DROP FUNCTION IF EXISTS public.cotacoes_datas();
ALTER TABLE public.cotacoes DROP COLUMN IF EXISTS aprovacao_pedida_em, DROP COLUMN IF EXISTS perdida_em;

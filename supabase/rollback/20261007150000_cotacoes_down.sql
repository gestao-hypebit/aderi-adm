-- ============================================================
-- Rollback de 20261007150000_cotacoes.sql
-- Executar no SQL Editor do Supabase e depois:
--   npx supabase migration repair 20261007150000 --status reverted
-- ============================================================

DROP TABLE IF EXISTS public.cotacao_itens;
DROP TABLE IF EXISTS public.cotacoes;
DROP SEQUENCE IF EXISTS public.cotacoes_numero_seq;
DROP TABLE IF EXISTS public.produtos;

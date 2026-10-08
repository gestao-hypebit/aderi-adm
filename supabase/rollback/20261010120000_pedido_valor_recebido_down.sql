-- ============================================================
-- Rollback de 20261010120000_pedido_valor_recebido.sql
-- Executar no SQL Editor do Supabase e depois:
--   npx supabase migration repair 20261010120000 --status reverted
-- ============================================================

ALTER TABLE public.cotacoes DROP COLUMN IF EXISTS valor_recebido;

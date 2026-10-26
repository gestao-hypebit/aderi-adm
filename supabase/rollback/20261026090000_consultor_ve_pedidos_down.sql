-- ============================================================
-- Rollback de 20261026090000_consultor_ve_pedidos.sql (pedidos voltam a ser só da gestão)
-- Executar no SQL Editor do Supabase e depois:
--   npx supabase migration repair 20261026090000 --status reverted
-- ============================================================

DROP POLICY IF EXISTS "consultor_ve_pedido_entregas" ON public.pedido_entregas;

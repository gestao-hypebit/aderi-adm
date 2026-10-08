-- ============================================================
-- Rollback de 20261010090000_pedido_entregas.sql
-- Executar no SQL Editor do Supabase e depois:
--   npx supabase migration repair 20261010090000 --status reverted
-- Apaga todas as cargas registradas.
-- ============================================================

DROP TABLE IF EXISTS public.pedido_entregas;
DROP FUNCTION IF EXISTS public.atualizar_entrega_pedido();

UPDATE public.cotacoes SET pedido_status = 'aguardando' WHERE pedido_status = 'parcial';
ALTER TABLE public.cotacoes DROP CONSTRAINT IF EXISTS cotacoes_pedido_status_check;
ALTER TABLE public.cotacoes ADD CONSTRAINT cotacoes_pedido_status_check
  CHECK (pedido_status IN ('aguardando', 'faturado', 'entregue', 'cancelado'));

-- ============================================================
-- Pedido: valor já recebido do cliente (para pagamentos parciais e o "falta receber")
-- Rollback: supabase/rollback/20261010120000_pedido_valor_recebido_down.sql
-- ============================================================

ALTER TABLE public.cotacoes
  ADD COLUMN valor_recebido numeric NOT NULL DEFAULT 0 CHECK (valor_recebido >= 0);

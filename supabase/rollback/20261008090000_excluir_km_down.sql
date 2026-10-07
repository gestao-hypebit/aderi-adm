-- ============================================================
-- Rollback de 20261008090000_excluir_km.sql
-- Executar no SQL Editor do Supabase e depois:
--   npx supabase migration repair 20261008090000 --status reverted
-- ============================================================

DROP POLICY IF EXISTS "delete_km" ON public.km_diario;
DROP POLICY IF EXISTS "delete_abastecimento" ON public.abastecimentos;

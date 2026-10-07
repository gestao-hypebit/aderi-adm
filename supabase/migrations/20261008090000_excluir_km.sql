-- ============================================================
-- Exclusão de lançamentos de KM e abastecimento
-- Consultor apaga os próprios; admin apaga de qualquer consultor.
-- Rollback: supabase/rollback/20261008090000_excluir_km_down.sql
-- ============================================================

CREATE POLICY "delete_km" ON public.km_diario
  FOR DELETE TO authenticated
  USING (funcionario_id = auth.uid() OR public.is_admin());

CREATE POLICY "delete_abastecimento" ON public.abastecimentos
  FOR DELETE TO authenticated
  USING (funcionario_id = auth.uid() OR public.is_admin());

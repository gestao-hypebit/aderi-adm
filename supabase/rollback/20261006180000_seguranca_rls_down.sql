-- ============================================================
-- Rollback de 20261006180000_seguranca_rls.sql
-- Restaura as policies exatamente como estavam antes.
-- Executar no SQL Editor do Supabase e depois:
--   npx supabase migration repair 20261006180000 --status reverted
-- ============================================================

-- 6. Tabelas legadas
GRANT ALL ON TABLE public.users, public.clients, public.visits,
                   public.pending_items, public.reports
  TO anon, authenticated;
ALTER TABLE public.users         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports       DISABLE ROW LEVEL SECURITY;

-- 5. visita_fotos
DROP POLICY IF EXISTS "fotos_da_visita" ON public.visita_fotos;
CREATE POLICY "Autenticados podem deletar fotos" ON public.visita_fotos
  FOR DELETE TO authenticated USING (true);
CREATE POLICY "Autenticados podem inserir fotos" ON public.visita_fotos
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados podem ler fotos" ON public.visita_fotos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem gerenciar fotos" ON public.visita_fotos
  FOR ALL TO PUBLIC USING ((auth.role() = 'authenticated'::text));

-- 4. visitas
DROP POLICY IF EXISTS "select_visitas" ON public.visitas;
DROP POLICY IF EXISTS "insert_visitas" ON public.visitas;
DROP POLICY IF EXISTS "update_visitas" ON public.visitas;
DROP POLICY IF EXISTS "delete_visitas" ON public.visitas;
CREATE POLICY "Usuários autenticados podem gerenciar visitas" ON public.visitas
  FOR ALL TO PUBLIC USING ((auth.role() = 'authenticated'::text));

-- 3. km / abastecimentos
DROP POLICY IF EXISTS "admin_select_km" ON public.km_diario;
DROP POLICY IF EXISTS "admin_select_abastecimento" ON public.abastecimentos;

-- 2. profiles
DROP TRIGGER IF EXISTS proteger_role_profile ON public.profiles;
DROP FUNCTION IF EXISTS public.proteger_role_profile();

-- 1. is_admin
DROP FUNCTION IF EXISTS public.is_admin();

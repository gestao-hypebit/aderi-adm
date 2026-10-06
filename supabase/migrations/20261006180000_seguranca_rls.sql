-- ============================================================
-- Segurança: papéis, RLS por colaborador e bloqueio de tabelas legadas
-- Rollback: supabase/rollback/20261006180000_seguranca_rls_down.sql
-- ============================================================

-- ── 1. Helper is_admin() ───────────────────────────────────
-- SECURITY DEFINER para poder ler profiles sem cair em recursão de RLS.
CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- ── 2. profiles: impede o usuário de alterar o próprio role ─
-- Só admin (ou o painel do Supabase / service_role, onde auth.uid() é nulo) muda role.
CREATE OR REPLACE FUNCTION public.proteger_role_profile()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND auth.uid() IS NOT NULL
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Sem permissão para alterar o papel do usuário';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS proteger_role_profile ON public.profiles;
CREATE TRIGGER proteger_role_profile
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.proteger_role_profile();

-- ── 3. km_diario / abastecimentos: admin pode ler tudo ─────
CREATE POLICY "admin_select_km" ON public.km_diario
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "admin_select_abastecimento" ON public.abastecimentos
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ── 4. visitas: colaborador só as próprias, admin todas ────
DROP POLICY IF EXISTS "Usuários autenticados podem gerenciar visitas" ON public.visitas;

CREATE POLICY "select_visitas" ON public.visitas
  FOR SELECT TO authenticated
  USING (funcionario_id = auth.uid() OR public.is_admin());

CREATE POLICY "insert_visitas" ON public.visitas
  FOR INSERT TO authenticated
  WITH CHECK (funcionario_id = auth.uid() OR public.is_admin());

CREATE POLICY "update_visitas" ON public.visitas
  FOR UPDATE TO authenticated
  USING (funcionario_id = auth.uid() OR public.is_admin())
  WITH CHECK (funcionario_id = auth.uid() OR public.is_admin());

CREATE POLICY "delete_visitas" ON public.visitas
  FOR DELETE TO authenticated
  USING (funcionario_id = auth.uid() OR public.is_admin());

-- ── 5. visita_fotos: segue o acesso da visita ──────────────
DROP POLICY IF EXISTS "Autenticados podem deletar fotos" ON public.visita_fotos;
DROP POLICY IF EXISTS "Autenticados podem inserir fotos" ON public.visita_fotos;
DROP POLICY IF EXISTS "Autenticados podem ler fotos" ON public.visita_fotos;
DROP POLICY IF EXISTS "Usuários autenticados podem gerenciar fotos" ON public.visita_fotos;

CREATE POLICY "fotos_da_visita" ON public.visita_fotos
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.visitas v
    WHERE v.id = visita_id
      AND (v.funcionario_id = auth.uid() OR public.is_admin())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.visitas v
    WHERE v.id = visita_id
      AND (v.funcionario_id = auth.uid() OR public.is_admin())
  ));

-- ── 6. Tabelas legadas (protótipo antigo): bloqueia acesso ─
-- Não são usadas pelo app. Mantidas por segurança; remover numa migration futura.
ALTER TABLE public.users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports       ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.users, public.clients, public.visits,
                    public.pending_items, public.reports
  FROM anon, authenticated;

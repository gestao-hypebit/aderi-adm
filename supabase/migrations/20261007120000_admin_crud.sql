-- ============================================================
-- CRUD do admin: gestão de consultores e carteira de clientes por consultor
-- Rollback: supabase/rollback/20261007120000_admin_crud_down.sql
-- ============================================================

-- ── 1. profiles: status ativo e telefone ───────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ativo    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS telefone text;

-- is_admin() passa a exigir perfil ativo: admin desativado perde o acesso.
CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND ativo
  );
$$;

-- ── 2. profiles: admin edita qualquer perfil ───────────────
-- A policy "editar_proprio_perfil" continua valendo para o próprio usuário.
-- O trigger proteger_role_profile já impede não-admin de mudar role.
CREATE POLICY "admin_update_profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Usuário comum não pode se reativar nem mudar o próprio status.
CREATE OR REPLACE FUNCTION public.proteger_role_profile()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.ativo IS DISTINCT FROM OLD.ativo)
     AND auth.uid() IS NOT NULL
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Sem permissão para alterar o papel ou o status do usuário';
  END IF;
  RETURN NEW;
END;
$$;

-- ── 3. clientes: carteira por consultor, admin vê tudo ─────
-- Consultor vê os clientes que cadastrou ou com quem tem visita.
ALTER TABLE public.clientes
  ALTER COLUMN criado_por SET DEFAULT auth.uid();

DROP POLICY IF EXISTS "Usuários autenticados podem gerenciar clientes" ON public.clientes;

CREATE POLICY "select_clientes" ON public.clientes
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR criado_por = auth.uid()
    OR EXISTS (SELECT 1 FROM public.visitas v WHERE v.cliente_id = clientes.id AND v.funcionario_id = auth.uid())
  );

CREATE POLICY "insert_clientes" ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR criado_por = auth.uid());

CREATE POLICY "update_clientes" ON public.clientes
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR criado_por = auth.uid()
    OR EXISTS (SELECT 1 FROM public.visitas v WHERE v.cliente_id = clientes.id AND v.funcionario_id = auth.uid())
  )
  WITH CHECK (true);

-- Excluir cliente apaga as visitas dele (FK ON DELETE CASCADE): só admin ou quem cadastrou.
CREATE POLICY "delete_clientes" ON public.clientes
  FOR DELETE TO authenticated
  USING (public.is_admin() OR criado_por = auth.uid());

-- ============================================================
-- Rollback de 20261007120000_admin_crud.sql
-- Executar no SQL Editor do Supabase e depois:
--   npx supabase migration repair 20261007120000 --status reverted
-- ============================================================

-- 3. clientes
DROP POLICY IF EXISTS "select_clientes" ON public.clientes;
DROP POLICY IF EXISTS "insert_clientes" ON public.clientes;
DROP POLICY IF EXISTS "update_clientes" ON public.clientes;
DROP POLICY IF EXISTS "delete_clientes" ON public.clientes;
CREATE POLICY "Usuários autenticados podem gerenciar clientes" ON public.clientes
  FOR ALL TO PUBLIC USING ((auth.role() = 'authenticated'::text));
ALTER TABLE public.clientes ALTER COLUMN criado_por DROP DEFAULT;

-- 2. profiles
DROP POLICY IF EXISTS "admin_update_profiles" ON public.profiles;
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

-- 1. is_admin() sem checar ativo, e remove as colunas novas
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
ALTER TABLE public.profiles DROP COLUMN IF EXISTS ativo, DROP COLUMN IF EXISTS telefone;

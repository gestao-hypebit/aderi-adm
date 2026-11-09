-- Rollback de 20261109120000_excluir_usuario.sql (contas já excluídas não voltam)
-- Executar no SQL Editor do Supabase e depois:
--   npx supabase migration repair 20261109120000 --status reverted
DROP FUNCTION IF EXISTS public.excluir_usuario(uuid);
DROP FUNCTION IF EXISTS public.liberar_login_usuario(uuid);
DROP FUNCTION IF EXISTS public.login_usuario(uuid);

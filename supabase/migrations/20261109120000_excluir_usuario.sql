-- ============================================================
-- Usuários: excluir conta e liberar login (só administrador completo)
--  · excluir_usuario: apaga a conta de quem ainda não tem histórico (visitas, cotações, KM).
--    Quem já trabalhou no sistema é desativado, não excluído, para não perder o histórico.
--  · login_usuario / liberar_login_usuario: mostra se o e-mail foi confirmado e confirma
--    na mão (a conta criada pela administração fica travada até clicar no link do e-mail).
-- Rollback: supabase/rollback/20261109120000_excluir_usuario_down.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.login_usuario(p_id uuid)
  RETURNS TABLE (email text, confirmado boolean, ultimo_login timestamptz)
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Somente o administrador pode ver o acesso do usuário'; END IF;
  RETURN QUERY
    SELECT u.email::text, u.email_confirmed_at IS NOT NULL, u.last_sign_in_at
    FROM auth.users u WHERE u.id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.liberar_login_usuario(p_id uuid)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Somente o administrador pode liberar o login'; END IF;
  UPDATE auth.users SET email_confirmed_at = coalesce(email_confirmed_at, now()) WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuário não encontrado'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.excluir_usuario(p_id uuid)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  n_visitas int; n_cotacoes int; n_km int;
  motivos text[] := '{}';
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Somente o administrador pode excluir usuários'; END IF;
  IF p_id = auth.uid() THEN RAISE EXCEPTION 'Você não pode excluir a sua própria conta'; END IF;

  SELECT count(*) INTO n_visitas FROM public.visitas WHERE funcionario_id = p_id;
  SELECT count(*) INTO n_cotacoes FROM public.cotacoes WHERE criado_por = p_id OR aprovado_por = p_id;
  SELECT (SELECT count(*) FROM public.km_diario WHERE funcionario_id = p_id)
       + (SELECT count(*) FROM public.abastecimentos WHERE funcionario_id = p_id) INTO n_km;
  IF n_visitas > 0 THEN motivos := motivos || (n_visitas || ' visita(s)'); END IF;
  IF n_cotacoes > 0 THEN motivos := motivos || (n_cotacoes || ' cotação(ões)'); END IF;
  IF n_km > 0 THEN motivos := motivos || (n_km || ' lançamento(s) de KM'); END IF;
  IF array_length(motivos, 1) > 0 THEN
    RAISE EXCEPTION 'Este usuário tem histórico (%). Desative o acesso em vez de excluir.', array_to_string(motivos, ', ');
  END IF;

  -- Clientes que ele cadastrou ficam no sistema, em nome de quem excluiu
  -- (o responsável vira vazio sozinho: ON DELETE SET NULL)
  UPDATE public.clientes SET criado_por = auth.uid() WHERE criado_por = p_id;

  -- profiles sai em cascata; vínculos de metas/importações ficam com NULL
  DELETE FROM auth.users WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuário não encontrado'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.login_usuario(uuid), public.liberar_login_usuario(uuid), public.excluir_usuario(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.login_usuario(uuid), public.liberar_login_usuario(uuid), public.excluir_usuario(uuid) TO authenticated;

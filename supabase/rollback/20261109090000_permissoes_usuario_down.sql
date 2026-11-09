-- ============================================================
-- Rollback de 20261109090000_permissoes_usuario.sql
-- ATENÇÃO: usuários com acesso personalizado voltam a ser administradores completos.
-- Executar no SQL Editor do Supabase e depois:
--   npx supabase migration repair 20261109090000 --status reverted
-- ============================================================

DROP POLICY IF EXISTS "pode_update_profiles" ON public.profiles;
DROP POLICY IF EXISTS "pode_select_visitas" ON public.visitas;
DROP POLICY IF EXISTS "pode_visitas" ON public.visitas;
DROP POLICY IF EXISTS "pode_visita_fotos" ON public.visita_fotos;
DROP POLICY IF EXISTS "pode_select_km" ON public.km_diario;
DROP POLICY IF EXISTS "pode_select_abastecimento" ON public.abastecimentos;
DROP POLICY IF EXISTS "pode_select_clientes" ON public.clientes;
DROP POLICY IF EXISTS "pode_clientes" ON public.clientes;
DROP POLICY IF EXISTS "pode_insert_clientes" ON public.clientes;
DROP POLICY IF EXISTS "pode_update_clientes_visita" ON public.clientes;
DROP POLICY IF EXISTS "pode_select_cotacoes" ON public.cotacoes;
DROP POLICY IF EXISTS "pode_cotacoes" ON public.cotacoes;
DROP POLICY IF EXISTS "pode_cotacao_itens" ON public.cotacao_itens;
DROP POLICY IF EXISTS "pode_pedido_entregas" ON public.pedido_entregas;
DROP POLICY IF EXISTS "pode_produtos" ON public.produtos;
DROP POLICY IF EXISTS "pode_update_configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "pode_unidades_negocio" ON public.unidades_negocio;
DROP POLICY IF EXISTS "pode_grupos_produto" ON public.grupos_produto;
DROP POLICY IF EXISTS "pode_consultores_comerciais" ON public.consultores_comerciais;
DROP POLICY IF EXISTS "pode_select_metas" ON public.metas;
DROP POLICY IF EXISTS "pode_metas" ON public.metas;
DROP POLICY IF EXISTS "pode_select_realizado_historico" ON public.realizado_historico;
DROP POLICY IF EXISTS "pode_realizado_historico" ON public.realizado_historico;
DROP POLICY IF EXISTS "pode_select_importacoes" ON public.importacoes;
DROP POLICY IF EXISTS "pode_importacoes" ON public.importacoes;
DROP POLICY IF EXISTS "pode_select_mapeamento_nomes" ON public.mapeamento_nomes;
DROP POLICY IF EXISTS "pode_mapeamento_nomes" ON public.mapeamento_nomes;
DROP POLICY IF EXISTS "pode_select_vendas" ON public.vendas;
DROP POLICY IF EXISTS "pode_vendas" ON public.vendas;

-- Funções de volta para is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND ativo);
$$;

CREATE OR REPLACE FUNCTION public.proteger_role_profile()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.proteger_responsavel_cliente()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.responsavel_id := auth.uid();
  ELSIF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id THEN
    NEW.responsavel_id := OLD.responsavel_id;
  END IF;
  RETURN NEW;
END;
$$;

-- cotacoes_regras() e salvar_itens_cotacao() ainda chamam pode(): ela vira um apelido de is_admin()
CREATE OR REPLACE FUNCTION public.pode(VARIADIC chaves text[])
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.is_admin();
$$;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS permissoes;

-- ============================================================
-- Rollback de 20261027090000_metas_comerciais.sql (remove o módulo de metas e TODOS os dados dele)
-- Executar no SQL Editor do Supabase e depois:
--   npx supabase migration repair 20261027090000 --status reverted
-- ============================================================

DROP TABLE IF EXISTS public.vendas;
DROP FUNCTION IF EXISTS public.vendas_preencher();
DROP TABLE IF EXISTS public.mapeamento_nomes;
DROP TABLE IF EXISTS public.importacoes;
DROP TABLE IF EXISTS public.realizado_historico;
DROP TABLE IF EXISTS public.metas;
DROP TABLE IF EXISTS public.consultores_comerciais;
DROP TABLE IF EXISTS public.grupos_produto;
DROP TABLE IF EXISTS public.unidades_negocio;

ALTER TABLE public.configuracoes
  DROP COLUMN IF EXISTS meta_juros_mes,
  DROP COLUMN IF EXISTS meta_aliquota_imposto,
  DROP COLUMN IF EXISTS meta_fator_comissao,
  DROP COLUMN IF EXISTS meta_limite_amarelo,
  DROP COLUMN IF EXISTS meta_limite_verde;

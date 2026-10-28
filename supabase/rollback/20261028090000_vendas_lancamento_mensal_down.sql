-- ============================================================
-- Rollback de 20261028090000_vendas_lancamento_mensal.sql
-- ATENÇÃO: apaga as vendas que ainda estão "a completar" (sem grupo, consultor, modalidade ou D/C),
-- porque essas colunas voltam a ser obrigatórias.
-- Executar no SQL Editor do Supabase e depois:
--   npx supabase migration repair 20261028090000 --status reverted
-- ============================================================

DELETE FROM public.vendas WHERE grupo_id IS NULL OR consultor_id IS NULL OR unidade_id IS NULL OR modalidade IS NULL OR tipo IS NULL;

DROP INDEX IF EXISTS public.vendas_produto_codigo_idx;
DROP INDEX IF EXISTS public.vendas_a_completar_idx;

ALTER TABLE public.vendas
  DROP COLUMN cliente_codigo,
  DROP COLUMN produto_codigo,
  DROP COLUMN vendedor_codigo,
  ALTER COLUMN grupo_id     SET NOT NULL,
  ALTER COLUMN consultor_id SET NOT NULL,
  ALTER COLUMN unidade_id   SET NOT NULL,
  ALTER COLUMN modalidade   SET NOT NULL,
  ALTER COLUMN tipo         SET NOT NULL;

CREATE OR REPLACE FUNCTION public.vendas_preencher()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  cfg public.configuracoes%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO cfg FROM public.configuracoes WHERE id = 1;
    NEW.taxa_juros_mensal := coalesce(NEW.taxa_juros_mensal, cfg.meta_juros_mes, 0.022);
    NEW.aliquota_imposto  := coalesce(NEW.aliquota_imposto, cfg.meta_aliquota_imposto, 0.30);
    NEW.fator_comissao    := coalesce(NEW.fator_comissao, cfg.meta_fator_comissao, 0.10);
  END IF;
  NEW.faturamento := coalesce(NEW.faturamento, NEW.quantidade * NEW.preco_unitario);
  NEW.competencia := date_trunc('month', coalesce(NEW.competencia, NEW.data))::date;
  IF NEW.unidade_id IS NULL OR (TG_OP = 'UPDATE' AND NEW.consultor_id IS DISTINCT FROM OLD.consultor_id) THEN
    SELECT unidade_id INTO NEW.unidade_id FROM public.consultores_comerciais WHERE id = NEW.consultor_id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DELETE FROM public.mapeamento_nomes WHERE tipo = 'vendedor';
ALTER TABLE public.mapeamento_nomes DROP CONSTRAINT mapeamento_nomes_tipo_check;
ALTER TABLE public.mapeamento_nomes ADD CONSTRAINT mapeamento_nomes_tipo_check
  CHECK (tipo IN ('consultor', 'grupo', 'modalidade', 'tipo'));

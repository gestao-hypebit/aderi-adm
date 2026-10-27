-- ============================================================
-- Rollback de 20261027120000_vendas_faturamento_informado.sql (faturamento volta a ser qtd × unitário)
-- e remove a competência.
-- ATENÇÃO: vendas importadas com quantidade 0 (relatórios de venda direta) passam a valer zero.
-- Executar no SQL Editor do Supabase e depois:
--   npx supabase migration repair 20261027120000 --status reverted
-- ============================================================

DROP INDEX IF EXISTS public.vendas_competencia_idx;
ALTER TABLE public.vendas DROP COLUMN IF EXISTS competencia;
ALTER TABLE public.vendas DROP COLUMN faturamento;
ALTER TABLE public.vendas ADD COLUMN faturamento numeric GENERATED ALWAYS AS (quantidade * preco_unitario) STORED;

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
  IF NEW.unidade_id IS NULL OR (TG_OP = 'UPDATE' AND NEW.consultor_id IS DISTINCT FROM OLD.consultor_id) THEN
    SELECT unidade_id INTO NEW.unidade_id FROM public.consultores_comerciais WHERE id = NEW.consultor_id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

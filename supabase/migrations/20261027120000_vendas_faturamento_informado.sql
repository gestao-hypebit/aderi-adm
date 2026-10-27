-- ============================================================
-- Vendas: faturamento deixa de ser coluna gerada (qtd × unitário)
-- Nas planilhas AD há vendas diretas lançadas como relatório da fábrica ("RELAT JANEIRO-26",
-- calcário) com quantidade 0 e só o valor; e o total da planilha soma a coluna G, não E × F.
-- O lançamento manual continua calculando qtd × unitário (trigger, quando não vier valor);
-- a importação grava o faturamento da planilha e avisa quando difere de E × F.
--
-- Competência (mês de referência): a planilha soma no mês do arquivo vendas com data de
-- outro mês (ex.: janeiro traz vendas diretas de nov–dez/2025). O painel agrupa por competência;
-- no lançamento manual ela é o mês da data.
-- Rollback: supabase/rollback/20261027120000_vendas_faturamento_informado_down.sql
-- ============================================================

ALTER TABLE public.vendas DROP COLUMN faturamento;
ALTER TABLE public.vendas ADD COLUMN faturamento numeric NOT NULL;

ALTER TABLE public.vendas ADD COLUMN competencia date NOT NULL CHECK (extract(day FROM competencia) = 1);
CREATE INDEX vendas_competencia_idx ON public.vendas (competencia, unidade_id);

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

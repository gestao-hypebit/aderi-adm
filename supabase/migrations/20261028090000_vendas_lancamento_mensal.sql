-- ============================================================
-- Lançamento mensal no formato da planilha AD + importação do relatório do ERP (EDPE010)
--  · O relatório do ERP traz data, DAV, cliente, produto, quantidade e preço, mas não
--    grupo, consultor, D/C nem custo. A venda entra "a completar" e o operador termina
--    na tela de lançamentos. Por isso grupo/consultor/unidade/modalidade/tipo aceitam nulo.
--    Venda a completar não entra no painel de metas até ser classificada.
--  · Códigos do ERP (cliente, produto, vendedor) ficam na venda: na próxima importação o
--    mesmo produto já vem com grupo e D/C, e o mesmo cliente com o consultor.
--  · mapeamento_nomes ganha o tipo 'vendedor' (código do vendedor no ERP → consultor).
-- Rollback: supabase/rollback/20261028090000_vendas_lancamento_mensal_down.sql
-- ============================================================

ALTER TABLE public.vendas
  ALTER COLUMN grupo_id     DROP NOT NULL,
  ALTER COLUMN consultor_id DROP NOT NULL,
  ALTER COLUMN unidade_id   DROP NOT NULL,
  ALTER COLUMN modalidade   DROP NOT NULL,
  ALTER COLUMN tipo         DROP NOT NULL,
  ADD COLUMN cliente_codigo  text,
  ADD COLUMN produto_codigo  text,
  ADD COLUMN vendedor_codigo text;

CREATE INDEX vendas_produto_codigo_idx ON public.vendas (produto_codigo) WHERE produto_codigo IS NOT NULL;
CREATE INDEX vendas_a_completar_idx ON public.vendas (competencia)
  WHERE grupo_id IS NULL OR consultor_id IS NULL OR modalidade IS NULL OR tipo IS NULL;

-- Sem consultor, sem unidade (antes a unidade antiga ficava quando o consultor era apagado)
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
  IF NEW.consultor_id IS NULL THEN
    NEW.unidade_id := NULL;
  ELSIF NEW.unidade_id IS NULL OR (TG_OP = 'UPDATE' AND NEW.consultor_id IS DISTINCT FROM OLD.consultor_id) THEN
    SELECT unidade_id INTO NEW.unidade_id FROM public.consultores_comerciais WHERE id = NEW.consultor_id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

ALTER TABLE public.mapeamento_nomes DROP CONSTRAINT mapeamento_nomes_tipo_check;
ALTER TABLE public.mapeamento_nomes ADD CONSTRAINT mapeamento_nomes_tipo_check
  CHECK (tipo IN ('consultor', 'grupo', 'modalidade', 'tipo', 'vendedor'));

-- Vendedores do ERP conferidos com as planilhas de 2026 (clientes de cada código).
-- 009/4 é o lançamento do escritório e aparece com todos os consultores: fica sem mapeamento,
-- e o consultor vem do histórico do cliente.
INSERT INTO public.mapeamento_nomes (tipo, texto_original, valor)
SELECT 'vendedor', v.codigo, c.id::text
FROM (VALUES ('001/9', 'Aderi Agro'), ('002/1', 'Gabriel'), ('006/0', 'Gilvan'), ('008/6', 'João Victor')) AS v(codigo, nome)
JOIN public.consultores_comerciais c ON c.nome = v.nome
ON CONFLICT (tipo, texto_original) DO NOTHING;

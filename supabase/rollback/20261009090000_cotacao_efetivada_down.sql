-- ============================================================
-- Rollback de 20261009090000_cotacao_efetivada.sql
-- Executar no SQL Editor do Supabase e depois:
--   npx supabase migration repair 20261009090000 --status reverted
-- Depois rode de novo as funções cotacoes_regras, salvar_itens_cotacao e orcamento_publico
-- de 20261008120000_evolucao_comercial.sql para voltar às versões anteriores.
-- ============================================================

DROP FUNCTION IF EXISTS public.cadastrar_produto_rapido(text, text, text, numeric);

-- "efetivada" volta a ser "aprovada"; a aprovação da gestão (antiga "aprovada") volta para rascunho
ALTER TABLE public.cotacoes DISABLE TRIGGER cotacoes_regras;
UPDATE public.cotacoes SET status = 'rascunho' WHERE status = 'aprovada';
UPDATE public.cotacoes SET status = 'aprovada' WHERE status = 'efetivada';
ALTER TABLE public.cotacoes ENABLE TRIGGER cotacoes_regras;

ALTER TABLE public.cotacoes DROP CONSTRAINT IF EXISTS cotacoes_status_check;
ALTER TABLE public.cotacoes ADD CONSTRAINT cotacoes_status_check
  CHECK (status IN ('rascunho', 'enviada', 'aprovada', 'perdida'));
ALTER TABLE public.cotacoes DROP COLUMN IF EXISTS efetivada_em;

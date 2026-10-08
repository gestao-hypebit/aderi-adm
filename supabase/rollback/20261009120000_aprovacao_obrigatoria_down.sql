-- ============================================================
-- Rollback de 20261009120000_aprovacao_obrigatoria.sql
-- Executar no SQL Editor do Supabase e depois:
--   npx supabase migration repair 20261009120000 --status reverted
-- ANTES deste arquivo, rode de novo as funções cotacoes_regras e salvar_itens_cotacao de
-- 20261009090000_cotacao_efetivada.sql (aprovação só abaixo da margem mínima):
-- as versões atuais usam cotacao_coberta, que é removida aqui.
-- As aprovações registradas em cotações antigas não são desfeitas (não atrapalham).
-- ============================================================

DROP FUNCTION IF EXISTS public.cotacao_coberta(uuid);

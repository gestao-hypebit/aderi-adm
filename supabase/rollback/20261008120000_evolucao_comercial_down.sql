-- ============================================================
-- Rollback de 20261008120000_evolucao_comercial.sql
-- Executar no SQL Editor do Supabase e depois:
--   npx supabase migration repair 20261008120000 --status reverted
-- ============================================================

DROP FUNCTION IF EXISTS public.orcamento_publico(uuid);
DROP FUNCTION IF EXISTS public.salvar_itens_cotacao(uuid, jsonb);
DROP TRIGGER IF EXISTS cotacoes_regras ON public.cotacoes;
DROP FUNCTION IF EXISTS public.cotacoes_regras();
DROP FUNCTION IF EXISTS public.cotacao_liberada(uuid);
DROP FUNCTION IF EXISTS public.cotacao_margem_minima(uuid);
DROP FUNCTION IF EXISTS public.margem_liquida_item(numeric, numeric, numeric, numeric, numeric, numeric, date, date, numeric, numeric, numeric, numeric);
ALTER TABLE public.cotacoes
  DROP COLUMN IF EXISTS validade, DROP COLUMN IF EXISTS enviada_em, DROP COLUMN IF EXISTS motivo_perda, DROP COLUMN IF EXISTS visita_id,
  DROP COLUMN IF EXISTS ptax_modo, DROP COLUMN IF EXISTS ptax_data, DROP COLUMN IF EXISTS token_publico,
  DROP COLUMN IF EXISTS aprovacao_status, DROP COLUMN IF EXISTS aprovacao_obs, DROP COLUMN IF EXISTS aprovacao_margem,
  DROP COLUMN IF EXISTS aprovado_por, DROP COLUMN IF EXISTS aprovado_em, DROP COLUMN IF EXISTS pedido_status,
  DROP COLUMN IF EXISTS nota_fiscal, DROP COLUMN IF EXISTS faturado_em, DROP COLUMN IF EXISTS entregue_em,
  DROP COLUMN IF EXISTS pagamento_status, DROP COLUMN IF EXISTS pago_em, DROP COLUMN IF EXISTS pedido_obs;

DROP FUNCTION IF EXISTS public.visita_publica(uuid);
ALTER TABLE public.visitas
  DROP COLUMN IF EXISTS checkin_em, DROP COLUMN IF EXISTS checkin_lat, DROP COLUMN IF EXISTS checkin_lng,
  DROP COLUMN IF EXISTS checkout_em, DROP COLUMN IF EXISTS checkout_lat, DROP COLUMN IF EXISTS checkout_lng,
  DROP COLUMN IF EXISTS checklist, DROP COLUMN IF EXISTS visita_origem_id, DROP COLUMN IF EXISTS token_publico;

DROP TABLE IF EXISTS public.cliente_contatos;
DROP FUNCTION IF EXISTS public.cliente_por_documento(text, uuid);
DROP TRIGGER IF EXISTS proteger_responsavel_cliente ON public.clientes;
DROP FUNCTION IF EXISTS public.proteger_responsavel_cliente();

DROP POLICY IF EXISTS "select_clientes" ON public.clientes;
CREATE POLICY "select_clientes" ON public.clientes
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR criado_por = auth.uid()
    OR EXISTS (SELECT 1 FROM public.visitas v WHERE v.cliente_id = clientes.id AND v.funcionario_id = auth.uid())
  );
DROP POLICY IF EXISTS "update_clientes" ON public.clientes;
CREATE POLICY "update_clientes" ON public.clientes
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR criado_por = auth.uid()
    OR EXISTS (SELECT 1 FROM public.visitas v WHERE v.cliente_id = clientes.id AND v.funcionario_id = auth.uid())
  )
  WITH CHECK (true);

ALTER TABLE public.clientes
  DROP COLUMN IF EXISTS inscricao_produtor, DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS longitude, DROP COLUMN IF EXISTS responsavel_id;

DROP TABLE IF EXISTS public.configuracoes;

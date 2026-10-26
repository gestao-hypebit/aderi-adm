-- ============================================================
-- Consultor acompanha os próprios pedidos
-- O consultor passa a ver as cargas (entregas) dos pedidos que ele criou, só leitura.
-- Registrar, editar e excluir carga continua só com a gestão (policy admin_pedido_entregas).
-- Rollback: supabase/rollback/20261026090000_consultor_ve_pedidos_down.sql
-- ============================================================

CREATE POLICY "consultor_ve_pedido_entregas" ON public.pedido_entregas
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cotacoes c WHERE c.id = cotacao_id AND c.criado_por = auth.uid()));

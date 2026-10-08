-- ============================================================
-- Entregas parceladas do pedido (cargas)
-- Um pedido de 130 t pode sair em várias cargas. Cada carga registra produto e quantidade;
-- o saldo é pedido − entregue, por produto. A situação do pedido acompanha sozinha:
-- primeira carga → "parcial"; todo o saldo entregue → "entregue".
-- Pedidos são da gestão: só admin vê e registra.
-- Rollback: supabase/rollback/20261010090000_pedido_entregas_down.sql
-- ============================================================

-- ── 1. Nova situação "parcial" ─────────────────────────────
ALTER TABLE public.cotacoes DROP CONSTRAINT IF EXISTS cotacoes_pedido_status_check;
ALTER TABLE public.cotacoes ADD CONSTRAINT cotacoes_pedido_status_check
  CHECK (pedido_status IN ('aguardando', 'faturado', 'parcial', 'entregue', 'cancelado'));

-- ── 2. Cargas ──────────────────────────────────────────────
-- Ligadas ao produto pelo nome (os itens da cotação são regravados a cada salvamento e mudam de id)
CREATE TABLE public.pedido_entregas (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cotacao_id    uuid        NOT NULL REFERENCES public.cotacoes(id) ON DELETE CASCADE,
  produto_nome  text        NOT NULL,
  unidade       text,
  quantidade    numeric     NOT NULL CHECK (quantidade > 0),
  data          date        NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  nota_fiscal   text,
  transportador text,
  motorista     text,
  placa         text,
  observacao    text,
  criado_por    uuid        DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX pedido_entregas_cotacao_idx ON public.pedido_entregas (cotacao_id, data);

ALTER TABLE public.pedido_entregas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_pedido_entregas" ON public.pedido_entregas
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── 3. Situação do pedido segue as cargas ──────────────────
CREATE OR REPLACE FUNCTION public.atualizar_entrega_pedido()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  cot uuid := coalesce(NEW.cotacao_id, OLD.cotacao_id);
  qtd_cargas int;
  ultima date;
  completo boolean;
BEGIN
  SELECT count(*), max(data) INTO qtd_cargas, ultima FROM public.pedido_entregas WHERE cotacao_id = cot;

  -- completo = nenhum produto com saldo
  SELECT NOT EXISTS (
    SELECT 1
    FROM (SELECT upper(trim(produto_nome)) AS k, sum(quantidade) AS q FROM public.cotacao_itens WHERE cotacao_id = cot GROUP BY 1) i
    LEFT JOIN (SELECT upper(trim(produto_nome)) AS k, sum(quantidade) AS q FROM public.pedido_entregas WHERE cotacao_id = cot GROUP BY 1) e USING (k)
    WHERE coalesce(e.q, 0) < i.q - 0.0001
  ) INTO completo;

  UPDATE public.cotacoes c SET
    pedido_status = CASE
      WHEN c.pedido_status = 'cancelado' THEN c.pedido_status
      WHEN qtd_cargas = 0 THEN CASE WHEN c.pedido_status IN ('parcial', 'entregue')
                                    THEN CASE WHEN c.nota_fiscal IS NOT NULL OR c.faturado_em IS NOT NULL THEN 'faturado' ELSE 'aguardando' END
                                    ELSE c.pedido_status END
      WHEN completo THEN 'entregue'
      ELSE 'parcial' END,
    entregue_em = CASE WHEN qtd_cargas > 0 AND completo THEN ultima WHEN qtd_cargas > 0 THEN NULL ELSE c.entregue_em END
  WHERE c.id = cot;

  RETURN NULL;
END;
$$;

CREATE TRIGGER atualizar_entrega_pedido
  AFTER INSERT OR UPDATE OR DELETE ON public.pedido_entregas
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_entrega_pedido();

-- ============================================================
-- Cotações: datas de entrada nas etapas que ainda não eram guardadas
--  · aprovacao_pedida_em: quando o consultor enviou para a gestão aprovar
--  · perdida_em: quando a cotação foi marcada como perdida
-- (aprovado_em, enviada_em e efetivada_em já existem)
-- Servem para o relatório de acompanhamento: tempo em cada etapa e cotações paradas.
-- Rollback: supabase/rollback/20261009150000_cotacao_datas_etapas_down.sql
-- ============================================================

ALTER TABLE public.cotacoes
  ADD COLUMN aprovacao_pedida_em timestamptz,
  ADD COLUMN perdida_em timestamptz;

CREATE OR REPLACE FUNCTION public.cotacoes_datas()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.aprovacao_status = 'pendente' AND (TG_OP = 'INSERT' OR OLD.aprovacao_status IS DISTINCT FROM 'pendente') THEN
    NEW.aprovacao_pedida_em := now();
  END IF;
  IF NEW.status = 'perdida' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'perdida') THEN
    NEW.perdida_em := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER cotacoes_datas
  BEFORE INSERT OR UPDATE ON public.cotacoes
  FOR EACH ROW EXECUTE FUNCTION public.cotacoes_datas();

-- Cotações que já estão nessas etapas: melhor estimativa é a última alteração
UPDATE public.cotacoes SET aprovacao_pedida_em = coalesce(updated_at, created_at) WHERE aprovacao_status = 'pendente' AND aprovacao_pedida_em IS NULL;
UPDATE public.cotacoes SET perdida_em = coalesce(updated_at, created_at) WHERE status = 'perdida' AND perdida_em IS NULL;

-- ============================================================
-- Cotações (baseado na planilha "PLANILHA DE COTAÇÃO ADERI - VERDE AGRO")
-- Cadastro de produtos + cotações com itens. Consultor vê/edita as próprias,
-- admin vê todas. Produtos: todos leem, só admin altera.
-- Rollback: supabase/rollback/20261007150000_cotacoes_down.sql
-- ============================================================

-- ── 1. Produtos ────────────────────────────────────────────
CREATE TABLE public.produtos (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome          text        NOT NULL,
  fornecedor    text,
  unidade       text        NOT NULL DEFAULT 'TON',
  preco_tabela  numeric     NOT NULL DEFAULT 0,
  observacoes   text,
  ativo         boolean     NOT NULL DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_produtos" ON public.produtos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_insert_produtos" ON public.produtos
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin_update_produtos" ON public.produtos
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_delete_produtos" ON public.produtos
  FOR DELETE TO authenticated USING (public.is_admin());

-- ── 2. Cotações ────────────────────────────────────────────
-- Número no formato da planilha: ANO.sequencial (ex.: 2026.00012)
CREATE SEQUENCE public.cotacoes_numero_seq;

CREATE TABLE public.cotacoes (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero              text        NOT NULL UNIQUE
                        DEFAULT (extract(year FROM now())::int || '.' || lpad(nextval('public.cotacoes_numero_seq')::text, 5, '0')),
  status              text        NOT NULL DEFAULT 'rascunho'
                        CHECK (status IN ('rascunho', 'enviada', 'aprovada', 'perdida')),
  cliente_id          uuid        REFERENCES public.clientes(id) ON DELETE SET NULL,
  criado_por          uuid        NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  -- dados do cliente congelados no momento da cotação (vão para os documentos)
  cliente_nome        text,
  empresa_rural       text,
  cidade              text,
  cpf_cnpj            text,
  inscricao_produtor  text,
  contato             text,
  -- parâmetros de cálculo
  ptax                numeric     NOT NULL DEFAULT 1,
  juros_mes           numeric     NOT NULL DEFAULT 0.022,
  aliquota_icms       numeric     NOT NULL DEFAULT 0.05,
  aliquota_ir         numeric     NOT NULL DEFAULT 0.30,
  -- textos
  observacoes         text,       -- observações internas da cotação
  observacoes_cliente text,       -- vão no orçamento
  transportador       text,       -- pedido do cliente
  obs_pedido          text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX cotacoes_criado_por_idx ON public.cotacoes (criado_por);
CREATE INDEX cotacoes_cliente_idx    ON public.cotacoes (cliente_id);

ALTER TABLE public.cotacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_cotacoes" ON public.cotacoes
  FOR SELECT TO authenticated USING (criado_por = auth.uid() OR public.is_admin());
CREATE POLICY "insert_cotacoes" ON public.cotacoes
  FOR INSERT TO authenticated WITH CHECK (criado_por = auth.uid() OR public.is_admin());
CREATE POLICY "update_cotacoes" ON public.cotacoes
  FOR UPDATE TO authenticated
  USING (criado_por = auth.uid() OR public.is_admin())
  WITH CHECK (criado_por = auth.uid() OR public.is_admin());
CREATE POLICY "delete_cotacoes" ON public.cotacoes
  FOR DELETE TO authenticated USING (criado_por = auth.uid() OR public.is_admin());

-- ── 3. Itens da cotação (uma linha da planilha) ────────────
CREATE TABLE public.cotacao_itens (
  id             uuid    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cotacao_id     uuid    NOT NULL REFERENCES public.cotacoes(id) ON DELETE CASCADE,
  ordem          int     NOT NULL DEFAULT 0,
  produto_id     uuid    REFERENCES public.produtos(id) ON DELETE SET NULL,
  produto_nome   text    NOT NULL,
  fornecedor     text,
  quantidade     numeric NOT NULL DEFAULT 0,
  unidade        text,
  preco_tabela   numeric NOT NULL DEFAULT 0,
  desconto       numeric NOT NULL DEFAULT 0,
  frete          numeric NOT NULL DEFAULT 0,
  data_inicial   date,
  data_final     date,
  margem         numeric NOT NULL DEFAULT 0,
  comissao       numeric NOT NULL DEFAULT 0,
  preco_cliente  numeric NOT NULL DEFAULT 0,
  vencimento     date
);

CREATE INDEX cotacao_itens_cotacao_idx ON public.cotacao_itens (cotacao_id, ordem);

ALTER TABLE public.cotacao_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "itens_da_cotacao" ON public.cotacao_itens
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cotacoes c
    WHERE c.id = cotacao_id AND (c.criado_por = auth.uid() OR public.is_admin())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.cotacoes c
    WHERE c.id = cotacao_id AND (c.criado_por = auth.uid() OR public.is_admin())
  ));

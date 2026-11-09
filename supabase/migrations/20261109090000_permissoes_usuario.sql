-- ============================================================
-- Permissões por tela para usuários da administração
--  · profiles.permissoes NULL  → administrador completo (como sempre foi)
--  · profiles.permissoes [...] → acesso personalizado: só as telas listadas
-- As chaves são as de lib/permissoes.ts (TELAS). O banco confere o mesmo acesso:
-- quem só tem "metas_importar" não lê nem grava cotações, visitas etc., mesmo fora das telas.
-- Rollback: supabase/rollback/20261109090000_permissoes_usuario_down.sql
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS permissoes text[];

-- ── 1. Helpers ─────────────────────────────────────────────
-- is_admin() passa a ser só o administrador COMPLETO (sem lista de permissões).
CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND ativo AND permissoes IS NULL
  );
$$;

-- pode('a', 'b'): administrador completo, ou administrador com alguma dessas telas liberada
CREATE OR REPLACE FUNCTION public.pode(VARIADIC chaves text[])
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND ativo
      AND (permissoes IS NULL OR permissoes && chaves)
  );
$$;
REVOKE ALL ON FUNCTION public.pode(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode(text[]) TO authenticated, service_role;

-- ── 2. profiles: só o administrador completo muda papel, status e permissões ──
CREATE OR REPLACE FUNCTION public.proteger_role_profile()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.ativo IS DISTINCT FROM OLD.ativo
      OR NEW.permissoes IS DISTINCT FROM OLD.permissoes)
     AND auth.uid() IS NOT NULL
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Sem permissão para alterar o papel, o status ou as permissões do usuário';
  END IF;
  RETURN NEW;
END;
$$;

-- Tela de usuários (consultores) edita nome, cargo e telefone; papel e acesso o trigger acima barra
CREATE POLICY "pode_update_profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (public.pode('consultores')) WITH CHECK (public.pode('consultores'));

-- ── 3. Visitas, KM e clientes ──────────────────────────────
CREATE POLICY "pode_select_visitas" ON public.visitas FOR SELECT TO authenticated
  USING (public.pode('painel', 'agenda', 'visitas', 'clientes', 'consultores', 'relatorios'));
CREATE POLICY "pode_visitas" ON public.visitas FOR ALL TO authenticated
  USING (public.pode('agenda', 'visitas')) WITH CHECK (public.pode('agenda', 'visitas'));

CREATE POLICY "pode_visita_fotos" ON public.visita_fotos FOR ALL TO authenticated
  USING (public.pode('agenda', 'visitas', 'clientes', 'consultores')) WITH CHECK (public.pode('agenda', 'visitas'));

CREATE POLICY "pode_select_km" ON public.km_diario FOR SELECT TO authenticated
  USING (public.pode('painel', 'consultores', 'relatorios'));
CREATE POLICY "pode_select_abastecimento" ON public.abastecimentos FOR SELECT TO authenticated
  USING (public.pode('painel', 'consultores', 'relatorios'));

CREATE POLICY "pode_select_clientes" ON public.clientes FOR SELECT TO authenticated
  USING (public.pode('painel', 'agenda', 'visitas', 'clientes', 'consultores', 'cotacoes', 'aprovacoes', 'orcamentos',
                     'pedidos', 'acompanhamento', 'relatorios', 'metas_vendas', 'metas_lancamentos'));
CREATE POLICY "pode_clientes" ON public.clientes FOR ALL TO authenticated
  USING (public.pode('clientes', 'consultores')) WITH CHECK (public.pode('clientes', 'consultores'));
-- Cotação e visita cadastram cliente na hora / gravam a localização do check-in
CREATE POLICY "pode_insert_clientes" ON public.clientes FOR INSERT TO authenticated
  WITH CHECK (public.pode('cotacoes', 'visitas'));
CREATE POLICY "pode_update_clientes_visita" ON public.clientes FOR UPDATE TO authenticated
  USING (public.pode('visitas')) WITH CHECK (public.pode('visitas'));
-- cliente_contatos segue o acesso ao cliente (policy "contatos_do_cliente"), nada a fazer

-- Só quem cuida da carteira define/transfere o responsável do cliente
CREATE OR REPLACE FUNCTION public.proteger_responsavel_cliente()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.pode('clientes', 'consultores') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.responsavel_id := auth.uid();
  ELSIF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id THEN
    NEW.responsavel_id := OLD.responsavel_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ── 4. Cotações, pedidos e produtos ────────────────────────
CREATE POLICY "pode_select_cotacoes" ON public.cotacoes FOR SELECT TO authenticated
  USING (public.pode('painel', 'clientes', 'consultores', 'cotacoes', 'aprovacoes', 'orcamentos', 'pedidos',
                     'acompanhamento', 'relatorios', 'metas_painel'));
CREATE POLICY "pode_cotacoes" ON public.cotacoes FOR ALL TO authenticated
  USING (public.pode('cotacoes', 'aprovacoes', 'orcamentos', 'pedidos'))
  WITH CHECK (public.pode('cotacoes', 'aprovacoes', 'orcamentos', 'pedidos'));

CREATE POLICY "pode_cotacao_itens" ON public.cotacao_itens FOR ALL TO authenticated
  USING (public.pode('clientes', 'cotacoes', 'aprovacoes', 'orcamentos', 'pedidos', 'acompanhamento', 'relatorios'))
  WITH CHECK (public.pode('cotacoes', 'aprovacoes', 'orcamentos', 'pedidos'));

CREATE POLICY "pode_pedido_entregas" ON public.pedido_entregas FOR ALL TO authenticated
  USING (public.pode('cotacoes', 'pedidos', 'acompanhamento')) WITH CHECK (public.pode('cotacoes', 'pedidos'));

CREATE POLICY "pode_produtos" ON public.produtos FOR ALL TO authenticated
  USING (public.pode('produtos')) WITH CHECK (public.pode('produtos'));

-- Parâmetros (margem mínima das cotações e parâmetros de metas)
CREATE POLICY "pode_update_configuracoes" ON public.configuracoes FOR UPDATE TO authenticated
  USING (public.pode('aprovacoes', 'metas_configuracoes')) WITH CHECK (public.pode('aprovacoes', 'metas_configuracoes'));

-- Aprovar/reprovar cotação (a "gestão") passa a ser quem tem a tela de Aprovações.
-- Corpo igual ao de 20261009120000_aprovacao_obrigatoria.sql, só muda o eh_admin.
CREATE OR REPLACE FUNCTION public.cotacoes_regras()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  eh_admin boolean := auth.uid() IS NULL OR public.pode('aprovacoes');
  mudou_status boolean := TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status;
BEGIN
  IF NEW.status = 'enviada' AND mudou_status AND NEW.enviada_em IS NULL THEN
    NEW.enviada_em := now();
  END IF;

  IF NEW.status = 'perdida' AND coalesce(trim(NEW.motivo_perda), '') = '' THEN
    RAISE EXCEPTION 'Informe o motivo da perda da cotação';
  END IF;

  -- Cliente aprovou: abre o pedido
  IF NEW.status = 'efetivada' AND mudou_status THEN
    NEW.efetivada_em := coalesce(NEW.efetivada_em, now());
    IF NEW.pedido_status IS NULL THEN
      NEW.pedido_status := 'aguardando';
      NEW.pagamento_status := coalesce(NEW.pagamento_status, 'em_aberto');
    END IF;
  END IF;

  -- Aprovação da gestão: obrigatória para aprovar, enviar e efetivar
  IF NEW.status IN ('aprovada', 'enviada', 'efetivada') AND mudou_status THEN
    IF eh_admin THEN
      IF auth.uid() IS NOT NULL AND (NEW.status = 'aprovada' OR NOT coalesce(public.cotacao_coberta(NEW.id), false)) THEN
        NEW.aprovacao_status := 'aprovada';
        NEW.aprovado_por := auth.uid();
        NEW.aprovado_em := now();
        NEW.aprovacao_margem := public.cotacao_margem_minima(NEW.id);
      END IF;
    ELSIF NEW.status = 'aprovada' THEN
      RAISE EXCEPTION 'Somente a gestão pode aprovar a cotação';
    ELSIF NOT coalesce(public.cotacao_coberta(NEW.id), false) THEN
      RAISE EXCEPTION 'A cotação precisa ser aprovada pela gestão antes de enviar o orçamento ao cliente';
    END IF;
  END IF;

  IF NOT eh_admin THEN
    -- consultor só pode pedir aprovação (pendente) ou limpar; decisão é da gestão
    IF TG_OP = 'INSERT' THEN
      IF NEW.aprovacao_status IN ('aprovada', 'reprovada') THEN NEW.aprovacao_status := NULL; END IF;
      NEW.aprovado_por := NULL; NEW.aprovado_em := NULL; NEW.aprovacao_margem := NULL;
    ELSE
      IF NEW.aprovacao_status IN ('aprovada', 'reprovada') AND NEW.aprovacao_status IS DISTINCT FROM OLD.aprovacao_status THEN
        NEW.aprovacao_status := OLD.aprovacao_status;
      END IF;
      NEW.aprovado_por := OLD.aprovado_por; NEW.aprovado_em := OLD.aprovado_em; NEW.aprovacao_margem := OLD.aprovacao_margem;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Corpo igual ao de 20261104090000_cotacao_descarga.sql, só muda a checagem da gestão
CREATE OR REPLACE FUNCTION public.salvar_itens_cotacao(p_cotacao uuid, p_itens jsonb)
  RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public'
AS $$
DECLARE
  st text;
BEGIN
  SELECT status INTO st FROM public.cotacoes WHERE id = p_cotacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotação não encontrada'; END IF;

  DELETE FROM public.cotacao_itens WHERE cotacao_id = p_cotacao;
  INSERT INTO public.cotacao_itens (cotacao_id, ordem, produto_id, produto_nome, fornecedor, quantidade, unidade, preco_tabela,
                                    desconto, frete, descarga, data_inicial, data_final, margem, comissao, preco_cliente, vencimento, vencimento_obs)
  SELECT p_cotacao, x.ordem, x.produto_id, x.produto_nome, x.fornecedor, coalesce(x.quantidade, 0), x.unidade, coalesce(x.preco_tabela, 0),
         coalesce(x.desconto, 0), coalesce(x.frete, 0), coalesce(x.descarga, 0), x.data_inicial, x.data_final, coalesce(x.margem, 0), coalesce(x.comissao, 0),
         coalesce(x.preco_cliente, 0), x.vencimento, coalesce(x.vencimento_obs, false)
  FROM jsonb_to_recordset(p_itens) AS x(ordem int, produto_id uuid, produto_nome text, fornecedor text, quantidade numeric, unidade text,
       preco_tabela numeric, desconto numeric, frete numeric, descarga numeric, data_inicial date, data_final date, margem numeric, comissao numeric,
       preco_cliente numeric, vencimento date, vencimento_obs boolean);

  IF st IN ('aprovada', 'enviada', 'efetivada') AND NOT public.pode('aprovacoes') AND NOT coalesce(public.cotacao_coberta(p_cotacao), false) THEN
    RAISE EXCEPTION 'Preço abaixo do aprovado pela gestão: envie a cotação para aprovação de novo';
  END IF;
END;
$$;

-- ── 5. Metas ───────────────────────────────────────────────
-- Cadastros (unidades, grupos, consultores comerciais): leitura já é livre
CREATE POLICY "pode_unidades_negocio"       ON public.unidades_negocio       FOR ALL TO authenticated
  USING (public.pode('metas_configuracoes')) WITH CHECK (public.pode('metas_configuracoes'));
CREATE POLICY "pode_grupos_produto"         ON public.grupos_produto         FOR ALL TO authenticated
  USING (public.pode('metas_configuracoes')) WITH CHECK (public.pode('metas_configuracoes'));
CREATE POLICY "pode_consultores_comerciais" ON public.consultores_comerciais FOR ALL TO authenticated
  USING (public.pode('metas_configuracoes')) WITH CHECK (public.pode('metas_configuracoes'));

CREATE POLICY "pode_select_metas" ON public.metas FOR SELECT TO authenticated
  USING (public.pode('metas_painel', 'metas_comissoes', 'metas_cadastro'));
CREATE POLICY "pode_metas" ON public.metas FOR ALL TO authenticated
  USING (public.pode('metas_cadastro')) WITH CHECK (public.pode('metas_cadastro'));

CREATE POLICY "pode_select_realizado_historico" ON public.realizado_historico FOR SELECT TO authenticated
  USING (public.pode('metas_painel', 'metas_comissoes', 'metas_cadastro'));
CREATE POLICY "pode_realizado_historico" ON public.realizado_historico FOR ALL TO authenticated
  USING (public.pode('metas_cadastro')) WITH CHECK (public.pode('metas_cadastro'));

CREATE POLICY "pode_select_importacoes" ON public.importacoes FOR SELECT TO authenticated
  USING (public.pode('metas_importar', 'metas_lancamentos', 'metas_vendas'));
CREATE POLICY "pode_importacoes" ON public.importacoes FOR ALL TO authenticated
  USING (public.pode('metas_importar')) WITH CHECK (public.pode('metas_importar'));

CREATE POLICY "pode_select_mapeamento_nomes" ON public.mapeamento_nomes FOR SELECT TO authenticated
  USING (public.pode('metas_painel', 'metas_lancamentos', 'metas_vendas', 'metas_comissoes', 'metas_importar', 'metas_cadastro', 'metas_configuracoes'));
CREATE POLICY "pode_mapeamento_nomes" ON public.mapeamento_nomes FOR ALL TO authenticated
  USING (public.pode('metas_importar', 'metas_configuracoes')) WITH CHECK (public.pode('metas_importar', 'metas_configuracoes'));

CREATE POLICY "pode_select_vendas" ON public.vendas FOR SELECT TO authenticated
  USING (public.pode('metas_painel', 'metas_comissoes', 'metas_cadastro', 'relatorios'));
CREATE POLICY "pode_vendas" ON public.vendas FOR ALL TO authenticated
  USING (public.pode('metas_importar', 'metas_lancamentos', 'metas_vendas'))
  WITH CHECK (public.pode('metas_importar', 'metas_lancamentos', 'metas_vendas'));

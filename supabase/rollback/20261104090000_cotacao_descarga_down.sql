-- Desfaz 20261104090000_cotacao_descarga.sql (os valores de descarga digitados são perdidos)

CREATE OR REPLACE FUNCTION public.cotacao_margem_minima(cot uuid)
  RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT min(public.margem_liquida_item(i.preco_cliente, i.preco_tabela, i.desconto, i.frete, i.margem, i.comissao,
                                        i.data_inicial, i.data_final, c.ptax, c.juros_mes, c.aliquota_icms, c.aliquota_ir))
  FROM public.cotacao_itens i JOIN public.cotacoes c ON c.id = i.cotacao_id
  WHERE i.cotacao_id = cot AND i.preco_cliente > 0;
$$;

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
                                    desconto, frete, data_inicial, data_final, margem, comissao, preco_cliente, vencimento, vencimento_obs)
  SELECT p_cotacao, x.ordem, x.produto_id, x.produto_nome, x.fornecedor, coalesce(x.quantidade, 0), x.unidade, coalesce(x.preco_tabela, 0),
         coalesce(x.desconto, 0), coalesce(x.frete, 0), x.data_inicial, x.data_final, coalesce(x.margem, 0), coalesce(x.comissao, 0),
         coalesce(x.preco_cliente, 0), x.vencimento, coalesce(x.vencimento_obs, false)
  FROM jsonb_to_recordset(p_itens) AS x(ordem int, produto_id uuid, produto_nome text, fornecedor text, quantidade numeric, unidade text,
       preco_tabela numeric, desconto numeric, frete numeric, data_inicial date, data_final date, margem numeric, comissao numeric,
       preco_cliente numeric, vencimento date, vencimento_obs boolean);

  IF st IN ('aprovada', 'enviada', 'efetivada') AND NOT public.is_admin() AND NOT coalesce(public.cotacao_coberta(p_cotacao), false) THEN
    RAISE EXCEPTION 'Preço abaixo do aprovado pela gestão: envie a cotação para aprovação de novo';
  END IF;
END;
$$;

ALTER TABLE public.cotacao_itens DROP COLUMN IF EXISTS descarga;

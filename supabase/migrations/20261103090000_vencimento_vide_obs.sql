-- Vencimento "Vide OBS": quando o pagamento é dividido em várias parcelas,
-- o item não tem uma data única e o documento remete às observações.

ALTER TABLE public.cotacao_itens ADD COLUMN IF NOT EXISTS vencimento_obs boolean NOT NULL DEFAULT false;

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

CREATE OR REPLACE FUNCTION public.orcamento_publico(token uuid)
  RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'numero', c.numero, 'created_at', c.created_at, 'validade', c.validade, 'status', c.status,
    'cliente_nome', c.cliente_nome, 'empresa_rural', c.empresa_rural, 'cidade', c.cidade, 'cpf_cnpj', c.cpf_cnpj,
    'inscricao_produtor', c.inscricao_produtor, 'contato', c.contato, 'observacoes_cliente', c.observacoes_cliente,
    'consultor', json_build_object('nome', p.nome_completo, 'telefone', p.telefone),
    'itens', coalesce((SELECT json_agg(json_build_object('produto', i.produto_nome, 'quantidade', i.quantidade, 'unidade', i.unidade,
                                                         'preco', i.preco_cliente, 'vencimento', coalesce(i.vencimento, i.data_final),
                                                         'vencimento_obs', i.vencimento_obs) ORDER BY i.ordem)
                       FROM public.cotacao_itens i WHERE i.cotacao_id = c.id), '[]'::json)
  )
  FROM public.cotacoes c
  LEFT JOIN public.profiles p ON p.id = c.criado_por
  WHERE c.token_publico = token AND c.status IN ('aprovada', 'enviada', 'efetivada');
$$;

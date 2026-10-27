// Cálculos da venda — espelho da planilha mensal "00X - MÊS - 26 AD".
// Letras entre colchetes indicam a coluna correspondente na planilha.
// Nada é arredondado no meio da conta (só na exibição), senão a comissão do caso real
// sai 64,73 em vez de 64,72.

export type ParametrosVenda = {
  taxa_juros_mensal: number // [T22] ex.: 0,022 = 2,2% a.m.
  aliquota_imposto: number  // [AA] sobre o resultado bruto
  fator_comissao: number    // % comissão = margem líquida × fator
}

export type VendaCalculavel = ParametrosVenda & {
  quantidade: number                   // [E]
  preco_unitario: number               // [F]
  faturamento?: number | null          // [G] informado (importação); vazio = qtd × unitário
  custo_unitario: number | null        // [M] nulo = custo pendente
  frete_unitario: number | null        // [N]
  desconto_unitario: number | null     // [O]
  data_pagamento_compra: string | null // [R] AAAA-MM-DD
  data_recebimento: string | null      // [S]
  cancelada?: boolean
}

export type ResultadoVenda = {
  faturamento: number
  custo_pendente: boolean
  // Os campos abaixo ficam nulos quando o custo está pendente ou quando dividem por zero
  custo_unit_total: number | null
  total_compra: number | null
  dias_financiamento: number
  custo_financeiro: number | null
  custo_total: number | null
  resultado_bruto: number | null
  margem_bruta: number | null
  imposto: number | null
  resultado_apos_imposto: number | null
  margem_liquida: number | null
  base_comissao: number | null
  percentual_comissao: number | null
  comissao: number | null
  lucro: number | null
  lucro_pct: number | null
}

export const PARAMETROS_VENDA_PADRAO: ParametrosVenda = { taxa_juros_mensal: 0.022, aliquota_imposto: 0.3, fator_comissao: 0.1 }

// Divisão por zero retorna vazio, não erro
const div = (a: number | null, b: number | null) => (a == null || !b ? null : a / b)

export function diasEntre(inicio: string | null, fim: string | null) {
  if (!inicio || !fim) return 0
  const d = Math.round((new Date(fim + 'T12:00').getTime() - new Date(inicio + 'T12:00').getTime()) / 86400000)
  return Number.isFinite(d) ? Math.max(0, d) : 0
}

// Custo zerado na planilha é custo não preenchido (não há venda com custo zero de verdade)
export const custoPendente = (custo: number | null | undefined) => custo == null || !(custo > 0)

export function calcularVenda(v: VendaCalculavel): ResultadoVenda {
  const q = v.quantidade || 0
  const frete = v.frete_unitario || 0
  const desconto = v.desconto_unitario || 0
  const faturamento = v.faturamento ?? q * (v.preco_unitario || 0)                   // [G]
  const dias = diasEntre(v.data_pagamento_compra, v.data_recebimento)
  // Sem quantidade (relatório de venda direta lançado só pelo valor) não há como calcular o custo
  const pendente = custoPendente(v.custo_unitario) || !(q > 0)

  if (pendente) {
    return {
      faturamento, custo_pendente: true, custo_unit_total: null, total_compra: null, dias_financiamento: dias,
      custo_financeiro: null, custo_total: null, resultado_bruto: null, margem_bruta: null, imposto: null,
      resultado_apos_imposto: null, margem_liquida: null, base_comissao: null, percentual_comissao: null,
      comissao: null, lucro: null, lucro_pct: null,
    }
  }

  // [P] A planilha SOMA o desconto ao custo; mantido igual.
  // TODO(cliente): confirmar se o desconto unitário deve mesmo somar ao custo.
  const custoUnitTotal = (v.custo_unitario as number) + frete + desconto
  const totalCompra = q * custoUnitTotal                                             // [Q]
  const custoFinanceiro = totalCompra * dias * ((v.taxa_juros_mensal || 0) / 30)
  const custoTotal = totalCompra + custoFinanceiro
  const resultadoBruto = faturamento - custoTotal
  // TODO(cliente): o imposto fica negativo quando a venda dá prejuízo (igual à planilha). Confirmar.
  const imposto = resultadoBruto * (v.aliquota_imposto || 0)
  const resultadoAposImposto = resultadoBruto - imposto
  const margemLiquida = div(resultadoAposImposto, faturamento)
  const baseComissao = (faturamento - imposto - custoFinanceiro) - q * (frete + desconto)
  // TODO(cliente): confirmar a regra de comissão (margem líquida × 10%).
  const percentualComissao = margemLiquida == null ? null : margemLiquida * (v.fator_comissao || 0)
  const comissao = percentualComissao == null ? null : baseComissao * percentualComissao
  const lucro = comissao == null ? null : faturamento - custoTotal - imposto - comissao

  return {
    faturamento,
    custo_pendente: false,
    custo_unit_total: custoUnitTotal,
    total_compra: totalCompra,
    dias_financiamento: dias,
    custo_financeiro: custoFinanceiro,
    custo_total: custoTotal,
    resultado_bruto: resultadoBruto,
    margem_bruta: div(resultadoBruto, faturamento),
    imposto,
    resultado_apos_imposto: resultadoAposImposto,
    margem_liquida: margemLiquida,
    base_comissao: baseComissao,
    percentual_comissao: percentualComissao,
    comissao,
    lucro,
    lucro_pct: div(lucro, faturamento),
  }
}

// Soma de várias vendas. Canceladas não contam em nada; custo pendente conta no realizado
// mas fica fora de lucro/comissão (e as margens são calculadas só sobre o faturamento com custo).
export type ResumoVendas = {
  realizado: number
  qtd_vendas: number
  qtd_custo_pendente: number
  faturamento_com_custo: number
  custo_total: number
  imposto: number
  comissao: number
  lucro: number
  margem_liquida: number | null
  lucro_pct: number | null
}

export function resumirVendas(vendas: VendaCalculavel[]): ResumoVendas {
  const r = { realizado: 0, qtd_vendas: 0, qtd_custo_pendente: 0, faturamento_com_custo: 0, custo_total: 0, imposto: 0, comissao: 0, lucro: 0, resultado_apos_imposto: 0 }
  for (const v of vendas) {
    if (v.cancelada) continue
    const c = calcularVenda(v)
    r.realizado += c.faturamento
    r.qtd_vendas++
    if (c.custo_pendente) { r.qtd_custo_pendente++; continue }
    r.faturamento_com_custo += c.faturamento
    r.custo_total += c.custo_total ?? 0
    r.imposto += c.imposto ?? 0
    r.comissao += c.comissao ?? 0
    r.lucro += c.lucro ?? 0
    r.resultado_apos_imposto += c.resultado_apos_imposto ?? 0
  }
  const { resultado_apos_imposto, ...resto } = r
  return { ...resto, margem_liquida: div(resultado_apos_imposto, r.faturamento_com_custo), lucro_pct: div(r.lucro, r.faturamento_com_custo) }
}

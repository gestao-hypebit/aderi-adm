import { calcularVenda, type VendaCalculavel } from './calculo'

// Edição de um valor calculado da venda (custo total, imposto, comissão...): descobre qual
// campo de entrada precisa mudar para chegar no valor digitado. O banco só guarda as entradas
// (custo, datas, juros, imposto, fator); os resultados continuam saindo de calculo.ts.
//
// Cada campo mexe sempre na mesma entrada, e essa entrada não entra na conta do próprio ajuste,
// então digitar "1", "12", "120" dá o mesmo resultado que digitar "120" direto.

export type CampoAjustavel =
  | 'custo_unit_total' | 'total_compra' | 'dias_financiamento' | 'custo_financeiro' | 'custo_total'
  | 'resultado_bruto' | 'margem_bruta' | 'imposto' | 'resultado_apos_imposto' | 'margem_liquida'
  | 'percentual_comissao' | 'comissao'

export type Ajuste = Partial<Pick<VendaCalculavel,
  'custo_unitario' | 'taxa_juros_mensal' | 'aliquota_imposto' | 'fator_comissao' | 'data_pagamento_compra' | 'data_recebimento'>>

// O que cada campo ajusta, para explicar na tela
export const AJUSTA: Record<CampoAjustavel, string> = {
  custo_unit_total: 'ajusta o custo unitário',
  total_compra: 'ajusta o custo unitário',
  dias_financiamento: 'ajusta a data de recebimento',
  custo_financeiro: 'ajusta os juros',
  custo_total: 'ajusta o custo unitário',
  resultado_bruto: 'ajusta o custo unitário',
  margem_bruta: 'ajusta o custo unitário',
  imposto: 'ajusta a alíquota de imposto',
  resultado_apos_imposto: 'ajusta o custo unitário',
  margem_liquida: 'ajusta o custo unitário',
  percentual_comissao: 'ajusta o fator de comissão',
  comissao: 'ajusta o fator de comissão',
}

const somarDias = (data: string, dias: number) => {
  const d = new Date(data + 'T12:00')
  d.setDate(d.getDate() + Math.round(dias))
  return d.toLocaleDateString('sv-SE')
}
const ok = (n: number) => Number.isFinite(n)

// Custo unitário que leva o custo total (compra + financeiro) ao valor pedido
function custoPorCustoTotal(v: VendaCalculavel, custoTotal: number): Ajuste | null {
  const q = v.quantidade || 0
  if (!(q > 0)) return null
  const c = calcularVenda(v)
  const fatorFin = 1 + c.dias_financiamento * ((v.taxa_juros_mensal || 0) / 30)
  if (!fatorFin) return null
  return custoUnitario(v, custoTotal / (q * fatorFin))
}

// Custo zerado ou negativo deixaria a venda "sem custo": não aceita
function custoUnitario(v: VendaCalculavel, custoUnitTotal: number): Ajuste | null {
  const custo = custoUnitTotal - (v.frete_unitario || 0) - (v.desconto_unitario || 0)
  return ok(custo) && custo > 0 ? { custo_unitario: custo } : null
}

// Devolve nulo quando não há como chegar no valor (ex.: sem custo, divisão por zero)
export function ajustarResultado(v: VendaCalculavel, campo: CampoAjustavel, alvo: number): Ajuste | null {
  if (!ok(alvo)) return null
  const c = calcularVenda(v)
  const q = v.quantidade || 0
  const fat = c.faturamento
  const aliq = v.aliquota_imposto || 0

  switch (campo) {
    case 'dias_financiamento':
      if (v.data_pagamento_compra) return { data_recebimento: somarDias(v.data_pagamento_compra, alvo) }
      if (v.data_recebimento) return { data_pagamento_compra: somarDias(v.data_recebimento, -alvo) }
      return null
    case 'custo_unit_total':
      return custoUnitario(v, alvo)
    case 'total_compra':
      return q > 0 ? custoUnitario(v, alvo / q) : null
    case 'custo_total':
      return custoPorCustoTotal(v, alvo)
    case 'resultado_bruto':
      return custoPorCustoTotal(v, fat - alvo)
    case 'margem_bruta':
      return custoPorCustoTotal(v, fat - alvo * fat)
    case 'resultado_apos_imposto':
      return aliq === 1 ? null : custoPorCustoTotal(v, fat - alvo / (1 - aliq))
    case 'margem_liquida':
      return aliq === 1 ? null : custoPorCustoTotal(v, fat - (alvo * fat) / (1 - aliq))
  }

  if (c.custo_pendente) return null
  switch (campo) {
    case 'custo_financeiro': {
      const base = (c.total_compra ?? 0) * c.dias_financiamento
      return base ? { taxa_juros_mensal: (alvo * 30) / base } : null
    }
    case 'imposto':
      return c.resultado_bruto ? { aliquota_imposto: alvo / c.resultado_bruto } : null
    case 'percentual_comissao':
      return c.margem_liquida ? { fator_comissao: alvo / c.margem_liquida } : null
    case 'comissao': {
      const por = (c.base_comissao ?? 0) * (c.margem_liquida ?? 0)
      return por ? { fator_comissao: alvo / por } : null
    }
  }
  return null
}

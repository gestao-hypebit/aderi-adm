import { describe, expect, it } from 'vitest'
import { calcularVenda, diasEntre, resumirVendas, PARAMETROS_VENDA_PADRAO, type VendaCalculavel } from './calculo'

const r2 = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100)

// Caso real da planilha de setembro/2026
const casoReal: VendaCalculavel = {
  ...PARAMETROS_VENDA_PADRAO,
  quantidade: 16,
  preco_unitario: 2690,
  custo_unitario: 2458,
  frete_unitario: 130,
  desconto_unitario: 0,
  data_pagamento_compra: '2026-09-09',
  data_recebimento: '2026-09-30',
}

describe('calcularVenda: caso real "AD - 20.00.20"', () => {
  const c = calcularVenda(casoReal)
  it('faturamento', () => expect(r2(c.faturamento)).toBe(43040))
  it('custo unitário total e total da compra', () => {
    expect(c.custo_unit_total).toBe(2588)
    expect(c.total_compra).toBe(41408)
  })
  it('dias de financiamento', () => expect(c.dias_financiamento).toBe(21))
  it('custo financeiro', () => expect(r2(c.custo_financeiro)).toBe(637.68))
  it('custo total', () => expect(r2(c.custo_total)).toBe(42045.68))
  it('resultado bruto', () => expect(r2(c.resultado_bruto)).toBe(994.32))
  it('imposto', () => expect(r2(c.imposto)).toBe(298.3))
  it('resultado após imposto', () => expect(r2(c.resultado_apos_imposto)).toBe(696.02))
  it('base de comissão', () => expect(r2(c.base_comissao)).toBe(40024.02))
  it('comissão (sem arredondar no meio)', () => expect(r2(c.comissao)).toBe(64.72))
  it('lucro', () => expect(r2(c.lucro)).toBe(631.3))
  it('margens', () => {
    expect(c.margem_bruta).toBeCloseTo(994.3168 / 43040, 10)
    expect(c.margem_liquida).toBeCloseTo(696.02176 / 43040, 10)
    expect(c.percentual_comissao).toBeCloseTo((696.02176 / 43040) * 0.1, 10)
    expect(c.lucro_pct).toBeCloseTo(c.lucro! / 43040, 10)
  })
})

describe('calcularVenda: fórmulas', () => {
  it('desconto unitário soma ao custo (como a planilha)', () => {
    const c = calcularVenda({ ...casoReal, desconto_unitario: 10 })
    expect(c.custo_unit_total).toBe(2598)
    expect(c.total_compra).toBe(16 * 2598)
    // base desconta frete + desconto por unidade
    expect(r2(c.base_comissao)).toBe(r2(c.faturamento - c.imposto! - c.custo_financeiro! - 16 * 140))
  })

  it('custo financeiro usa a taxa gravada na venda', () => {
    const c = calcularVenda({ ...casoReal, taxa_juros_mensal: 0.03 })
    expect(r2(c.custo_financeiro)).toBe(r2(41408 * 21 * 0.001))
  })

  it('alíquota e fator de comissão gravados na venda', () => {
    const c = calcularVenda({ ...casoReal, aliquota_imposto: 0.2, fator_comissao: 0.05 })
    expect(c.imposto).toBeCloseTo(c.resultado_bruto! * 0.2, 10)
    expect(c.percentual_comissao).toBeCloseTo(c.margem_liquida! * 0.05, 10)
  })

  it('recebimento antes do pagamento não gera dias negativos', () => {
    const c = calcularVenda({ ...casoReal, data_pagamento_compra: '2026-09-30', data_recebimento: '2026-09-09' })
    expect(c.dias_financiamento).toBe(0)
    expect(c.custo_financeiro).toBe(0)
  })

  it('sem datas não há custo financeiro', () => {
    const c = calcularVenda({ ...casoReal, data_pagamento_compra: null, data_recebimento: null })
    expect(c.dias_financiamento).toBe(0)
    expect(c.custo_total).toBe(41408)
  })

  it('prejuízo deixa o imposto negativo (igual à planilha)', () => {
    const c = calcularVenda({ ...casoReal, preco_unitario: 2500 })
    expect(c.resultado_bruto!).toBeLessThan(0)
    expect(c.imposto!).toBeLessThan(0)
  })

  it('faturamento zero: divisões retornam vazio, sem erro', () => {
    const c = calcularVenda({ ...casoReal, preco_unitario: 0 })
    expect(c.faturamento).toBe(0)
    expect(c.margem_bruta).toBeNull()
    expect(c.margem_liquida).toBeNull()
    expect(c.percentual_comissao).toBeNull()
    expect(c.comissao).toBeNull()
    expect(c.lucro_pct).toBeNull()
  })

  it('custo pendente (nulo ou zero): só o faturamento é calculado', () => {
    for (const custo of [null, 0]) {
      const c = calcularVenda({ ...casoReal, custo_unitario: custo })
      expect(c.custo_pendente).toBe(true)
      expect(c.faturamento).toBe(43040)
      expect(c.lucro).toBeNull()
      expect(c.comissao).toBeNull()
      expect(c.custo_total).toBeNull()
    }
  })
})

describe('calcularVenda: faturamento informado', () => {
  it('usa o valor da planilha quando vier', () => {
    expect(calcularVenda({ ...casoReal, faturamento: 43000 }).faturamento).toBe(43000)
  })
  it('quantidade zero com valor (relatório de venda direta): conta no realizado, custo pendente', () => {
    const c = calcularVenda({ ...casoReal, quantidade: 0, preco_unitario: 53296.6, faturamento: 53296.6 })
    expect(c.faturamento).toBe(53296.6)
    expect(c.custo_pendente).toBe(true)
    expect(c.lucro).toBeNull()
  })
})

describe('diasEntre', () => {
  it('conta dias corridos', () => expect(diasEntre('2026-01-30', '2026-08-30')).toBe(212))
  it('data inválida vira zero', () => expect(diasEntre('xx', '2026-01-01')).toBe(0))
})

describe('resumirVendas', () => {
  it('cancelada não conta; custo pendente conta só no realizado', () => {
    const r = resumirVendas([
      casoReal,
      { ...casoReal, custo_unitario: null },
      { ...casoReal, cancelada: true },
    ])
    expect(r.qtd_vendas).toBe(2)
    expect(r.qtd_custo_pendente).toBe(1)
    expect(r2(r.realizado)).toBe(86080)
    expect(r2(r.faturamento_com_custo)).toBe(43040)
    expect(r2(r.lucro)).toBe(631.3)
    expect(r2(r.comissao)).toBe(64.72)
    expect(r.lucro_pct).toBeCloseTo(calcularVenda(casoReal).lucro_pct!, 10)
  })

  it('lista vazia não divide por zero', () => {
    const r = resumirVendas([])
    expect(r.realizado).toBe(0)
    expect(r.margem_liquida).toBeNull()
    expect(r.lucro_pct).toBeNull()
  })
})

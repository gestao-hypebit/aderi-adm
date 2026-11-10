import { describe, expect, it } from 'vitest'
import { ajustarResultado, type CampoAjustavel } from './ajusteReverso'
import { calcularVenda, PARAMETROS_VENDA_PADRAO, type VendaCalculavel } from './calculo'

const venda: VendaCalculavel = {
  ...PARAMETROS_VENDA_PADRAO,
  quantidade: 16,
  preco_unitario: 2690,
  custo_unitario: 2458,
  frete_unitario: 130,
  desconto_unitario: 0,
  data_pagamento_compra: '2026-09-09',
  data_recebimento: '2026-09-30',
}

const casos: [CampoAjustavel, number][] = [
  ['custo_unit_total', 2500],
  ['total_compra', 40000],
  ['dias_financiamento', 30],
  ['custo_financeiro', 500],
  ['custo_total', 41000],
  ['resultado_bruto', 2000],
  ['margem_bruta', 0.05],
  ['imposto', 400],
  ['resultado_apos_imposto', 1000],
  ['margem_liquida', 0.03],
  ['percentual_comissao', 0.002],
  ['comissao', 100],
]

describe('ajustarResultado: depois do ajuste, a conta dá o valor digitado', () => {
  for (const [campo, alvo] of casos) {
    it(campo, () => {
      const ajuste = ajustarResultado(venda, campo, alvo)
      expect(ajuste).not.toBeNull()
      const c = calcularVenda({ ...venda, ...ajuste })
      expect(c[campo]).toBeCloseTo(alvo, 6)
    })
  }

  it('digitar aos poucos dá o mesmo que digitar de uma vez', () => {
    let v = venda
    for (const parcial of [1, 10, 100]) v = { ...v, ...ajustarResultado(v, 'comissao', parcial) }
    expect(v.fator_comissao).toBeCloseTo(ajustarResultado(venda, 'comissao', 100)!.fator_comissao!, 10)
  })

  it('não aceita custo que deixaria a venda sem custo', () => {
    expect(ajustarResultado(venda, 'custo_unit_total', 100)).toBeNull()
  })

  it('sem datas não dá para ajustar os dias', () => {
    expect(ajustarResultado({ ...venda, data_pagamento_compra: null, data_recebimento: null }, 'dias_financiamento', 10)).toBeNull()
  })

  it('sem custo, só ajustes que definem o custo funcionam', () => {
    const sem = { ...venda, custo_unitario: null }
    expect(ajustarResultado(sem, 'comissao', 50)).toBeNull()
    expect(ajustarResultado(sem, 'custo_total', 41000)).not.toBeNull()
  })
})

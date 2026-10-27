import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import fs from 'node:fs'
import path from 'node:path'
import { PARAMETROS_VENDA_PADRAO } from './calculo'
import { faixaAtingimento, montarPainel, type ValorMensal, type VendaPainel } from './painel'
import { lerPlanilhaConsultor } from './importacao/planilhaConsultor'
import { planilhaAd } from './importacao/planilhaAd'
import { resolverLeitura, type Cadastros } from './importacao/resolver'

const GRUPOS = ['Defensivos', 'Diversos', 'Fertilizantes', 'Foliares', 'Sementes'].map((nome, i) => ({ id: i + 1, nome }))
const UNIDADES = ['Aderi Agro', 'Gabriel', 'Gilvan', 'João Victor'].map((nome, i) => ({ id: i + 1, nome }))
const CONSULTORES = [
  { id: 'Aderi Agro', nome: 'Aderi Agro', unidade_id: 1 }, { id: 'Gabriel', nome: 'Gabriel', unidade_id: 2 },
  { id: 'Gilvan', nome: 'Gilvan', unidade_id: 3 }, { id: 'João Victor', nome: 'João Victor', unidade_id: 4 }, { id: 'Fabrício', nome: 'Fabrício', unidade_id: 4 },
]

const venda = (p: Partial<VendaPainel>): VendaPainel => ({
  ...PARAMETROS_VENDA_PADRAO, quantidade: 1, preco_unitario: 0, faturamento: 0, custo_unitario: null, frete_unitario: 0, desconto_unitario: 0,
  data_pagamento_compra: null, data_recebimento: null, competencia: '2026-01-01', unidade_id: 1, grupo_id: 1, consultor_id: 'Aderi Agro',
  cancelada: false, tipo: 'CONV', modalidade: 'VERDE_AGRO', toneladas: null, ...p,
})

describe('montarPainel (sintético)', () => {
  // Meta: 100 por mês na unidade 1 / grupo 1 → 1.200 no ano
  const metas: ValorMensal[] = Array.from({ length: 12 }, (_, i) => ({ unidade_id: 1, grupo_id: 1, mes: i + 1, valor: 100 }))
  const vendas = [
    venda({ competencia: '2026-01-01', faturamento: 150, tipo: 'DIF' }),
    venda({ competencia: '2026-02-01', faturamento: 50, modalidade: 'VENDA_DIRETA', toneladas: 2 }),
    venda({ competencia: '2026-03-01', faturamento: 999, cancelada: true }),
    venda({ competencia: '2026-04-01', faturamento: 400 }),            // depois do mês de referência
    venda({ competencia: '2025-12-01', faturamento: 700 }),            // outro ano
    venda({ competencia: '2026-02-01', faturamento: 80, unidade_id: 2, consultor_id: 'Gabriel', grupo_id: 2 }),
  ]
  const p = montarPainel({ filtro: { ano: 2026, mes_ref: 3 }, metas, vendas, anterior: [{ unidade_id: 1, grupo_id: 1, mes: 1, valor: 120 }], grupos: GRUPOS, unidades: UNIDADES, consultores: CONSULTORES })

  it('meta do ano, realizado até o mês de referência, % e falta', () => {
    expect(p.total.meta_ano).toBe(1200)
    expect(p.total.realizado).toBe(280) // 150 + 50 + 80; cancelada e abril fora
    expect(p.total.pct).toBeCloseTo(280 / 1200, 10)
    expect(p.total.falta).toBe(920)
  })
  it('ciclo e ciclo + 1', () => {
    expect(p.total.meta_ciclo).toBe(300)
    expect(p.total.desvio_ciclo).toBe(-20)
    expect(p.total.meta_ciclo_mais_1).toBe(400)
    expect(p.total.precisa_proximo_mes).toBe(120)
  })
  it('por grupo e por unidade; unidade sem meta tem % vazio', () => {
    expect(p.porGrupo.find(g => g.id === 1)!.realizado).toBe(200)
    expect(p.porUnidade.find(u => u.id === 2)!.pct).toBeNull()
    expect(p.ranking.map(r => r.id)).toEqual([1])
  })
  it('evolução mensal inclui meses depois da referência e o ano anterior', () => {
    expect(p.mensal[0]).toEqual({ mes: 1, meta: 100, realizado: 150, anterior: 120 })
    expect(p.mensal[3].realizado).toBe(400)
    expect(p.mensal[2].realizado).toBe(0)
  })
  it('mix, modalidade e toneladas', () => {
    expect(p.mix).toEqual({ DIF: 150, CONV: 130 })
    expect(p.modalidade).toEqual({ VERDE_AGRO: 230, VENDA_DIRETA: 50 })
    expect(p.toneladas[1]).toBe(2)
  })
  it('filtro por consultor usa a meta da unidade dele', () => {
    const q = montarPainel({ filtro: { ano: 2026, mes_ref: 3, consultor: 'Gabriel' }, metas, vendas, anterior: [], grupos: GRUPOS, unidades: UNIDADES, consultores: CONSULTORES })
    expect(q.total.realizado).toBe(80)
    expect(q.total.meta_ano).toBe(0)
    expect(q.porUnidade.map(u => u.id)).toEqual([2])
  })
  it('dezembro: ciclo + 1 não passa do ano', () => {
    const q = montarPainel({ filtro: { ano: 2026, mes_ref: 12 }, metas, vendas, anterior: [], grupos: GRUPOS, unidades: UNIDADES, consultores: CONSULTORES })
    expect(q.total.meta_ciclo_mais_1).toBe(1200)
  })
})

describe('faixaAtingimento', () => {
  it('limites padrão e configuráveis', () => {
    expect(faixaAtingimento(0.69)).toBe('vermelho')
    expect(faixaAtingimento(0.7)).toBe('amarelo')
    expect(faixaAtingimento(0.999)).toBe('amarelo')
    expect(faixaAtingimento(1)).toBe('verde')
    expect(faixaAtingimento(0.75, 0.8, 0.95)).toBe('vermelho')
    expect(faixaAtingimento(null)).toBeNull()
  })
})

// ── Critérios de aceite sobre as planilhas reais ──
const PASTA = path.resolve(import.meta.dirname, '../../docs/planilhas')
const temPlanilhas = fs.existsSync(path.join(PASTA, 'Gabriel - 2026.xlsx'))

describe.skipIf(!temPlanilhas)('painel com as planilhas reais', () => {
  const abrir = async (f: string) => { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(path.join(PASTA, f)); return wb }
  const r2 = (n: number) => Math.round(n * 100) / 100
  const CAD: Cadastros = {
    consultores: CONSULTORES.map(c => ({ valor: c.id, rotulo: c.nome })),
    grupos: GRUPOS.map(g => ({ valor: String(g.id), rotulo: g.nome })),
    mapeamentos: ([['GILVAM', 'Gilvan'], ['JOAO', 'João Victor'], ['ADERI', 'Aderi Agro'], ['ADERI - BALCAO', 'Aderi Agro'], ['FABRICIO', 'Fabrício']] as const)
      .map(([t, v]) => ({ tipo: 'consultor' as const, texto_original: t, valor: v }))
      .concat([{ tipo: 'grupo', texto_original: 'FOLIAR', valor: '4' }, { tipo: 'modalidade', texto_original: 'VENDA DIREYA', valor: 'VENDA_DIRETA' }, { tipo: 'tipo', texto_original: 'CV', valor: 'CONV' }] as never[]),
  }

  it('ciclo jan–set e ciclo + 1, realizado de janeiro e por unidade', async () => {
    const consultorArq = ['Aderi agro  - 2026.xlsx', 'Gabriel - 2026.xlsx', 'Gilvan - 2026.xlsx', 'Joao Victor - 2026.xlsx']
    const metas: ValorMensal[] = []
    for (const [u, f] of consultorArq.entries()) {
      lerPlanilhaConsultor((await abrir(f)).worksheets[0]).meta_mensal.forEach((ms, g) => ms.forEach((valor, m) => metas.push({ unidade_id: u + 1, grupo_id: g + 1, mes: m + 1, valor })))
    }
    const mensais = fs.readdirSync(PASTA).filter(f => /^00\d .*AD\.xlsx$/.test(f) && !f.includes('(1)')).sort()
    expect(mensais).toHaveLength(9)
    const vendas: VendaPainel[] = []
    for (const f of mensais) {
      const leitura = planilhaAd.ler(await abrir(f), f)
      for (const { venda: v } of resolverLeitura(leitura, CAD, PARAMETROS_VENDA_PADRAO).validas) {
        vendas.push({ ...v, cancelada: false, unidade_id: CONSULTORES.find(c => c.id === v.consultor_id)!.unidade_id })
      }
    }
    const p = montarPainel({ filtro: { ano: 2026, mes_ref: 9 }, metas, vendas, anterior: [], grupos: GRUPOS, unidades: UNIDADES, consultores: CONSULTORES })
    expect(p.total.meta_ano).toBe(48_200_000)
    expect(p.total.meta_ciclo).toBe(26_557_000)
    expect(p.total.meta_ciclo_mais_1).toBe(35_799_000)
    expect(r2(p.mensal[0].realizado)).toBe(6_689_433.74)
    // linhas importáveis: planilha menos as 3 linhas fora (44.660 + 16.800 + 720)
    expect(r2(p.total.realizado)).toBe(r2(21_251_530.87 - 44_660 - 16_800 - 720))
    expect(p.porUnidade.map(u => r2(u.realizado))).toEqual([14_535_308.57, 1_592_439.9, 2_912_312.85, 2_149_289.55])
    expect(r2(p.mix.DIF + p.mix.CONV)).toBe(r2(p.total.realizado))
    expect(r2(p.modalidade.VERDE_AGRO + p.modalidade.VENDA_DIRETA)).toBe(r2(p.total.realizado))
  }, 120_000)
})

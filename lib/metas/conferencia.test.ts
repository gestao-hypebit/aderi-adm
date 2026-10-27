import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import fs from 'node:fs'
import path from 'node:path'
import { calcularVenda, PARAMETROS_VENDA_PADRAO } from './calculo'
import { celula, numero } from './importacao/celulas'
import { planilhaAd } from './importacao/planilhaAd'
import { resolverLeitura, type Cadastros } from './importacao/resolver'

// Confere o cálculo de cada venda com as colunas da planilha mensal AD:
// U custo financeiro, AB imposto, AI comissão, AM lucro.
const PASTA = path.resolve(import.meta.dirname, '../../docs/planilhas')
const temPlanilhas = fs.existsSync(path.join(PASTA, '001 - JANEIRO - 2026 AD.xlsx'))

// Linhas com valor digitado à mão por cima da fórmula na planilha
const EXCECOES = new Set([
  '006 L30', // comissão zerada à mão (AI = 0)
  '006 L43', // custo unitário total digitado (P = 158,42 em vez de M + N + O)
])

const NOMES = ['Aderi Agro', 'Gabriel', 'Gilvan', 'João Victor', 'Fabrício']
const CAD: Cadastros = {
  consultores: NOMES.map(n => ({ valor: n, rotulo: n })),
  grupos: ['Defensivos', 'Diversos', 'Fertilizantes', 'Foliares', 'Sementes'].map((g, i) => ({ valor: String(i + 1), rotulo: g })),
  mapeamentos: ([
    ['consultor', 'GILVAM', 'Gilvan'], ['consultor', 'JOAO', 'João Victor'], ['consultor', 'ADERI', 'Aderi Agro'],
    ['consultor', 'ADERI - BALCAO', 'Aderi Agro'], ['consultor', 'FABRICIO', 'Fabrício'],
    ['grupo', 'FOLIAR', '4'], ['modalidade', 'VENDA DIREYA', 'VENDA_DIRETA'], ['tipo', 'CV', 'CONV'],
  ] as const).map(([tipo, texto_original, valor]) => ({ tipo, texto_original, valor })),
}

describe.skipIf(!temPlanilhas)('cálculo × planilhas mensais, linha a linha', () => {
  it('custo financeiro, imposto, comissão e lucro batem ao centavo', async () => {
    const divergentes: string[] = []
    let conferidas = 0
    const arquivos = fs.readdirSync(PASTA).filter(f => /^00\d .*AD\.xlsx$/.test(f) && !f.includes('(1)')).sort()
    for (const f of arquivos) {
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.readFile(path.join(PASTA, f))
      const ws = wb.worksheets[0]
      for (const { venda: v } of resolverLeitura(planilhaAd.ler(wb, f), CAD, PARAMETROS_VENDA_PADRAO).validas) {
        const c = calcularVenda(v)
        const id = `${f.slice(0, 3)} L${v.linha_origem}`
        if (c.custo_pendente || EXCECOES.has(id)) continue
        conferidas++
        const pares: [string, number, number][] = [
          ['fin', c.custo_financeiro!, numero(celula(ws, v.linha_origem, 21)) ?? 0],
          ['imp', c.imposto!, numero(celula(ws, v.linha_origem, 28)) ?? 0],
          ['com', c.comissao!, numero(celula(ws, v.linha_origem, 35)) ?? 0],
          ['luc', c.lucro!, numero(celula(ws, v.linha_origem, 39)) ?? 0],
        ]
        const ruins = pares.filter(([, a, b]) => Math.abs(a - b) > 0.01)
        if (ruins.length) divergentes.push(`${id}: ${ruins.map(([k, a, b]) => `${k} ${a.toFixed(2)}≠${b.toFixed(2)}`).join(' ')}`)
      }
    }
    expect(conferidas).toBeGreaterThan(600)
    expect(divergentes).toEqual([])
  }, 120_000)
})

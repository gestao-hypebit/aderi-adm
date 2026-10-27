import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { gerarXlsx } from './excel'
import { montarPainel } from './painel'
import { abasPainel } from './painelExcel'

describe('gerarXlsx', () => {
  it('grava números com formato (não texto), datas e linha de total', async () => {
    const blob = await gerarXlsx([{
      nome: 'Teste: com/símbolos?',
      colunas: [{ titulo: 'Nome' }, { titulo: 'Valor', formato: 'brl' }, { titulo: '%', formato: 'pct' }, { titulo: 'Data', formato: 'data' }],
      linhas: [['A', 1234.5, 0.25, '2026-01-05'], ['B', null, null, null]],
      total: ['Total', 1234.5, null, null],
    }])
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await blob.arrayBuffer())
    const ws = wb.worksheets[0]
    expect(ws.name).toBe('Teste  com símbolos ')
    expect(ws.getCell('B2').value).toBe(1234.5)
    expect(ws.getCell('B2').numFmt).toContain('R$')
    expect(ws.getCell('C2').numFmt).toBe('0.0%')
    expect((ws.getCell('D2').value as Date).toISOString().slice(0, 10)).toBe('2026-01-05')
    expect(ws.getCell('A4').value).toBe('Total')
    expect(ws.getRow(4).font?.bold).toBe(true)
  })
})

describe('abasPainel', () => {
  it('monta as abas do painel com os totais', () => {
    const p = montarPainel({
      filtro: { ano: 2026, mes_ref: 1 },
      metas: [{ unidade_id: 1, grupo_id: 1, mes: 1, valor: 100 }],
      vendas: [], anterior: [],
      grupos: [{ id: 1, nome: 'Defensivos' }], unidades: [{ id: 1, nome: 'I' }], consultores: [],
    })
    const abas = abasPainel(p, 2026, 1)
    expect(abas.map(a => a.nome)).toEqual(['Meta x realizado (grupo)', 'Meta x realizado (unidade)', 'Evolução mensal', 'Mix e modalidade', 'Ranking', 'Resultado'])
    expect(abas[0].total?.slice(0, 3)).toEqual(['Total', 100, 0])
    expect(abas[2].linhas).toHaveLength(12)
    abas.forEach(a => a.linhas.forEach(l => expect(l).toHaveLength(a.colunas.length)))
  })
})

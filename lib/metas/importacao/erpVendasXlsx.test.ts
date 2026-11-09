import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import ExcelJS from 'exceljs'
import { faturamentoItem } from './erpEdpe'
import { lerVendasErpLinhas, lerVendasErpXlsx } from './erpVendasXlsx'

const CAB = ['Emp.', 'Pedido', 'Cliente', 'Nome', 'Emissão', 'Cfg.', 'Nome Cfg.', 'Vendedor', 'Nome Vendedor', 'Cond. Pagto.', 'Código Produto', 'Descrição Produto', 'Quantidade', 'Custo', 'Pr. Ven.', 'Desc.', 'Acréscimo', 'Total LÃ­quido', 'Custo Total', 'Total Venda', 'Lucro R$', '% Lucro', 'Observação']
const d = (s: string) => new Date(s + 'T00:00:00Z')
const LINHAS: unknown[][] = [
  CAB,
  [1, '003911/26', 390, 'DJALMA ANTONIO DE MELO', d('2026-11-03'), 1, 'V E N D A S', '009/4', 'ADERI - BALCAO', 'A PRAZO', 1764, 'DINAC - FOTOMAG-D (GL.05 LTS)', 60, 13.84, 20, 0, 0, 20, 830.4, 1200, 369.6, 0.4451, null],
  [1, '003911/26', 390, 'DJALMA ANTONIO DE MELO', d('2026-11-03'), 1, 'V E N D A S', '009/4', 'ADERI - BALCAO', 'A PRAZO', 507, 'OMEX - PERFORMA - (GL.5LT)', 15, 139.22, 175, 0, 0, 175, 2088.3, 2625, 536.7, 0.257, null],
  [1, '003915/26', 12, 'DONISETE GERALDO LEITE', d('2026-11-04'), 1, 'V E N D A S', '009/4', 'ADERI - BALCAO', 'A PRAZO', 135, 'GESSO AGRICOLA', '37.92', 147.3, 375, 0, 0, 375, 5585.62, 14220, 8634.38, 1.5458, null],
  [1, '003910/26', 723, 'DONISETE GERALDO LEITE', d('2026-11-03'), 25, 'REM A ORDEM DE TERC', '009/4', 'ADERI - BALCAO', 'A PRAZO', 2032, 'CP - BIO ATHIVO FERRO', 282, 120.71, 155.5, 0, 0, 155.5, 34040.22, 43851, 9810.78, 0.2882, 'OBS X'],
]

describe('relatório de vendas do ERP (.xlsx)', () => {
  it('agrupa itens por pedido e lê custo, quantidade em texto e operação', () => {
    const l = lerVendasErpLinhas(LINHAS, 'v.xlsx')!
    expect(l.formato).toBe('erp-vendas-xlsx')
    expect(l.pedidos.map(p => p.dav)).toEqual(['003911/26', '003915/26', '003910/26'])
    const p = l.pedidos[0]
    expect(p).toMatchObject({ cliente_codigo: '390', cliente: 'DJALMA ANTONIO DE MELO', data: '2026-11-03', vendedor: '009/4', total: 3825, operacao: '1 - VENDAS', condicao: 'A PRAZO' })
    expect(p.itens).toHaveLength(2)
    expect(p.itens[0]).toMatchObject({ linha: 2, produto_codigo: '1764', quantidade: 60, preco_unitario: 20, custo_unitario: 13.84, desconto: 0 })
    expect(l.pedidos[1].itens[0].quantidade).toBe(37.92)
    expect(faturamentoItem(l.pedidos[1].itens[0])).toBeCloseTo(14220, 2)
    expect(l.pedidos[2].operacao).toBe('25 - REM A ORDEM DE TERC')
    expect(l.pedidos[2].itens[0].observacao).toBe('OBS X')
    expect(l.avisos).toEqual([])
  })

  it('não reconhece outras planilhas', () => {
    expect(lerVendasErpLinhas([['Data:', 'DAV', 'Cliente']], 'x.xlsx')).toBeNull()
  })
})

// ── Arquivo real (docs/planilhas fica fora do git) ──
const ARQUIVO = path.resolve(import.meta.dirname, '../../../docs/planilhas/vendas-erp-novembro-26.xlsx')
describe.skipIf(!fs.existsSync(ARQUIVO))('relatório de vendas real (novembro/2026)', () => {
  it('lê os 52 itens de 21 pedidos e fecha com a soma do "Total Venda"', async () => {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(ARQUIVO)
    const l = lerVendasErpXlsx(wb, 'vendas.xlsx')!
    expect(l.pedidos).toHaveLength(21)
    expect(l.pedidos.reduce((s, p) => s + p.itens.length, 0)).toBe(52)
    const soma = l.pedidos.reduce((s, p) => s + p.itens.reduce((t, i) => t + faturamentoItem(i), 0), 0)
    expect(soma).toBeCloseTo(637977.18, 2)
    const custo = l.pedidos.reduce((s, p) => s + p.itens.reduce((t, i) => t + (i.custo_unitario ?? 0) * i.quantidade, 0), 0)
    expect(custo).toBeCloseTo(510041.47, 0)
    expect(l.pedidos.every(p => p.data?.startsWith('2026-11'))).toBe(true)
    expect(l.avisos).toEqual([])
  })
})

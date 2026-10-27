import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import fs from 'node:fs'
import path from 'node:path'
import { PARAMETROS_VENDA_PADRAO } from '../calculo'
import { normalizar, resolverNome, TIPOS, MODALIDADES } from '../nomes'
import { competenciaDe, planilhaAd } from './planilhaAd'
import { lerPlanilhaConsultor } from './planilhaConsultor'
import { chaveDuplicidade, conciliar, resolverLeitura, type Cadastros } from './resolver'
import { inferirToneladas } from './toneladas'
import { dataISO, numero } from './celulas'

const CAD: Cadastros = {
  consultores: ['Aderi Agro', 'Gabriel', 'Gilvan', 'João Victor', 'Fabrício'].map(n => ({ valor: n, rotulo: n })),
  grupos: ['Defensivos', 'Diversos', 'Fertilizantes', 'Foliares', 'Sementes'].map((g, i) => ({ valor: String(i + 1), rotulo: g })),
  mapeamentos: [
    { tipo: 'consultor', texto_original: 'GILVAM', valor: 'Gilvan' },
    { tipo: 'consultor', texto_original: 'ADERI - BALCAO', valor: 'Aderi Agro' },
    { tipo: 'grupo', texto_original: 'FOLIAR', valor: '4' },
    { tipo: 'modalidade', texto_original: 'VENDA DIREYA', valor: 'VENDA_DIRETA' },
    { tipo: 'tipo', texto_original: 'CV', valor: 'CONV' },
  ],
}

describe('nomes', () => {
  it('normaliza acento, caixa e espaços', () => expect(normalizar('  João   Victor ')).toBe('JOAO VICTOR'))
  it('reconhece o cadastro sem mapeamento', () => {
    expect(resolverNome('consultor', 'JOÃO VICTOR', CAD.consultores, [])).toBe('João Victor')
    expect(resolverNome('consultor', 'JOAO VICTOR', CAD.consultores, [])).toBe('João Victor')
    expect(resolverNome('grupo', 'FOLIARES', CAD.grupos, [])).toBe('4')
    expect(resolverNome('modalidade', 'VERDE AGRO', MODALIDADES, [])).toBe('VERDE_AGRO')
  })
  it('usa o mapeamento salvo', () => {
    expect(resolverNome('consultor', 'Gilvam', CAD.consultores, CAD.mapeamentos)).toBe('Gilvan')
    expect(resolverNome('grupo', 'FOLIAR', CAD.grupos, CAD.mapeamentos)).toBe('4')
    expect(resolverNome('tipo', 'CV', TIPOS, CAD.mapeamentos)).toBe('CONV')
    expect(resolverNome('modalidade', 'VENDA DIREYA', MODALIDADES, CAD.mapeamentos)).toBe('VENDA_DIRETA')
  })
  it('nome desconhecido não é resolvido', () => expect(resolverNome('grupo', 'ANALISE FOLHA', CAD.grupos, CAD.mapeamentos)).toBeNull())
})

describe('células', () => {
  it('número em texto pt-BR', () => {
    expect(numero('1.234,56')).toBe(1234.56)
    expect(numero('-')).toBeNull()
  })
  it('data: Date e serial do Excel; texto e ano absurdo não', () => {
    expect(dataISO(new Date(Date.UTC(2026, 0, 5)))).toBe('2026-01-05')
    expect(dataISO(46027)).toBe('2026-01-05')
    expect(dataISO('30/092026')).toBeNull()
    expect(dataISO(new Date(Date.UTC(1904, 7, 9)))).toBeNull()
  })
  it('competência do "REF. MÊS"', () => {
    expect(competenciaDe('JANEIRO // 2026')).toBe('2026-01-01')
    expect(competenciaDe('MARÇO  //  2026')).toBe('2026-03-01')
    expect(competenciaDe('AGOSTO  // 26')).toBe('2026-08-01')
    expect(competenciaDe(new Date(Date.UTC(2026, 6, 1)))).toBe('2026-07-01')
    expect(competenciaDe('REF')).toBeNull()
  })
})

describe('toneladas', () => {
  it('preço por tonelada', () => expect(inferirToneladas('AD - 20.00.20', 16, 2690)).toEqual({ toneladas: 16, origem: 'preco' }))
  it('preço por tonelada vale mais que a embalagem no nome', () =>
    expect(inferirToneladas('AD - 18.04.17 ((01 SACO DE 50 KG))', 0.05, 3600).toneladas).toBe(0.05))
  it('embalagem no nome', () => expect(inferirToneladas('UREIA PROTEGIDA (SACARIA 50KG)', 60, 280)).toEqual({ toneladas: 3, origem: 'nome' }))
  it('sem pista: não infere', () => expect(inferirToneladas('AD - AGRICAL 7525', 2, 750).toneladas).toBeNull())
})

// Planilha AD mínima montada em memória
function planilhaSintetica() {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('JANEIRO-26')
  ws.getCell('A22').value = 'REF. MÊS:'
  ws.getCell('B22').value = 'JANEIRO // 2026'
  ws.getCell('T22').value = 0.022
  ws.getRow(23).values = ['Data:', 'DAV', 'Cliente:', 'PRODUTO:', 'QTD.', 'UNIT R$:', 'FATURAMENTO:', 'GRUPO:', 'CONSULTOR', 'MODALIDADE', 'D/C']
  const d = (dia: number) => new Date(Date.UTC(2026, 0, dia))
  // [A..K], M, N, O, R, S
  const linhas: unknown[][] = [
    [d(5), '001', 'CLIENTE A', 'AD - 20.00.20', 16, 2690, 43040, 'FERTILIZANTES', 'GILVAM', 'VERDE AGRO', 'CV', 2458, 130, 0, new Date(Date.UTC(2026, 8, 9)), new Date(Date.UTC(2026, 8, 30))],
    [d(6), '002', 'CLIENTE B', 'DF - PRIORI', 1, 965, 965, 'DEFENSIVOS', 'GABRIEL', 'VENDA DIREYA', 'DIF'],
    [d(6), '003', 'CLIENTE C', 'CANCELADO - ERRO NOME', null, null, null, null, null, null, null],
    [null, '004', 'CLIENTE D', 'AD-10.00.40', 14, 3190, 44660, 'FERTILIZANTES', 'ADERI - BALCAO', 'VERDE AGRO', 'CONV'],
    [d(7), '005', 'CLIENTE E', 'ANALISE', 1, 720, 720, 'ANALISE FOLHA', 'GABRIEL', 'VERDE AGRO', 'CONV'],
    [d(7), 'RELAT', 'FABRICA', 'CALCARIO', 0, 500, 500, 'DIVERSOS', 'JOÃO VICTOR', 'VENDA DIRETA', 'CONV'],
    [d(8), '001', 'CLIENTE A', 'AD - 20.00.20', 16, 2690, 43040, 'FERTILIZANTES', 'GILVAN', 'VERDE AGRO', 'CONV'],
  ]
  linhas.forEach((l, i) => {
    const r = ws.getRow(24 + i)
    l.slice(0, 11).forEach((v, c) => { if (v != null) r.getCell(c + 1).value = v as ExcelJS.CellValue })
    ;[13, 14, 15, 18, 19].forEach((col, k) => { if (l[11 + k] != null) r.getCell(col).value = l[11 + k] as ExcelJS.CellValue })
  })
  ws.getCell('C31').value = 'TOTAL FATURAMENTO JANEIRO // 2026 ....'
  ws.mergeCells('C31:F31')
  ws.getCell('G31').value = 133000
  return wb
}

describe('planilha AD (sintética)', () => {
  const leitura = planilhaAd.ler(planilhaSintetica(), 'teste.xlsx')
  const res = resolverLeitura(leitura, CAD, PARAMETROS_VENDA_PADRAO)

  it('lê cabeçalho, juros, competência e total (rótulo mesclado não vira produto)', () => {
    expect(leitura.taxa_juros_mensal).toBe(0.022)
    expect(leitura.competencia).toBe('2026-01-01')
    expect(leitura.total_geral).toBe(133000)
    expect(leitura.linhas).toHaveLength(7)
  })
  it('ignora cancelada e sem data', () => {
    expect(res.ignoradas.map(l => l.ignorada)).toEqual(['cancelada', 'sem_data'])
  })
  it('mapeia nomes e aponta o não reconhecido', () => {
    expect(res.validas).toHaveLength(4)
    expect(res.validas[0].venda).toMatchObject({ consultor_id: 'Gilvan', tipo: 'CONV', grupo_id: 3, toneladas: 16, competencia: '2026-01-01' })
    expect(res.validas[1].venda.modalidade).toBe('VENDA_DIRETA')
    expect(res.com_erro).toHaveLength(1)
    expect(res.nao_reconhecidos).toEqual([{ tipo: 'grupo', texto: 'ANALISE FOLHA', ocorrencias: 1 }])
  })
  it('venda direta só com valor entra pelo valor da planilha, com aviso', () => {
    const relat = res.validas.find(v => v.venda.dav === 'RELAT')!
    expect(relat.venda.faturamento).toBe(500)
    expect(relat.avisos.some(a => a.startsWith('Faturamento da planilha'))).toBe(true)
  })
  it('avisa duplicidade (DAV + produto + qtd + valor)', () => {
    expect(res.validas[3].avisos.some(a => a.includes('duplicidade com a linha 24'))).toBe(true)
    expect(chaveDuplicidade(res.validas[0].venda)).toBe(chaveDuplicidade(res.validas[3].venda))
  })
  it('conciliação explica a diferença pelas linhas que ficaram de fora', () => {
    const c = conciliar(leitura, res)
    expect(c.importado).toBe(43040 + 965 + 500 + 43040)
    expect(c.diferenca).toBe(133000 - 87545)
    expect(c.fora_com_valor.map(f => f.valor)).toEqual([44660, 720])
    expect(c.nao_explicado).toBeCloseTo(133000 - 87545 - 44660 - 720, 6)
  })
})

// ── Critérios de aceite com as planilhas reais (docs/planilhas fica fora do git) ──
const PASTA = path.resolve(import.meta.dirname, '../../../docs/planilhas')
const temPlanilhas = fs.existsSync(path.join(PASTA, 'Gabriel - 2026.xlsx'))

describe.skipIf(!temPlanilhas)('planilhas reais', () => {
  const abrir = async (f: string) => { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(path.join(PASTA, f)); return wb }
  const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
  const r2 = (n: number) => Math.round(n * 100) / 100

  it('metas 2026 por unidade, grupo e ciclo', async () => {
    const arquivos = ['Aderi agro  - 2026.xlsx', 'Gabriel - 2026.xlsx', 'Gilvan - 2026.xlsx', 'Joao Victor - 2026.xlsx']
    const ls = await Promise.all(arquivos.map(async f => lerPlanilhaConsultor((await abrir(f)).worksheets[0])))
    expect(ls.map(l => soma(l.meta_mensal.flat()))).toEqual([33_500_000, 4_300_000, 4_300_000, 6_100_000])
    expect([0, 1, 2, 3, 4].map(g => soma(ls.map(l => soma(l.meta_mensal[g]))))).toEqual([3_000_000, 2_500_000, 40_500_000, 1_800_000, 400_000])
    expect(soma(ls.flatMap(l => l.meta_mensal.flatMap(m => m.slice(0, 9))))).toBe(26_557_000)
    expect(soma(ls.flatMap(l => l.meta_mensal.flatMap(m => m.slice(0, 10))))).toBe(35_799_000)
    ls.forEach(l => expect(l.avisos.filter(a => a.includes('coluna D'))).toEqual([]))
  }, 60_000)

  it('janeiro/2026 = R$ 6.689.433,74 e diferenças de julho e setembro explicadas', async () => {
    const mes = async (f: string) => {
      const leitura = planilhaAd.ler(await abrir(f), f)
      return conciliar(leitura, resolverLeitura(leitura, CAD_REAL, PARAMETROS_VENDA_PADRAO))
    }
    const jan = await mes('001 - JANEIRO - 2026 AD.xlsx')
    expect(r2(jan.importado)).toBe(6_689_433.74)
    expect(r2(jan.diferenca!)).toBe(0)
    const jul = await mes('007 -JULHO - 26 - AD.xlsx')
    expect(r2(jul.importado)).toBe(1_040_979.7)
    expect(r2(jul.total_planilha!)).toBe(1_085_639.7)
    expect(r2(jul.nao_explicado!)).toBe(0)
    const set = await mes('009 - SETEMBRO - 26 AD.xlsx')
    expect(r2(set.importado)).toBe(7_567_197.53)
    expect(r2(set.total_planilha!)).toBe(7_583_997.53)
    expect(r2(set.nao_explicado!)).toBe(0)
  }, 60_000)
})

const CAD_REAL: Cadastros = {
  ...CAD,
  mapeamentos: [
    ...CAD.mapeamentos,
    { tipo: 'consultor', texto_original: 'ADERI', valor: 'Aderi Agro' },
    { tipo: 'consultor', texto_original: 'FABRICIO', valor: 'Fabrício' },
    { tipo: 'consultor', texto_original: 'JOAO', valor: 'João Victor' },
  ],
}

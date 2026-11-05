import { describe, expect, it } from 'vitest'
import { calcularVenda } from './calculo'
import { montarRelatorioComissoes, periodoBR } from './comissoes'
import { gerarPdfComissoes } from './comissoesPdf'
import type { VendaRow } from './vendas'

const CONSULTORES = [{ id: 'g', nome: 'Gabriel' }, { id: 'a', nome: 'Aderi Agro' }]

let seq = 0
const venda = (p: Partial<VendaRow> = {}): VendaRow => ({
  id: String(++seq), data: '2026-10-05', competencia: '2026-10-01', dav: 'D1', cliente: 'Cliente', cliente_id: null, produto: 'Produto', produto_id: null,
  quantidade: 10, preco_unitario: 100, faturamento: 1000, grupo_id: 1, consultor_id: 'g', unidade_id: 1, modalidade: 'VERDE_AGRO', tipo: 'CONV', cancelada: false,
  custo_unitario: 70, frete_unitario: 0, desconto_unitario: 0, data_pagamento_compra: null, data_recebimento: null, toneladas: null,
  taxa_juros_mensal: 0.022, aliquota_imposto: 0.3, fator_comissao: 0.1, cotacao_id: null, importacao_id: null, linha_origem: null, observacao: null,
  cliente_codigo: null, produto_codigo: null, vendedor_codigo: null, created_at: '', ...p,
})

describe('montarRelatorioComissoes', () => {
  const comCusto = venda()
  const semCusto = venda({ faturamento: 500, custo_unitario: null })
  const cancelada = venda({ faturamento: 9999, cancelada: true })
  const aCompletar = venda({ faturamento: 300, consultor_id: null, competencia: '2026-09-01' })
  const daAderi = venda({ consultor_id: 'a', faturamento: 2000, quantidade: 20 })
  const r = montarRelatorioComissoes([comCusto, semCusto, cancelada, aCompletar, daAderi], CONSULTORES)
  const comissaoUnit = calcularVenda(comCusto).comissao!

  it('agrupa por consultor em ordem alfabética', () => {
    expect(r.consultores.map(c => c.nome)).toEqual(['Aderi Agro', 'Gabriel'])
  })
  it('venda sem custo conta no vendido, mas não na comissão; cancelada não conta', () => {
    const g = r.consultores.find(c => c.id === 'g')!
    expect(g.resumo.realizado).toBe(1500)
    expect(g.resumo.qtd_custo_pendente).toBe(1)
    expect(g.resumo.comissao).toBeCloseTo(comissaoUnit, 10)
    expect(g.vendas).toHaveLength(2)
    expect(g.vendas.find(v => v.custo_pendente)!.comissao).toBeNull()
  })
  it('total soma todos os consultores', () => {
    expect(r.total.realizado).toBe(3500)
    expect(r.total.comissao).toBeCloseTo(r.consultores.reduce((s, c) => s + c.resumo.comissao, 0), 10)
  })
  it('venda a completar fica fora, mas é avisada', () => {
    expect(r.aCompletar).toEqual({ qtd: 1, valor: 300, competencias: ['2026-09-01'] })
  })
  it('filtro por consultor mantém o aviso das vendas sem consultor', () => {
    const q = montarRelatorioComissoes([comCusto, semCusto, aCompletar, daAderi], CONSULTORES, 'a')
    expect(q.consultores.map(c => c.id)).toEqual(['a'])
    expect(q.total.realizado).toBe(2000)
    expect(q.aCompletar.qtd).toBe(1)
  })
  it('vendas em ordem de data', () => {
    const q = montarRelatorioComissoes([venda({ data: '2026-10-20' }), venda({ data: '2026-10-02' })], CONSULTORES)
    expect(q.consultores[0].vendas.map(v => v.data)).toEqual(['2026-10-02', '2026-10-20'])
  })
})

describe('periodoBR', () => {
  it('mês único e intervalo', () => {
    expect(periodoBR('2026-10', '2026-10')).toBe('out/2026')
    expect(periodoBR('2026-01', '2026-10')).toBe('jan/2026 a out/2026')
  })
})

describe('gerarPdfComissoes', () => {
  const op = { periodo: 'out/2026', emitidoEm: '05/11/2026', nomeArquivo: 'c.pdf' }
  const paginas = async (f: File) => (Buffer.from(await f.arrayBuffer()).toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length

  it('sem detalhe fica em uma página; com detalhe, muitas vendas quebram em várias', async () => {
    const r = montarRelatorioComissoes(Array.from({ length: 120 }, () => venda()), CONSULTORES)
    const resumo = await gerarPdfComissoes(r, { ...op, detalhar: false })
    expect(resumo.type).toBe('application/pdf')
    expect(await paginas(resumo)).toBe(1)
    expect(await paginas(await gerarPdfComissoes(r, { ...op, detalhar: true }))).toBe(4)
  })
})

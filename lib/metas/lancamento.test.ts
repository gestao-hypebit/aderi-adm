import { describe, expect, it } from 'vitest'
import { completarEdicao, dataPadrao, resumirMes } from './lancamento'
import type { VendaRow } from './vendas'

const FERT = 3
const venda = (v: Partial<VendaRow> = {}): VendaRow => ({
  id: 'x', data: '2026-10-02', competencia: '2026-10-01', dav: '003811/26', cliente: 'C', cliente_id: null, produto: 'DF - MIRAVIS',
  produto_id: null, quantidade: 7, preco_unitario: 1110.15, faturamento: 7771.05, grupo_id: 1, consultor_id: 'gabriel', unidade_id: 2,
  modalidade: 'VERDE_AGRO', tipo: 'DIF', cancelada: false, custo_unitario: null, frete_unitario: 0, desconto_unitario: 0,
  data_pagamento_compra: null, data_recebimento: null, toneladas: null, taxa_juros_mensal: 0.022, aliquota_imposto: 0.3, fator_comissao: 0.1,
  cotacao_id: null, importacao_id: null, linha_origem: null, observacao: null, cliente_codigo: null, produto_codigo: null, vendedor_codigo: null,
  created_at: '', ...v,
})

describe('edição de linha', () => {
  it('qtd ou unitário recalculam o faturamento', () => {
    expect(completarEdicao(venda(), { quantidade: 10 }, FERT)).toEqual({ quantidade: 10, faturamento: 11101.5 })
    expect(completarEdicao(venda(), { preco_unitario: 1000 }, FERT)).toEqual({ preco_unitario: 1000, faturamento: 7000 })
  })
  it('faturamento digitado vale; com qtd 0 (venda direta pelo valor) o informado fica', () => {
    expect(completarEdicao(venda(), { faturamento: 5000 }, FERT)).toEqual({ faturamento: 5000 })
    expect(completarEdicao(venda({ quantidade: 0, preco_unitario: 0, faturamento: 2160 }), { preco_unitario: 10 }, FERT)).toEqual({ preco_unitario: 10 })
  })
  it('fertilizante infere tonelada; outro grupo limpa', () => {
    const fert = venda({ produto: 'AD - 18.04.17', quantidade: 40, preco_unitario: 2940, grupo_id: null })
    expect(completarEdicao(fert, { grupo_id: FERT }, FERT)).toEqual({ grupo_id: FERT, toneladas: 40 })
    expect(completarEdicao({ ...fert, grupo_id: FERT, toneladas: 40 }, { grupo_id: 1 }, FERT)).toEqual({ grupo_id: 1, toneladas: null })
    // tonelada digitada não é sobrescrita
    expect(completarEdicao({ ...fert, grupo_id: FERT }, { toneladas: 39 }, FERT)).toEqual({ toneladas: 39 })
  })
})

describe('resumo do mês (topo da planilha)', () => {
  const cad = {
    grupos: [{ id: 1, nome: 'Defensivos' }, { id: 3, nome: 'Fertilizantes' }],
    unidades: [{ id: 1, codigo: 'I', nome: 'Aderi Agro' }, { id: 2, codigo: 'II', nome: 'Gabriel' }],
  }
  const vendas = [
    venda({ id: 'a', faturamento: 1000 }),
    venda({ id: 'b', faturamento: 3000, grupo_id: FERT, tipo: 'CONV', toneladas: 1, consultor_id: 'aderi', unidade_id: 1 }),
    venda({ id: 'c', faturamento: 500, grupo_id: null, consultor_id: null, unidade_id: null, tipo: null }),
    venda({ id: 'd', faturamento: 9999, cancelada: true }),
  ]
  const r = resumirMes(vendas, cad, FERT)

  it('total sem canceladas, com as linhas a completar', () => {
    expect(r.total).toBe(4500)
    expect(r.canceladas).toBe(1)
    expect(r.a_completar).toEqual({ qtd: 1, valor: 500 })
  })
  it('quadros por grupo, unidade e D/C mostram o que falta classificar', () => {
    expect(r.porGrupo).toEqual([{ id: '1', nome: 'Defensivos', valor: 1000 }, { id: '3', nome: 'Fertilizantes', valor: 3000 }, { id: '—', nome: 'Sem grupo', valor: 500 }])
    expect(r.porUnidade.map(f => f.valor)).toEqual([3000, 1000, 500])
    expect(r.porTipo.map(f => [f.id, f.valor])).toEqual([['DIF', 1000], ['CONV', 3000], ['—', 500]])
    expect(r.porModalidade).toEqual([{ id: 'VERDE_AGRO', nome: 'Fat. Verde Agro Insumos', valor: 4500 }, { id: 'VENDA_DIRETA', nome: 'Fat. Venda Direta', valor: 0 }])
    expect(r.toneladas).toBe(1)
  })
  it('data padrão da linha nova', () => {
    expect(dataPadrao('2026-10', '2026-10-28')).toBe('2026-10-28')
    expect(dataPadrao('2026-09', '2026-10-28')).toBe('2026-09-01')
  })
})

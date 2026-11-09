import { describe, expect, it } from 'vitest'
import { acessoCompleto, ehGestao, limparPermissoes, pode, podeRota, telaInicial, telasDaRota } from './permissoes'

const completo = { role: 'admin', ativo: true, permissoes: null }
const importador = { role: 'admin', ativo: true, permissoes: ['metas_importar', 'metas_lancamentos'] }
const consultor = { role: 'colaborador', ativo: true, permissoes: null }

describe('permissões por tela', () => {
  it('administrador completo abre tudo, inclusive rotas sem tela', () => {
    expect(acessoCompleto(completo)).toBe(true)
    expect(podeRota(completo, '/admin')).toBe(true)
    expect(podeRota(completo, '/admin/qualquer-coisa')).toBe(true)
    expect(telaInicial(completo)).toBe('/admin')
  })

  it('só importar vendas: entra na importação e nos lançamentos, e em nada mais', () => {
    expect(acessoCompleto(importador)).toBe(false)
    expect(podeRota(importador, '/admin/metas/importar')).toBe(true)
    expect(podeRota(importador, '/admin/metas/lancamentos')).toBe(true)
    expect(podeRota(importador, '/admin/metas/vendas/123')).toBe(true) // venda aberta pelos lançamentos
    expect(podeRota(importador, '/admin')).toBe(false)
    expect(podeRota(importador, '/admin/metas')).toBe(false)
    expect(podeRota(importador, '/admin/metas/vendas')).toBe(false)
    expect(podeRota(importador, '/admin/cotacoes')).toBe(false)
    expect(podeRota(importador, '/admin/consultores/novo')).toBe(false)
    expect(podeRota(importador, '/admin/qualquer-coisa')).toBe(false)
    expect(telaInicial(importador)).toBe('/admin/metas/lancamentos')
  })

  it('tela mais específica ganha: Acompanhamento não abre os outros relatórios', () => {
    expect(telasDaRota('/admin/relatorios/cotacoes')).toEqual(['acompanhamento'])
    expect(telasDaRota('/admin/relatorios/km')).toEqual(['relatorios'])
    const p = { role: 'admin', permissoes: ['acompanhamento'] }
    expect(podeRota(p, '/admin/relatorios/cotacoes')).toBe(true)
    expect(podeRota(p, '/admin/relatorios')).toBe(false)
    expect(podeRota(p, '/admin/cotacoes/abc')).toBe(true)
    expect(podeRota(p, '/admin/cotacoes')).toBe(false)
  })

  it('consultor, desativado ou lista vazia não abrem a administração', () => {
    expect(podeRota(consultor, '/admin/metas/importar')).toBe(false)
    expect(podeRota({ ...importador, ativo: false }, '/admin/metas/importar')).toBe(false)
    expect(telaInicial({ role: 'admin', permissoes: [] })).toBeNull()
  })

  it('gestão das cotações é quem tem Aprovações', () => {
    expect(ehGestao(completo)).toBe(true)
    expect(ehGestao({ role: 'admin', permissoes: ['cotacoes'] })).toBe(false)
    expect(ehGestao({ role: 'admin', permissoes: ['aprovacoes'] })).toBe(true)
    expect(pode(consultor, 'aprovacoes')).toBe(false)
  })

  it('limparPermissoes tira chaves desconhecidas e ordena', () => {
    expect(limparPermissoes(['metas_lancamentos', 'xyz', 'metas_importar'])).toEqual(['metas_lancamentos', 'metas_importar'])
  })
})

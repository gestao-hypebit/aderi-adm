import { describe, expect, it } from 'vitest'
import { calcularItem, calcularTotais, itemDoBanco, itemVazio, precoMinimo, PARAMETROS_PADRAO } from './cotacao'

const item = (campos = {}) => ({ ...itemVazio(), produto_nome: 'P', quantidade: 10, preco_tabela: 100, frete: 20, descarga: 5, preco_cliente: 200, ...campos })

describe('custo da cotação', () => {
  it('soma tabela + frete + descarga', () => {
    expect(calcularItem(item(), PARAMETROS_PADRAO).custoUnitario).toBe(125)
  })
  it('descarga pesa no custo igual ao frete', () => {
    const comDescarga = calcularItem(item(), PARAMETROS_PADRAO)
    const soFrete = calcularItem(item({ frete: 25, descarga: 0 }), PARAMETROS_PADRAO)
    expect(comDescarga.precoSugerido).toBeCloseTo(soFrete.precoSugerido)
    expect(comDescarga.margemLiquida).toBeCloseTo(soFrete.margemLiquida)
    expect(comDescarga.resultadoLiquido).toBeCloseTo(soFrete.resultadoLiquido)
  })
  it('totais separam frete e descarga e fecham no custo', () => {
    const t = calcularTotais([item()], PARAMETROS_PADRAO)
    expect(t.frete).toBe(200)
    expect(t.descarga).toBe(50)
    expect(t.custo).toBeCloseTo(t.compra + t.frete + t.descarga + t.financiamento + t.comissao + t.imposto)
  })
  it('preço mínimo considera a descarga', () => {
    const r = precoMinimo(item(), PARAMETROS_PADRAO, 0.05)!
    expect(calcularItem(item({ preco_cliente: r }), PARAMETROS_PADRAO).margemLiquida).toBeCloseTo(0.05)
  })
  it('desconto de cotação antiga continua valendo', () => {
    expect(calcularItem(item({ desconto: 10 }), PARAMETROS_PADRAO).custoUnitario).toBe(115)
  })
  it('linha do banco sem descarga vira zero', () => {
    expect(itemDoBanco({ produto_nome: 'P' }).descarga).toBe(0)
  })
})

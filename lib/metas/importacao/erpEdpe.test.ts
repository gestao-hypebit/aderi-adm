import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { decodificarCsv, lerEdpe, normalizarDav, numeroErp } from './erpEdpe'
import { montarSugestor, type VendaHistorico } from './sugestoes'

// Mesmo formato do EDPE010 do ERP (cabeçalho repetido no topo, itens com espaço na frente, rodapé)
const CSV = [
  '2;ADENILSON CESAR FERREIRA;01/10/2026;N;003805/26;009/4;;;185;0;0;S;1;5102;A Prazo',
  '2;ADENILSON CESAR FERREIRA;01/10/2026;N;003805/26;009/4;;;185;0;0;S;1;5102;A Prazo',
  ' ;Empresa;Produto;Ref. Original;Descrição;Vr. desct;Quantidade;Preço Venda;Obs. da venda;;;;;;',
  ' ;1;1578;18.04.17;AD - 18.04.17  + 1%S(1%;;;0,05;3.700,00;;;;;;',
  ' ;;;;;;;;;;;;;;',
  '80;RAFAEL ALVES TOME E OUTRO;02/10/2026;N;003811/26;002/1;;;1.183,15;0;0;S;1;5102;A Prazo',
  ' ;Empresa;Produto;Ref. Original;Descrição;Vr. desct;Quantidade;Preço Venda;Obs. da venda;;;;;;',
  ' ;1;1028;;DF - MIRAVIS DUO (GL. 0;;;1;1.110,15;;;;;;',
  ' ;1;1302;;AMAZON - SEAGRASS (GL 2;;;1;73;REFERENTE TROCA;;;;;',
  ' ;;;;;;;;;;;;;;',
  '2;ADENILSON CESAR FERREIRA;06/10/2026;N;003824/26;002/1;;;350;0;0;S;16;5910;A Prazo',
  ' ;Empresa;Produto;Ref. Original;Descrição;Vr. desct;Quantidade;Preço Venda;Obs. da venda;;;;;;',
  ' ;1;135;GESSO AGRICOLA;GESSO AGRICOLA - CONDIC;;;5;70;;;;;;',
  ' ;;;;;;;;;;;;;;',
  ' ;Código;Nome do profissional;Valor de Vendas;Valor de Devoluções;Valor Final;;;;;;;;;',
  ' ;;*-*;1.718,15;;1.718,15;;;;;;;;;',
  ' ;----------;------------------------------;--------------------;--------------------;--------------------;;;;;;;;;',
  ' ;;Total geral dos indicantes;;;1.718,15;;;;;;;;;',
].join('\r\n')

describe('relatório EDPE010 do ERP', () => {
  const l = lerEdpe(CSV, 'EDPE010.CSV')

  it('lê pedidos e itens, sem o cabeçalho repetido', () => {
    expect(l.pedidos.map(p => p.dav)).toEqual(['003805/26', '003811/26', '003824/26'])
    expect(l.avisos[0]).toMatch(/1 cabeçalho/)
    const p = l.pedidos[1]
    expect(p).toMatchObject({ cliente_codigo: '80', cliente: 'RAFAEL ALVES TOME E OUTRO', data: '2026-10-02', vendedor: '002/1', total: 1183.15, situacao: 'S', cfop: '5102' })
    expect(p.itens).toHaveLength(2)
    expect(p.itens[0]).toMatchObject({ produto_codigo: '1028', descricao: 'DF - MIRAVIS DUO (GL. 0', quantidade: 1, preco_unitario: 1110.15 })
    expect(p.itens[1].observacao).toBe('REFERENTE TROCA')
  })

  it('quantidade e preço no formato brasileiro', () => {
    expect(l.pedidos[0].itens[0]).toMatchObject({ quantidade: 0.05, preco_unitario: 3700 })
    expect(numeroErp('20.720,00')).toBe(20720)
    expect(numeroErp('185')).toBe(185)
    expect(numeroErp('1.295')).toBe(1295)
    expect(numeroErp('')).toBe(0)
  })

  it('total geral do rodapé e conferência com os itens', () => {
    expect(l.total_geral).toBe(1718.15)
    expect(l.avisos.filter(a => /difere/.test(a))).toEqual([])
    expect(l.pedidos[2].cfop).toBe('5910')
  })

  it('DAV com e sem zeros à esquerda é o mesmo', () => {
    expect(normalizarDav('003805/26')).toBe('3805/26')
    expect(normalizarDav('03805/26')).toBe('3805/26')
    expect(normalizarDav(' 3805 / 26')).toBe('3805/26')
    expect(normalizarDav('GECAL')).toBe('GECAL')
  })

  it('decodifica latin-1', () => {
    const latin1 = new Uint8Array([0x44, 0x45, 0x56, 0x4f, 0x4c, 0x55, 0xc7, 0xc3, 0x4f]) // DEVOLUÇÃO
    expect(decodificarCsv(latin1.buffer)).toBe('DEVOLUÇÃO')
  })
})

describe('sugestões pelo histórico', () => {
  const h = (p: Partial<VendaHistorico>): VendaHistorico => ({
    data: '2026-09-01', produto: '', produto_codigo: null, grupo_id: null, tipo: null, cliente: '', cliente_codigo: null, consultor_id: null, ...p,
  })
  const historico = [
    h({ produto: 'DF - MIRAVIS DUO (GL.05LT)', grupo_id: 1, tipo: 'DIF', cliente: 'EVALDO', consultor_id: 'gilvan' }),
    h({ produto: 'DF - CANTUS - 500 GR', grupo_id: 1, tipo: 'DIF' }),
    h({ produto: 'DF - OPERA (GL.05L)', grupo_id: 1, tipo: 'DIF' }),
    h({ produto: 'AD - 18.04.17', grupo_id: 3, tipo: 'CONV', cliente: 'MIGUEL NADIM ZIDAM', consultor_id: 'gabriel', data: '2026-09-04' }),
    h({ produto: 'AD - 20.00.20', grupo_id: 3, tipo: 'CONV', cliente: 'MIGUEL NADIM ZIDAM', consultor_id: 'aderi', data: '2026-09-16' }),
    h({ produto: 'AD - 30.00.18', grupo_id: 3, tipo: 'CONV' }),
    h({ produto: 'AD - OCHIMA (GL.20LT)', grupo_id: 4, tipo: 'DIF' }),
    h({ produto: 'GESSO X', produto_codigo: '135', grupo_id: 2, tipo: 'CONV', cliente_codigo: '186', consultor_id: 'joao', data: '2026-10-02' }),
    h({ produto: 'SEM CLASSIFICAR', produto_codigo: '999' }),
  ]
  const s = montarSugestor(historico, [{ tipo: 'vendedor', texto_original: '002/1', valor: 'gabriel' }])

  it('pelo código do produto já classificado', () => {
    expect(s.produto('135', 'GESSO AGRICOLA - CONDIC')).toEqual({ nome: 'GESSO X', grupo_id: 2, tipo: 'CONV', origem: 'codigo' })
  })
  it('pelo nome: a descrição cortada do ERP é o começo do nome da planilha', () => {
    expect(s.produto('1028', 'DF - MIRAVIS DUO (GL. 0')).toEqual({ nome: 'DF - MIRAVIS DUO (GL.05LT)', grupo_id: 1, tipo: 'DIF', origem: 'nome' })
  })
  it('pela marca, só quando ela quase sempre cai no mesmo grupo', () => {
    expect(s.produto('2000', 'DF - ZAPP (GL.05LT)-REG')).toMatchObject({ grupo_id: 1, tipo: 'DIF', origem: 'marca', nome: null })
    // AD: 3 fertilizantes e 1 foliar = 75%, abaixo do mínimo
    expect(s.produto('2001', 'AD - 46.00.00 UREIA - M')).toMatchObject({ grupo_id: null, origem: null })
  })
  it('venda sem classificação não ensina nada', () => {
    expect(s.produto('999', 'SEM CLASSIFICAR')).toMatchObject({ grupo_id: null, origem: null })
  })
  it('consultor: vendedor mapeado primeiro, depois o último consultor do cliente', () => {
    expect(s.consultor('002/1', null, 'QUALQUER')).toEqual({ consultor_id: 'gabriel', origem: 'vendedor' })
    expect(s.consultor('009/4', null, 'Miguel Nadim Zidam')).toEqual({ consultor_id: 'aderi', origem: 'cliente' })
    expect(s.consultor('009/4', '186', 'OUTRO NOME')).toEqual({ consultor_id: 'joao', origem: 'cliente' })
    expect(s.consultor('009/4', null, 'NOVO')).toEqual({ consultor_id: null, origem: null })
  })
})

// ── Arquivo real (docs/planilhas fica fora do git) ──
const ARQUIVO = path.resolve(import.meta.dirname, '../../../docs/planilhas/EDPE010.CSV')
describe.skipIf(!fs.existsSync(ARQUIVO))('EDPE010 real (outubro/2026)', () => {
  it('a soma dos itens fecha com o "Total geral dos indicantes"', () => {
    const buf = fs.readFileSync(ARQUIVO)
    const l = lerEdpe(decodificarCsv(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)), 'EDPE010.CSV')
    expect(l.pedidos).toHaveLength(83)
    expect(l.pedidos.reduce((s, p) => s + p.itens.length, 0)).toBe(138)
    expect(l.total_geral).toBe(3830382.1)
    const soma = l.pedidos.reduce((s, p) => s + p.itens.reduce((t, i) => t + i.quantidade * i.preco_unitario, 0), 0)
    expect(soma).toBeCloseTo(3830382.1, 2)
    expect(l.avisos.filter(a => /difere|sem data/.test(a))).toEqual([])
    expect(l.pedidos.find(p => p.dav === '003889/26')?.itens[0].observacao).toMatch(/DEVOLU[ÇC][ÃA]O/)
  })
})

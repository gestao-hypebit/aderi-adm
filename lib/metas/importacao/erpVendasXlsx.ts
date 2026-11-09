import type { Workbook } from 'exceljs'
import { normalizar } from '../nomes'
import { dataISO, numero, texto as textoCelula, valor } from './celulas'
import type { ItemErp, LeituraErp, PedidoErp } from './erpEdpe'

// Relatório de vendas do ERP exportado em .xlsx: uma linha por item, com o pedido repetido.
//  Emp. | Pedido | Cliente | Nome | Emissão | Cfg. | Nome Cfg. | Vendedor | Nome Vendedor | Cond. Pagto. |
//  Código Produto | Descrição Produto | Quantidade | Custo | Pr. Ven. | Desc. | Acréscimo | Total Líquido |
//  Custo Total | Total Venda | Lucro R$ | % Lucro | Observação
// Diferente do EDPE010, traz o custo unitário e a descrição inteira; não traz CFOP nem total geral.
// A quantidade às vezes vem como texto com ponto decimal ("37.92").

// Operações (Nome Cfg.) que não são venda: vêm desmarcadas na importação
export const OPERACAO_SEM_VENDA = /BONIFIC|DOAC|BRINDE|AMOSTRA|DEVOLU/

// O ERP grava os textos em UTF-8 marcados como latin-1: "EmissÃ£o" → "Emissão"
export function consertarAcentos(s: string): string {
  if (!/[ÃÂ]/.test(s) || [...s].some(c => c.charCodeAt(0) > 255)) return s
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(s, c => c.charCodeAt(0)))
  } catch {
    return s
  }
}
const texto = (v: unknown) => consertarAcentos(textoCelula(v))

type Colunas = Record<'pedido' | 'cliente' | 'nome' | 'emissao' | 'cfg' | 'nomeCfg' | 'vendedor' | 'condicao' |
  'codigo' | 'descricao' | 'quantidade' | 'custo' | 'preco' | 'liquido' | 'totalVenda' | 'obs', number | undefined>

// Cabeçalho normalizado (sem acento, maiúsculo) → campo
function mapearCabecalho(linha: unknown[]): Colunas | null {
  const cab = linha.map(v => normalizar(texto(v)).replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim())
  const achar = (t: (h: string) => boolean) => { const i = cab.findIndex(t); return i >= 0 ? i : undefined }
  const c: Colunas = {
    pedido: achar(h => h === 'PEDIDO'),
    cliente: achar(h => h === 'CLIENTE'),
    nome: achar(h => h === 'NOME'),
    emissao: achar(h => h === 'EMISSAO'),
    cfg: achar(h => h === 'CFG'),
    nomeCfg: achar(h => h === 'NOME CFG'),
    vendedor: achar(h => h === 'VENDEDOR'),
    condicao: achar(h => h.startsWith('COND')),
    codigo: achar(h => h === 'CODIGO PRODUTO'),
    descricao: achar(h => h === 'DESCRICAO PRODUTO'),
    quantidade: achar(h => h === 'QUANTIDADE'),
    custo: achar(h => h === 'CUSTO'),
    preco: achar(h => h === 'PR VEN'),
    liquido: achar(h => h.startsWith('TOTAL L')),
    totalVenda: achar(h => h === 'TOTAL VENDA'),
    obs: achar(h => h.startsWith('OBSERV')),
  }
  const obrigatorias = [c.pedido, c.emissao, c.codigo, c.descricao, c.quantidade, c.totalVenda]
  return obrigatorias.every(i => i != null) ? c : null
}

const centavos = (n: number) => Math.round(n * 100) / 100

// Linhas da planilha (cada uma um array de valores; índice 0 = coluna A). "primeira" é o número
// da linha 1 do array na planilha, para os avisos apontarem a linha certa.
export function lerVendasErpLinhas(linhas: unknown[][], arquivo: string, primeira = 1): LeituraErp | null {
  const iCab = linhas.slice(0, 10).findIndex(l => mapearCabecalho(l) != null)
  if (iCab < 0) return null
  const col = mapearCabecalho(linhas[iCab])!
  const get = (l: unknown[], i: number | undefined) => (i == null ? null : l[i] ?? null)

  const avisos: string[] = []
  const porPedido = new Map<string, PedidoErp>()
  linhas.slice(iCab + 1).forEach((l, k) => {
    const linha = primeira + iCab + 1 + k
    const dav = texto(get(l, col.pedido))
    const descricao = texto(get(l, col.descricao)).replace(/\s+/g, ' ')
    if (!dav || !descricao) return
    const quantidade = numero(get(l, col.quantidade)) ?? 0
    const precoTabela = numero(get(l, col.preco))
    const preco = numero(get(l, col.liquido)) ?? precoTabela ?? 0
    const total = numero(get(l, col.totalVenda)) ?? centavos(quantidade * preco)
    // O faturamento é o "Total Venda"; o que sobrar do preço × quantidade vira desconto do item
    const dif = centavos(quantidade * preco - total)
    const custo = numero(get(l, col.custo))
    const item: ItemErp = {
      linha,
      produto_codigo: texto(get(l, col.codigo)),
      referencia: '',
      descricao,
      quantidade,
      preco_unitario: preco,
      desconto: Math.abs(dif) < 0.01 ? 0 : dif,
      observacao: texto(get(l, col.obs)),
      custo_unitario: custo != null && custo > 0 ? custo : null,
    }

    let p = porPedido.get(dav)
    if (!p) {
      const cfg = texto(get(l, col.cfg))
      const nomeCfg = texto(get(l, col.nomeCfg)).replace(/\s+/g, ' ')
      p = {
        linha,
        cliente_codigo: texto(get(l, col.cliente)),
        cliente: texto(get(l, col.nome)),
        data: dataISO(get(l, col.emissao)),
        dav,
        vendedor: texto(get(l, col.vendedor)),
        total: 0,
        situacao: '',
        cfop: '',
        condicao: texto(get(l, col.condicao)),
        // "V E N D A S" → "VENDAS"
        operacao: [cfg, /^(\S )+\S$/.test(nomeCfg) ? nomeCfg.replace(/ /g, '') : nomeCfg].filter(Boolean).join(' - '),
        itens: [],
      }
      porPedido.set(dav, p)
    }
    p.total = centavos(p.total + total)
    p.itens.push(item)
  })

  const pedidos = [...porPedido.values()]
  for (const p of pedidos) if (!p.data) avisos.push(`Pedido ${p.dav} (linha ${p.linha}) sem data de emissão válida.`)
  return { arquivo, formato: 'erp-vendas-xlsx', pedidos, total_geral: null, avisos }
}

// Procura o relatório em qualquer aba do arquivo; null se o arquivo não é desse formato
export function lerVendasErpXlsx(wb: Workbook, arquivo: string): LeituraErp | null {
  for (const ws of wb.worksheets) {
    const linhas: unknown[][] = []
    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r)
      const l: unknown[] = []
      for (let c = 1; c <= Math.max(row.cellCount, ws.columnCount); c++) l.push(valor(row.getCell(c)))
      linhas.push(l)
    }
    const leitura = lerVendasErpLinhas(linhas, arquivo)
    if (leitura) return leitura
  }
  return null
}

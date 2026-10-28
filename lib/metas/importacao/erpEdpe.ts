import { normalizar } from '../nomes'

// Relatório "EDPE010" do ERP: DAVs do período, exportado em CSV separado por ";" (latin-1).
//  · cabeçalho do pedido: cód. cliente;cliente;data;?;DAV;vendedor;;;total;?;?;situação S/N;?;CFOP;condição
//  · itens (começam com espaço): ;empresa;cód. produto;ref.;descrição (cortada em 24 letras);;?;qtd;preço;obs.
//  · rodapé: total por indicante e "Total geral dos indicantes" (para conciliar)
// O relatório repete às vezes o cabeçalho do primeiro pedido sem itens; esse é descartado.
// Não traz grupo, D/C nem custo: a venda entra "a completar".

export type ItemErp = {
  linha: number
  produto_codigo: string
  referencia: string
  descricao: string
  quantidade: number
  preco_unitario: number
  desconto: number        // valor; nos arquivos vistos sempre vazio
  observacao: string
}

export type PedidoErp = {
  linha: number
  cliente_codigo: string
  cliente: string
  data: string | null     // AAAA-MM-DD
  dav: string
  vendedor: string        // código do vendedor no ERP, ex.: "002/1"
  total: number
  situacao: string        // "S" na maioria; "N" em poucos (TODO(cliente): o que significa?)
  cfop: string
  condicao: string
  itens: ItemErp[]
}

export type LeituraErp = {
  arquivo: string
  pedidos: PedidoErp[]
  total_geral: number | null
  avisos: string[]
}

// CFOP de remessa sem venda (bonificação, doação, brinde): vem desmarcado na importação
export const CFOP_SEM_VENDA = ['5910', '6910']

// "20.720,00", "185", "0,05" → número
export function numeroErp(s: string): number {
  let t = (s ?? '').trim()
  if (!t) return 0
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')
  const n = Number(t)
  return Number.isFinite(n) ? n : 0
}

const dataErp = (s: string) => {
  const m = (s ?? '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

// DAV com ou sem zeros à esquerda é o mesmo documento: "003805/26" (ERP) = "03805/26" (planilha)
export function normalizarDav(dav: string | null | undefined): string {
  const s = String(dav ?? '').replace(/\s/g, '')
  const m = s.match(/^0*(\d+)\/(\d+)$/)
  return m ? `${m[1]}/${m[2]}` : normalizar(s)
}

// O ERP exporta em latin-1; se um dia vier em UTF-8, também funciona
export function decodificarCsv(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    return new TextDecoder('windows-1252').decode(buf)
  }
}

export function lerEdpe(texto: string, arquivo: string): LeituraErp {
  const pedidos: PedidoErp[] = []
  const avisos: string[] = []
  let total_geral: number | null = null
  let atual: PedidoErp | null = null

  texto.split(/\r?\n/).forEach((bruta, i) => {
    const linha = i + 1
    const p = bruta.split(';')
    if (/Total geral/i.test(bruta)) {
      const n = [...p].reverse().find(x => /\d/.test(x))
      if (n) total_geral = numeroErp(n)
      return
    }
    if (p.length < 9) return
    // Cabeçalho de pedido: primeiro campo é o código do cliente
    if (/^\d+$/.test(p[0].trim())) {
      atual = {
        linha,
        cliente_codigo: p[0].trim(),
        cliente: p[1].trim(),
        data: dataErp(p[2]),
        dav: p[4].trim(),
        vendedor: p[5].trim(),
        total: numeroErp(p[8]),
        situacao: (p[11] ?? '').trim(),
        cfop: (p[13] ?? '').trim(),
        condicao: (p[14] ?? '').trim(),
        itens: [],
      }
      pedidos.push(atual)
      return
    }
    // Item: empresa (número) e código do produto
    if (atual && !p[0].trim() && /^\d+$/.test(p[1].trim()) && /^\d+$/.test(p[2].trim())) {
      ;(atual as PedidoErp).itens.push({
        linha,
        produto_codigo: p[2].trim(),
        referencia: p[3].trim(),
        descricao: p[4].trim().replace(/\s+/g, ' '),
        desconto: numeroErp(p[6]),
        quantidade: numeroErp(p[7]),
        preco_unitario: numeroErp(p[8]),
        observacao: p.slice(9).map(x => x.trim()).filter(Boolean).join(' '),
      })
    }
  })

  const comItens = pedidos.filter(p => p.itens.length > 0)
  const vazios = pedidos.length - comItens.length
  if (vazios) avisos.push(`${vazios} cabeçalho(s) de pedido sem itens ignorado(s) (o relatório repete o primeiro pedido).`)
  for (const p of comItens) {
    if (!p.data) avisos.push(`DAV ${p.dav} (linha ${p.linha}) sem data válida.`)
    const soma = p.itens.reduce((s, it) => s + faturamentoItem(it), 0)
    if (Math.abs(soma - p.total) > 0.01) avisos.push(`DAV ${p.dav}: soma dos itens (${soma.toFixed(2)}) difere do total do pedido (${p.total.toFixed(2)}).`)
  }
  return { arquivo, pedidos: comItens, total_geral, avisos }
}

export const faturamentoItem = (it: ItemErp) => it.quantidade * it.preco_unitario - it.desconto

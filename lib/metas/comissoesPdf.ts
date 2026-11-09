import { brl } from '../cotacao'
import { dataBR } from '../csv'
import type { RelatorioComissoes } from './comissoes'

// PDF com texto de verdade (não uma foto da tela): a lista de vendas pode ter muitas páginas,
// e assim nenhuma linha é cortada na virada, o cabeçalho se repete e o arquivo fica leve.

type Opcoes = {
  periodo: string
  emitidoEm: string
  consultor?: string   // nome, quando o relatório é de um consultor só
  detalhar: boolean    // inclui a lista de vendas de cada consultor
  logo?: string        // data URL
  nomeArquivo: string
}
type Coluna = { titulo: string; largura: number; direita?: boolean }
type Estilo = { negrito?: boolean; cor?: string; fundo?: string }

const MARGEM = 12
const LARGURA = 210 - 2 * MARGEM
const LIMITE = 297 - 15 // o rodapé fica abaixo disto
const ALTURA_LINHA = 5.6

const VERDE = '#1a7f4b'
const TEXTO = '#162a1e'
const MUDO = '#6b736b'
const FIO = '#e4e0d9'
const FUNDO_CABECALHO = '#f4f2ed'

const COLS_RESUMO: Coluna[] = [
  { titulo: 'Consultor', largura: 54 }, { titulo: 'Vendas', largura: 13, direita: true }, { titulo: 'Vendido', largura: 29, direita: true },
  { titulo: 'Com custo', largura: 29, direita: true }, { titulo: 'Margem líq.', largura: 18, direita: true }, { titulo: 'Sem custo', largura: 16, direita: true },
  { titulo: 'Comissão a pagar', largura: 27, direita: true },
]
// Valores sem "R$" na lista de vendas: são 10 colunas na largura de um A4 em pé
const COLS_VENDAS: Coluna[] = [
  { titulo: 'Cliente', largura: 31 }, { titulo: 'DAV', largura: 12 }, { titulo: 'Data DAV', largura: 15 }, { titulo: 'Produto', largura: 31 },
  { titulo: 'Qtd.', largura: 12, direita: true }, { titulo: 'Valor bruto', largura: 19, direita: true }, { titulo: 'Custo total', largura: 19, direita: true },
  { titulo: 'Resultado', largura: 18, direita: true }, { titulo: 'Margem', largura: 12, direita: true }, { titulo: 'Comissão', largura: 17, direita: true },
]

const num = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const qtd = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

const pct = (n: number | null | undefined, casas = 1) =>
  n == null || !Number.isFinite(n) ? '-' : `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: casas })}%`

// As fontes padrão do PDF só têm o alfabeto latino; o resto sairia como lixo
const limpar = (s: string) => s.replace(/[  ]/g, ' ').replace(/[–—−]/g, '-').replace(/[^\x20-\x7e¡-ÿ]/g, '')

export async function gerarPdfComissoes(rel: RelatorioComissoes, op: Opcoes): Promise<File> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  let y = MARGEM

  const fonte = (tamanho: number, cor = TEXTO, negrito = false) => {
    pdf.setFontSize(tamanho)
    pdf.setTextColor(cor)
    pdf.setFont('helvetica', negrito ? 'bold' : 'normal')
  }
  const caber = (s: string, largura: number) => {
    const t = limpar(s)
    if (pdf.getTextWidth(t) <= largura) return t
    let fim = t.length
    while (fim > 0 && pdf.getTextWidth(t.slice(0, fim) + '...') > largura) fim--
    return t.slice(0, fim).trimEnd() + '...'
  }

  function linha(cols: Coluna[], valores: string[], { negrito, cor = TEXTO, fundo }: Estilo = {}) {
    if (fundo) { pdf.setFillColor(fundo); pdf.rect(MARGEM, y, LARGURA, ALTURA_LINHA, 'F') }
    fonte(7.5, cor, negrito)
    let x = MARGEM
    cols.forEach((c, i) => {
      const texto = caber(valores[i] ?? '', c.largura - 2)
      if (c.direita) pdf.text(texto, x + c.largura - 1, y + 3.9, { align: 'right' })
      else pdf.text(texto, x + 1, y + 3.9)
      x += c.largura
    })
    pdf.setDrawColor(FIO)
    pdf.setLineWidth(0.15)
    pdf.line(MARGEM, y + ALTURA_LINHA, MARGEM + LARGURA, y + ALTURA_LINHA)
    y += ALTURA_LINHA
  }
  const cabecalho = (cols: Coluna[]) => linha(cols, cols.map(c => c.titulo), { negrito: true, cor: MUDO, fundo: FUNDO_CABECALHO })
  function novaLinha(cols: Coluna[]) {
    if (y + ALTURA_LINHA <= LIMITE) return
    pdf.addPage()
    y = MARGEM
    cabecalho(cols)
  }
  function paragrafo(texto: string, tamanho: number, cor: string) {
    fonte(tamanho, cor)
    const linhas = pdf.splitTextToSize(limpar(texto), LARGURA) as string[]
    pdf.text(linhas, MARGEM, y + 3)
    y += linhas.length * tamanho * 0.42 + 2
  }

  // ── Cabeçalho ──
  if (op.logo) {
    try {
      const { width, height } = pdf.getImageProperties(op.logo)
      const altura = 13
      pdf.addImage(op.logo, MARGEM + LARGURA - (altura * width) / height, y, (altura * width) / height, altura)
    } catch { /* sem logo o relatório continua válido */ }
  }
  fonte(16, TEXTO, true)
  pdf.text('Relatório de comissões', MARGEM, y + 6)
  fonte(9, MUDO)
  pdf.text(limpar(`Período (mês de referência): ${op.periodo}${op.consultor ? ` · Consultor: ${op.consultor}` : ''}`), MARGEM, y + 11.5)
  pdf.text(`Emitido em ${op.emitidoEm}`, MARGEM, y + 16)
  y += 21

  // ── Totais ──
  const t = rel.total
  const caixas: [string, string, string][] = [
    ['Comissão a pagar', brl(t.comissao), `${pct(t.faturamento_com_custo ? t.comissao / t.faturamento_com_custo : null, 2)} do vendido com custo`],
    ['Vendido no período', brl(t.realizado), `${t.qtd_vendas} venda(s)`],
    ['Sem custo informado', String(t.qtd_custo_pendente), `${brl(t.realizado - t.faturamento_com_custo)} fora da comissão`],
  ]
  const larguraCaixa = (LARGURA - 8) / 3
  caixas.forEach(([rotulo, valor, sub], i) => {
    const x = MARGEM + i * (larguraCaixa + 4)
    pdf.setDrawColor(i === 0 ? VERDE : FIO)
    pdf.setLineWidth(i === 0 ? 0.5 : 0.25)
    pdf.roundedRect(x, y, larguraCaixa, 20, 1.5, 1.5, 'S')
    fonte(7.5, MUDO, true)
    pdf.text(rotulo, x + 3, y + 5)
    fonte(13, i === 0 ? VERDE : TEXTO, true)
    pdf.text(limpar(valor), x + 3, y + 11.5)
    fonte(7, MUDO)
    pdf.text(limpar(sub), x + 3, y + 16.5)
  })
  y += 25

  // ── Avisos: o total pode mudar quando estas vendas forem acertadas ──
  const avisos = [
    t.qtd_custo_pendente > 0 && `${t.qtd_custo_pendente} venda(s) sem custo informado (${brl(t.realizado - t.faturamento_com_custo)}) contam no vendido, mas ainda não geram comissão.`,
    rel.aCompletar.qtd > 0 && `${rel.aCompletar.qtd} venda(s) a completar (${brl(rel.aCompletar.valor)}) estão fora deste relatório por falta de classificação.`,
  ].filter((a): a is string => !!a)
  if (avisos.length) {
    fonte(8, '#7a5200')
    const linhas = pdf.splitTextToSize(limpar(`Atenção: o valor a pagar pode aumentar. ${avisos.join(' ')}`), LARGURA - 6) as string[]
    const altura = linhas.length * 3.5 + 3.5
    pdf.setFillColor('#fff4dc')
    pdf.roundedRect(MARGEM, y, LARGURA, altura, 1.5, 1.5, 'F')
    pdf.text(linhas, MARGEM + 3, y + 4.5)
    y += altura + 5
  }

  // ── Resumo por consultor ──
  fonte(11, TEXTO, true)
  pdf.text('Resumo por consultor', MARGEM, y + 3)
  y += 6
  cabecalho(COLS_RESUMO)
  for (const c of rel.consultores) {
    novaLinha(COLS_RESUMO)
    const r = c.resumo
    linha(COLS_RESUMO, [c.nome, String(r.qtd_vendas), brl(r.realizado), brl(r.faturamento_com_custo), pct(r.margem_liquida), String(r.qtd_custo_pendente), brl(r.comissao)])
  }
  novaLinha(COLS_RESUMO)
  linha(COLS_RESUMO, ['Total', String(t.qtd_vendas), brl(t.realizado), brl(t.faturamento_com_custo), pct(t.margem_liquida), String(t.qtd_custo_pendente), brl(t.comissao)], { negrito: true, fundo: FUNDO_CABECALHO })
  y += 4

  paragrafo(
    'Como é calculado: comissão da venda = base de comissão × % de comissão, em que o % é a margem líquida da venda × o fator de comissão gravado nela. '
    + 'Canceladas não entram. O relatório mostra o valor apurado no período e não desconta pagamentos já feitos.',
    7.5, MUDO,
  )

  // ── Vendas de cada consultor: página própria, para poder entregar separada ──
  if (op.detalhar) {
    for (const c of rel.consultores) {
      pdf.addPage()
      y = MARGEM
      fonte(13, TEXTO, true)
      pdf.text(limpar(c.nome), MARGEM, y + 4)
      fonte(8.5, MUDO)
      pdf.text(limpar(`${op.periodo} · ${c.resumo.qtd_vendas} venda(s) · vendido ${brl(c.resumo.realizado)} · comissão a pagar ${brl(c.resumo.comissao)}`), MARGEM, y + 9)
      y += 13
      cabecalho(COLS_VENDAS)
      for (const v of c.vendas) {
        novaLinha(COLS_VENDAS)
        const comCusto = !v.custo_pendente
        linha(COLS_VENDAS, [
          v.cliente, v.dav ?? '-', dataBR(v.data), v.produto, qtd(v.quantidade), num(v.faturamento),
          comCusto ? num(v.custo_total ?? 0) : 'sem custo', comCusto ? num(v.resultado ?? 0) : '-',
          pct(v.margem_liquida), comCusto ? num(v.comissao ?? 0) : '-',
        ], { cor: comCusto ? TEXTO : MUDO })
      }
      const somar = (f: (v: (typeof c.vendas)[number]) => number | null) => c.vendas.reduce((s, v) => s + (v.custo_pendente ? 0 : f(v) ?? 0), 0)
      novaLinha(COLS_VENDAS)
      linha(COLS_VENDAS, [
        'Total', '', '', '', qtd(c.vendas.reduce((s, v) => s + v.quantidade, 0)), num(c.resumo.realizado),
        num(somar(v => v.custo_total)), num(somar(v => v.resultado)), pct(c.resumo.margem_liquida), num(c.resumo.comissao),
      ], { negrito: true, fundo: FUNDO_CABECALHO })
    }
  }

  // ── Rodapé ──
  const paginas = pdf.getNumberOfPages()
  for (let i = 1; i <= paginas; i++) {
    pdf.setPage(i)
    fonte(7, MUDO)
    pdf.text(limpar(`Aderi Agro · Relatório de comissões · ${op.periodo}`), MARGEM, 297 - 8)
    pdf.text(`Página ${i} de ${paginas}`, MARGEM + LARGURA, 297 - 8, { align: 'right' })
  }

  return new File([pdf.output('blob')], op.nomeArquivo, { type: 'application/pdf' })
}

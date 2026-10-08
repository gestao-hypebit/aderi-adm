// Cálculos da cotação — espelho da aba COTAÇÃO da planilha "001.xlsx".
// Letras entre colchetes indicam a coluna correspondente na planilha.

export type ParametrosCotacao = {
  ptax: number          // [D14] valor PTAX
  juros_mes: number     // [L15] financeiro mês (ex.: 0,022 = 2,2%)
  aliquota_icms: number // 5% fixo nas fórmulas de ICMS
  aliquota_ir: number   // [AA15] I.R./CSLL sobre o resultado
}

export type ItemCotacao = {
  id?: string
  produto_id: string | null
  produto_nome: string
  fornecedor: string | null
  quantidade: number    // [C]
  unidade: string | null // [D]
  preco_tabela: number  // [E]
  desconto: number      // [F]
  frete: number         // [I] por unidade
  data_inicial: string | null // [K]
  data_final: string | null   // [L]
  margem: number        // [M] fração (0,05 = 5%)
  comissao: number      // [N] fração
  preco_cliente: number // [R]
  vencimento: string | null   // [T] (padrão: data final)
}

export const PARAMETROS_PADRAO: ParametrosCotacao = { ptax: 1, juros_mes: 0.022, aliquota_icms: 0.05, aliquota_ir: 0.3 }

export function itemVazio(): ItemCotacao {
  return {
    produto_id: null, produto_nome: '', fornecedor: null, quantidade: 0, unidade: 'TON',
    preco_tabela: 0, desconto: 0, frete: 0, data_inicial: null, data_final: null,
    margem: 0, comissao: 0, preco_cliente: 0, vencimento: null,
  }
}

function dias(inicio: string | null, fim: string | null) {
  if (!inicio || !fim) return 0
  return Math.round((new Date(fim + 'T12:00').getTime() - new Date(inicio + 'T12:00').getTime()) / 86400000)
}

const div = (a: number, b: number) => (b ? a / b : 0)

export function calcularItem(it: ItemCotacao, p: ParametrosCotacao) {
  const q = it.quantidade || 0
  const R = it.preco_cliente || 0
  const markup = (it.margem || 0) + (it.comissao || 0)

  const precoLiquido = ((it.preco_tabela || 0) - (it.desconto || 0)) * (p.ptax || 0)          // [H]
  const frete = it.frete || 0                                                                 // [I]
  // [J] base de financiamento. A planilha tem duas versões (linha 17 divide, as demais
  // multiplicam); usamos a divisão, mesma lógica do preço final [Q].
  const baseFinanc = div(precoLiquido + frete, 1 - markup)
  const prazoDias = dias(it.data_inicial, it.data_final)                                      // [L-K]
  const financiamento = baseFinanc * prazoDias * ((p.juros_mes || 0) / 30)                    // [O]
  const baseCusto = precoLiquido + frete + financiamento                                      // [P]
  const precoSugerido = div(baseCusto, 1 - markup)                                            // [Q]
  const total = q * R                                                                         // [S]

  // por unidade
  const resultadoUnit = R - precoLiquido - frete                                              // [Y]
  // [Z] a planilha usa o preço de tabela [E]; usamos o preço líquido [H], como no total [AG],
  // para não distorcer quando há desconto ou PTAX diferente de 1.
  const icmsUnit = R * p.aliquota_icms - precoLiquido * p.aliquota_icms
  const irUnit = resultadoUnit * p.aliquota_ir                                                // [AA]
  const impostoUnit = icmsUnit + irUnit                                                       // [AB]

  const margemBruta = div(R - precoLiquido - frete - financiamento - R * (it.comissao || 0), R)            // [U]
  const margemLiquida = div(R - precoLiquido - frete - financiamento - impostoUnit - R * (it.comissao || 0), R) // [V]
  const diferenca = R - precoSugerido                                                         // [W]

  // totais (quantidade × unidade) — colunas AF..AK e aba RESULT.
  const resultadoTotal = total - (precoLiquido + frete) * q                                   // [AF]
  const icmsTotal = total * p.aliquota_icms - precoLiquido * q * p.aliquota_icms              // [AG]
  const irTotal = resultadoTotal * p.aliquota_ir                                              // [AH]
  const impostoTotal = icmsTotal + irTotal                                                    // [AI]

  const compraTotal = precoLiquido * q
  const freteTotal = frete * q
  const financTotal = financiamento * q
  const comissaoTotal = total * (it.comissao || 0)
  const custoTotal = compraTotal + freteTotal + financTotal + comissaoTotal + impostoTotal
  const resultadoLiquido = total - custoTotal

  return {
    precoLiquido, baseFinanc, prazoDias, financiamento, baseCusto, precoSugerido, total,
    resultadoUnit, icmsUnit, irUnit, impostoUnit, margemBruta, margemLiquida, diferenca,
    resultadoTotal, icmsTotal, irTotal, impostoTotal,
    pctImpostoResultado: div(impostoTotal, resultadoTotal), pctImpostoVenda: div(impostoTotal, total),
    compraTotal, freteTotal, financTotal, comissaoTotal, custoTotal, resultadoLiquido,
    pctResultado: div(resultadoLiquido, total),
  }
}

export type CalculoItem = ReturnType<typeof calcularItem>

export function calcularTotais(itens: ItemCotacao[], p: ParametrosCotacao) {
  const calc = itens.map(i => calcularItem(i, p))
  const soma = (f: (c: CalculoItem) => number) => calc.reduce((s, c) => s + f(c), 0)
  const venda = soma(c => c.total)
  const resultado = soma(c => c.resultadoLiquido)
  return {
    calc,
    quantidade: itens.reduce((s, i) => s + (i.quantidade || 0), 0),
    venda,
    compra: soma(c => c.compraTotal),
    frete: soma(c => c.freteTotal),
    financiamento: soma(c => c.financTotal),
    comissao: soma(c => c.comissaoTotal),
    imposto: soma(c => c.impostoTotal),
    custo: soma(c => c.custoTotal),
    resultado,
    pctResultado: div(resultado, venda),
  }
}

// Status gravado no banco. Fluxo: cotação → aprovação da gestão → orçamento enviado → cliente aprova (vira pedido) ou não.
export const STATUS_COTACAO: Record<string, { label: string; badge: string; cor: string }> = {
  rascunho: { label: 'Em elaboração', badge: 'ui-badge-neutro', cor: '#b8bdb6' },
  aprovada: { label: 'Aprovada pela gestão', badge: 'ui-badge-aprovada', cor: '#2c5c9e' },
  enviada: { label: 'Orçamento enviado', badge: 'ui-badge-agendada', cor: '#E67E22' },
  efetivada: { label: 'Cliente aprovou', badge: 'ui-badge-realizada', cor: '#1a7f4b' },
  perdida: { label: 'Perdida', badge: 'ui-badge-cancelada', cor: '#c0392b' },
}

// Etapa que aparece na tela: igual ao status, mas separa a cotação que está esperando a gestão
export type Etapa = 'elaboracao' | 'aguardando' | 'aprovada' | 'enviada' | 'efetivada' | 'perdida'
export const ETAPAS: Record<Etapa, { label: string; badge: string; cor: string }> = {
  elaboracao: { label: 'Em elaboração', badge: 'ui-badge-neutro', cor: '#b8bdb6' },
  aguardando: { label: 'Aguardando gestão', badge: 'ui-badge-aguardando', cor: '#7a52b3' },
  aprovada: { label: 'Aprovada pela gestão', badge: 'ui-badge-aprovada', cor: '#2c5c9e' },
  enviada: { label: 'Orçamento enviado', badge: 'ui-badge-agendada', cor: '#E67E22' },
  efetivada: { label: 'Cliente aprovou · pedido', badge: 'ui-badge-realizada', cor: '#1a7f4b' },
  perdida: { label: 'Perdida', badge: 'ui-badge-cancelada', cor: '#c0392b' },
}
export function etapaDe(c: { status: string; aprovacao_status?: string | null }): Etapa {
  if (c.status === 'rascunho') return c.aprovacao_status === 'pendente' ? 'aguardando' : 'elaboracao'
  return c.status in ETAPAS ? (c.status as Etapa) : 'elaboracao'
}

// Funil: cada etapa conta as cotações que chegaram até ela (um pedido também foi aprovado e enviado).
type CotFunil = { status: string; enviada_em: string | null; venda: number; motivo_perda?: string | null; aprovacao_status?: string | null }
export function funilCotacoes<T extends CotFunil>(cots: T[]) {
  const enviou = (c: T) => c.status === 'enviada' || c.status === 'efetivada' || !!c.enviada_em
  const aprovou = (c: T) => c.aprovacao_status === 'aprovada' || c.status === 'aprovada' || enviou(c)
  const etapa = (rotulo: string, cor: string, lista: T[]) => ({ rotulo, cor, qtd: lista.length, valor: lista.reduce((s, c) => s + c.venda, 0) })
  const efetivadas = cots.filter(c => c.status === 'efetivada')
  const perdidas = cots.filter(c => c.status === 'perdida')
  const etapas = [
    etapa('Cotações', '#5b6660', cots),
    etapa('Aprovadas pela gestão', ETAPAS.aprovada.cor, cots.filter(aprovou)),
    etapa('Orçamentos enviados', ETAPAS.enviada.cor, cots.filter(enviou)),
    etapa('Cliente aprovou (pedidos)', ETAPAS.efetivada.cor, efetivadas),
  ]
  const decididas = efetivadas.length + perdidas.length
  const motivos = new Map<string, number>()
  perdidas.forEach(c => {
    const m = (c.motivo_perda || 'Sem motivo').split(' — ')[0]
    motivos.set(m, (motivos.get(m) ?? 0) + 1)
  })
  return {
    etapas,
    perdidas: etapa('Perdidas', ETAPAS.perdida.cor, perdidas),
    conversao: decididas ? efetivadas.length / decididas : null,
    ticket: efetivadas.length ? etapas[3].valor / efetivadas.length : null,
    motivos: [...motivos.entries()].sort((a, b) => b[1] - a[1]),
  }
}

export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const num = (n: number, casas = 2) => n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
export const pct = (n: number, casas = 1) => `${(n * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`
export const dataCurta = (d: string | null) => (d ? new Date(d + 'T12:00').toLocaleDateString('pt-BR') : '—')

// Supabase devolve numeric como string: normaliza as linhas do banco
type LinhaBanco = Record<string, unknown>
const n = (v: unknown) => Number(v ?? 0) || 0
const s = (v: unknown) => (v == null ? null : String(v))

export function itemDoBanco(r: LinhaBanco): ItemCotacao {
  return {
    id: s(r.id) ?? undefined, produto_id: s(r.produto_id), produto_nome: s(r.produto_nome) ?? '', fornecedor: s(r.fornecedor),
    quantidade: n(r.quantidade), unidade: s(r.unidade), preco_tabela: n(r.preco_tabela), desconto: n(r.desconto), frete: n(r.frete),
    data_inicial: s(r.data_inicial), data_final: s(r.data_final), margem: n(r.margem), comissao: n(r.comissao),
    preco_cliente: n(r.preco_cliente), vencimento: s(r.vencimento),
  }
}

export function parametrosDoBanco(r: LinhaBanco): ParametrosCotacao {
  return { ptax: n(r.ptax), juros_mes: n(r.juros_mes), aliquota_icms: n(r.aliquota_icms), aliquota_ir: n(r.aliquota_ir) }
}

// ── Margem mínima ─────────────────────────────────────────
// Preço de venda que zera a diferença para a margem líquida mínima.
// Da fórmula [V]: R·(1 − icms − ir − comissão − mín) = H + I + O − H·icms − (H + I)·ir
export function precoMinimo(it: ItemCotacao, p: ParametrosCotacao, margemMinima: number) {
  const c = calcularItem(it, p)
  const divisor = 1 - p.aliquota_icms - p.aliquota_ir - (it.comissao || 0) - margemMinima
  if (divisor <= 0) return null
  const custo = c.precoLiquido + (it.frete || 0) + c.financiamento - c.precoLiquido * p.aliquota_icms - (c.precoLiquido + (it.frete || 0)) * p.aliquota_ir
  return Math.max(0, custo / divisor)
}

export const abaixoDoMinimo = (it: ItemCotacao, p: ParametrosCotacao, margemMinima: number) =>
  (it.preco_cliente || 0) > 0 && calcularItem(it, p).margemLiquida < margemMinima - 0.000001

export function menorMargem(itens: ItemCotacao[], p: ParametrosCotacao) {
  const m = itens.filter(i => (i.preco_cliente || 0) > 0).map(i => calcularItem(i, p).margemLiquida)
  return m.length ? Math.min(...m) : null
}

export const MOTIVOS_PERDA = ['Preço', 'Prazo / condição de pagamento', 'Concorrente', 'Desistiu da compra', 'Produto indisponível', 'Prazo de entrega', 'Outro']

export const PEDIDO_STATUS: Record<string, string> = { aguardando: 'Aguardando faturamento', faturado: 'Faturado', parcial: 'Entrega parcial', entregue: 'Entregue', cancelado: 'Cancelado' }

// ── Entregas parceladas (cargas) ──────────────────────────
export type Entrega = {
  id: string; cotacao_id: string; produto_nome: string; unidade: string | null; quantidade: number; data: string
  nota_fiscal: string | null; transportador: string | null; motorista: string | null; placa: string | null; observacao: string | null
}
export type SaldoProduto = { chave: string; produto: string; unidade: string; pedido: number; entregue: number; saldo: number; cargas: number }

const chaveProd = (nome: string) => nome.trim().toUpperCase()

// Pedido × entregue × saldo por produto (as cargas se ligam ao item pelo nome do produto)
export function saldoPorProduto(itens: { produto_nome: string; quantidade: number; unidade: string | null }[], entregas: { produto_nome: string; quantidade: number; unidade?: string | null }[]): SaldoProduto[] {
  const m = new Map<string, SaldoProduto>()
  const pegar = (nome: string, unidade: string | null | undefined) => {
    const k = chaveProd(nome)
    if (!m.has(k)) m.set(k, { chave: k, produto: nome.trim(), unidade: unidade || 'TON', pedido: 0, entregue: 0, saldo: 0, cargas: 0 })
    return m.get(k)!
  }
  itens.filter(i => i.produto_nome.trim()).forEach(i => { pegar(i.produto_nome, i.unidade).pedido += Number(i.quantidade) || 0 })
  entregas.forEach(e => { const x = pegar(e.produto_nome, e.unidade); x.entregue += Number(e.quantidade) || 0; x.cargas++ })
  return [...m.values()].map(x => ({ ...x, saldo: Math.max(0, x.pedido - x.entregue) }))
}

// Soma por unidade, para mostrar "80 de 130 TON"
export function totaisPorUnidade(saldos: SaldoProduto[]) {
  const m = new Map<string, { unidade: string; pedido: number; entregue: number; saldo: number }>()
  saldos.forEach(s => {
    const x = m.get(s.unidade) ?? { unidade: s.unidade, pedido: 0, entregue: 0, saldo: 0 }
    x.pedido += s.pedido; x.entregue += s.entregue; x.saldo += s.saldo
    m.set(s.unidade, x)
  })
  return [...m.values()]
}

export const qtd = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
export const PAGAMENTO_STATUS: Record<string, string> = { em_aberto: 'Em aberto', parcial: 'Pago parcialmente', pago: 'Pago' }

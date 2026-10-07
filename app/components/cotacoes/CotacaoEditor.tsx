'use client'

import { hojeISO, somarDias } from '@/lib/dateUtils'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Combobox from '@/app/admin/_ui/Combobox'
import ConfirmDialog from '@/app/admin/_ui/ConfirmDialog'
import NumInput from './NumInput'
import ProdutoPicker, { ProdutoCadastro } from './ProdutoPicker'
import DocumentoCotacao, { DOC_CSS, type DadosDocumento, type TipoDocumento } from './Documento'
import {
  ItemCotacao, ParametrosCotacao, PARAMETROS_PADRAO, STATUS_COTACAO, CalculoItem, MOTIVOS_PERDA, PEDIDO_STATUS, PAGAMENTO_STATUS,
  calcularTotais, itemVazio, itemDoBanco, parametrosDoBanco, brl, num, pct, dataCurta, precoMinimo, abaixoDoMinimo, menorMargem,
} from '@/lib/cotacao'

type ClienteOpcao = { id: string; nome: string; nome_fazenda: string | null; cidade: string | null; estado: string | null; cpf_cnpj: string | null; telefone: string | null; inscricao_produtor: string | null }
type Linha = ItemCotacao & { _k: number }
type Config = { margem_minima: number; validade_cotacao_dias: number; dias_followup: number }
type Historico = { cliente?: { preco: number; data: string; numero: string }; media?: { media: number; n: number } }

type Cabecalho = {
  numero: string
  status: string
  cliente_id: string
  cliente_nome: string
  empresa_rural: string
  cidade: string
  cpf_cnpj: string
  inscricao_produtor: string
  contato: string
  observacoes: string
  observacoes_cliente: string
  transportador: string
  obs_pedido: string
  validade: string
  visita_id: string
  ptax_modo: 'manual' | 'auto'
  ptax_data: string
  motivo_perda: string
  aprovacao_status: string
  aprovacao_obs: string
  aprovacao_margem: number | null
  enviada_em: string
  token_publico: string
  pedido_status: string
  nota_fiscal: string
  faturado_em: string
  entregue_em: string
  pagamento_status: string
  pago_em: string
  pedido_obs: string
}

const OBS_CLIENTE_PADRAO = 'PREÇO CIF - POSTO FAZENDA\nFÁBRICA EUROCHEM - HERINGER\nPRODUTO 100% GRANULADO SEM PÓ\nEMBALAGEM: BIG BAG 1000 QUILOS'

const CAB_VAZIO: Cabecalho = {
  numero: '', status: 'rascunho', cliente_id: '', cliente_nome: '', empresa_rural: '', cidade: '', cpf_cnpj: '',
  inscricao_produtor: '', contato: '', observacoes: '', observacoes_cliente: OBS_CLIENTE_PADRAO, transportador: '', obs_pedido: '',
  validade: '', visita_id: '', ptax_modo: 'manual', ptax_data: '', motivo_perda: '', aprovacao_status: '', aprovacao_obs: '',
  aprovacao_margem: null, enviada_em: '', token_publico: '', pedido_status: '', nota_fiscal: '', faturado_em: '', entregue_em: '',
  pagamento_status: '', pago_em: '', pedido_obs: '',
}

const CONFIG_PADRAO: Config = { margem_minima: 0, validade_cotacao_dias: 7, dias_followup: 3 }
const PRAZOS = [30, 60, 90, 120, 180, 270, 360]

let seq = 0
const novaChave = () => ++seq
const comChave = (i: ItemCotacao): Linha => ({ ...i, _k: novaChave() })
const mac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)
const CTRL = mac ? '⌘' : 'Ctrl'
const chaveProduto = (s: string) => s.trim().toUpperCase()
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(ate.slice(0, 10)) - Date.parse(de.slice(0, 10))) / 86400000)
const telZap = (t: string) => { const d = t.replace(/\D/g, ''); return d ? (d.length <= 11 ? '55' + d : d) : '' }

function Ic({ d, size = 14 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" dangerouslySetInnerHTML={{ __html: d }} />
}
const D = {
  voltar: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  mais: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  lixo: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  impr: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  copiar: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  alerta: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  varinha: '<path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5"/>',
  zap: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  cadeado: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  relogio: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  caminhao: '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  atualizar: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
}
function IconChevron({ aberto }: { aberto: boolean }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><polyline points="6 9 12 15 18 9"/></svg>
}

type Props = { cotacaoId?: string; base: string }

export default function CotacaoEditor({ cotacaoId, base }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()
  const raiz = base.startsWith('/admin') ? '/admin' : '/dashboard'
  const [cab, setCab] = useState<Cabecalho>(CAB_VAZIO)
  const cabAtual = cab
  const [statusSalvo, setStatusSalvo] = useState('rascunho')
  const [param, setParam] = useState<ParametrosCotacao>(PARAMETROS_PADRAO)
  const [config, setConfig] = useState<Config>(CONFIG_PADRAO)
  const [itens, setItens] = useState<Linha[]>([])
  const [produtos, setProdutos] = useState<ProdutoCadastro[]>([])
  const [clientes, setClientes] = useState<ClienteOpcao[]>([])
  const [admin, setAdmin] = useState(false)
  const [uid, setUid] = useState('')
  const [autor, setAutor] = useState('')
  const [autorTel, setAutorTel] = useState('')
  // ?aba=pedido (vindo da lista de pedidos) abre direto na aba do documento
  const [aba, setAba] = useState<'cotacao' | TipoDocumento>(() => {
    const a = params.get('aba')
    return a === 'orcamento' || a === 'pedido' || a === 'resultado' ? a : 'cotacao'
  })
  const [visitaInfo, setVisitaInfo] = useState<{ id: string; data: string } | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [alterado, setAlterado] = useState(false)
  const [excluirAberto, setExcluirAberto] = useState(false)
  const [imprimirAberto, setImprimirAberto] = useState(false)
  const [editandoCliente, setEditandoCliente] = useState(true)
  const [fechados, setFechados] = useState<Set<number>>(new Set())
  const [abaObs, setAbaObs] = useState<'orcamento' | 'pedido' | 'interna'>('orcamento')
  const [focar, setFocar] = useState<number | null>(null)
  const [historico, setHistorico] = useState<{ cliente: Map<string, Historico['cliente']>; media: Map<string, Historico['media']> }>({ cliente: new Map(), media: new Map() })
  const [ptaxStatus, setPtaxStatus] = useState<'' | 'buscando' | 'erro'>('')
  const [perdaAberta, setPerdaAberta] = useState(false)
  const [perdaMotivo, setPerdaMotivo] = useState('')
  const [perdaDetalhe, setPerdaDetalhe] = useState('')
  const [reprovarAberto, setReprovarAberto] = useState(false)
  const [obsAprovacao, setObsAprovacao] = useState('')
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      setUid(user?.id ?? '')
      const [{ data: perfil }, { data: prods }, { data: clis }, { data: cfg }] = await Promise.all([
        supabase.from('profiles').select('role, nome_completo, telefone').eq('id', user?.id ?? '').single(),
        supabase.from('produtos').select('id, nome, fornecedor, unidade, preco_tabela').eq('ativo', true).order('nome'),
        supabase.from('clientes').select('id, nome, nome_fazenda, cidade, estado, cpf_cnpj, telefone, inscricao_produtor').order('nome'),
        supabase.from('configuracoes').select('margem_minima, validade_cotacao_dias, dias_followup').eq('id', 1).maybeSingle(),
      ])
      const conf = cfg ? { margem_minima: Number(cfg.margem_minima), validade_cotacao_dias: cfg.validade_cotacao_dias, dias_followup: cfg.dias_followup } : CONFIG_PADRAO
      setConfig(conf)
      setAdmin(perfil?.role === 'admin')
      setProdutos((prods ?? []).map(p => ({ ...p, preco_tabela: Number(p.preco_tabela) })))
      const listaClientes = (clis ?? []) as ClienteOpcao[]
      setClientes(listaClientes)

      if (cotacaoId) {
        const [{ data: c }, { data: its }] = await Promise.all([
          supabase.from('cotacoes').select('*, autor:profiles!cotacoes_criado_por_fkey(nome_completo, telefone), visita:visitas(id, data_visita)').eq('id', cotacaoId).single(),
          supabase.from('cotacao_itens').select('*').eq('cotacao_id', cotacaoId).order('ordem'),
        ])
        if (!c) { setErro('Cotação não encontrada ou sem permissão.'); setCarregando(false); return }
        const a = Array.isArray(c.autor) ? c.autor[0] : c.autor
        const vis = Array.isArray(c.visita) ? c.visita[0] : c.visita
        setAutor(a?.nome_completo ?? '')
        setAutorTel(a?.telefone ?? '')
        setVisitaInfo(vis ? { id: vis.id, data: vis.data_visita } : null)
        const s = (v: unknown) => (v == null ? '' : String(v))
        setCab({
          numero: c.numero, status: c.status, cliente_id: s(c.cliente_id), cliente_nome: s(c.cliente_nome),
          empresa_rural: s(c.empresa_rural), cidade: s(c.cidade), cpf_cnpj: s(c.cpf_cnpj), inscricao_produtor: s(c.inscricao_produtor),
          contato: s(c.contato), observacoes: s(c.observacoes), observacoes_cliente: s(c.observacoes_cliente),
          transportador: s(c.transportador), obs_pedido: s(c.obs_pedido), validade: s(c.validade), visita_id: s(c.visita_id),
          ptax_modo: c.ptax_modo === 'auto' ? 'auto' : 'manual', ptax_data: s(c.ptax_data), motivo_perda: s(c.motivo_perda),
          aprovacao_status: s(c.aprovacao_status), aprovacao_obs: s(c.aprovacao_obs),
          aprovacao_margem: c.aprovacao_margem != null ? Number(c.aprovacao_margem) : null, enviada_em: s(c.enviada_em),
          token_publico: s(c.token_publico), pedido_status: s(c.pedido_status), nota_fiscal: s(c.nota_fiscal),
          faturado_em: s(c.faturado_em), entregue_em: s(c.entregue_em), pagamento_status: s(c.pagamento_status),
          pago_em: s(c.pago_em), pedido_obs: s(c.pedido_obs),
        })
        setStatusSalvo(c.status)
        setEditandoCliente(!c.cliente_nome)
        setParam(parametrosDoBanco(c))
        const linhas = (its?.length ? its.map(itemDoBanco) : [itemVazio()]).map(comChave)
        setItens(linhas)
        if (linhas.length > 2) setFechados(new Set(linhas.slice(1).map(l => l._k)))
      } else {
        setAutorTel(perfil?.telefone ?? '')
        const novo: Cabecalho = { ...CAB_VAZIO, validade: somarDias(hojeISO(), conf.validade_cotacao_dias) }
        // ?visita= (cotação gerada numa visita) e ?cliente= (ficha do cliente) já trazem o cliente
        const visitaParam = params.get('visita')
        let clienteId = params.get('cliente') ?? ''
        if (visitaParam) {
          const { data: v } = await supabase.from('visitas').select('id, data_visita, cliente_id').eq('id', visitaParam).maybeSingle()
          if (v) { novo.visita_id = v.id; clienteId = v.cliente_id; setVisitaInfo({ id: v.id, data: v.data_visita }) }
        }
        const cli = listaClientes.find(x => x.id === clienteId)
        if (cli) Object.assign(novo, dadosDoCliente(cli))
        setCab(novo)
        setEditandoCliente(!cli)
        setItens([comChave({ ...itemVazio(), data_inicial: hojeISO() })])
      }
      setCarregando(false)
    }
    carregar()
  }, [cotacaoId])

  // Histórico de preços: último preço aprovado para este cliente e média aprovada recente
  useEffect(() => {
    const desde = somarDias(hojeISO(), -180)
    Promise.all([
      cab.cliente_id
        ? supabase.from('cotacoes').select('id, numero, created_at, itens:cotacao_itens(produto_nome, preco_cliente)').eq('cliente_id', cab.cliente_id).eq('status', 'aprovada').order('created_at', { ascending: false }).limit(30)
        : Promise.resolve({ data: [] as { id: string; numero: string; created_at: string; itens: { produto_nome: string; preco_cliente: number }[] }[] }),
      supabase.from('cotacoes').select('id, itens:cotacao_itens(produto_nome, preco_cliente, quantidade)').eq('status', 'aprovada').gte('created_at', desde).limit(300),
    ]).then(([doCliente, recentes]) => {
      const cliente = new Map<string, Historico['cliente']>()
      ;(doCliente.data ?? []).forEach(q => {
        if (q.id === cotacaoId) return
        ;(q.itens ?? []).forEach(i => { const k = chaveProduto(i.produto_nome); if (!cliente.has(k)) cliente.set(k, { preco: Number(i.preco_cliente), data: q.created_at, numero: q.numero }) })
      })
      const soma = new Map<string, { v: number; q: number; n: number }>()
      ;(recentes.data ?? []).forEach(q => {
        if (q.id === cotacaoId) return
        ;(q.itens ?? []).forEach(i => {
          const k = chaveProduto(i.produto_nome)
          const x = soma.get(k) ?? { v: 0, q: 0, n: 0 }
          const qt = Number(i.quantidade) || 1
          x.v += Number(i.preco_cliente) * qt; x.q += qt; x.n++
          soma.set(k, x)
        })
      })
      const media = new Map<string, Historico['media']>()
      soma.forEach((x, k) => media.set(k, { media: x.v / x.q, n: x.n }))
      setHistorico({ cliente, media })
    })
  }, [cab.cliente_id, cotacaoId])

  useEffect(() => {
    if (!alterado) return
    const aviso = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [alterado])

  useEffect(() => {
    if (focar == null) return
    document.querySelector<HTMLInputElement>(`[data-picker="${focar}"]`)?.focus()
  }, [focar])

  const tot = useMemo(() => calcularTotais(itens, param), [itens, param])

  // Margem mínima: consultor não envia abaixo dela sem aprovação do admin (o banco também barra)
  const minMargem = useMemo(() => menorMargem(itens, param), [itens, param])
  const abaixo = useMemo(() => itens.some(i => abaixoDoMinimo(i, param, config.margem_minima)), [itens, param, config.margem_minima])
  const coberta = cab.aprovacao_status === 'aprovada' && minMargem != null && minMargem >= (cab.aprovacao_margem ?? 1) - 0.000001
  const liberada = admin || !abaixo || coberta
  const linkPublico = typeof window !== 'undefined' && cab.token_publico ? `${window.location.origin}/o/${cab.token_publico}` : ''

  function marcar() { setAlterado(true); setOk('') }
  function mudarCab<K extends keyof Cabecalho>(k: K, v: Cabecalho[K]) { setCab(c => ({ ...c, [k]: v })); marcar() }
  function mudarParam<K extends keyof ParametrosCotacao>(k: K, v: number) { setParam(p => ({ ...p, [k]: v })); marcar() }
  function mudarItem(k: number, campos: Partial<ItemCotacao>) {
    setItens(lista => lista.map(it => (it._k === k ? { ...it, ...campos } : it)))
    marcar()
  }

  function dadosDoCliente(c: ClienteOpcao): Partial<Cabecalho> {
    return {
      cliente_id: c.id, cliente_nome: c.nome, empresa_rural: c.nome_fazenda ?? '',
      cidade: [c.cidade, c.estado].filter(Boolean).join(' - '), cpf_cnpj: c.cpf_cnpj ?? '',
      inscricao_produtor: c.inscricao_produtor ?? '', contato: c.telefone ?? '',
    }
  }

  function escolherCliente(id: string) {
    const c = clientes.find(x => x.id === id)
    if (!c) return
    setCab(atual => ({ ...atual, ...dadosDoCliente(c) }))
    setEditandoCliente(false)
    marcar()
  }

  function escolherProduto(k: number, p: ProdutoCadastro) {
    mudarItem(k, { produto_id: p.id, produto_nome: p.nome, fornecedor: p.fornecedor, unidade: p.unidade, preco_tabela: p.preco_tabela })
  }

  function definirPrazo(it: Linha, dias: number) {
    const inicio = it.data_inicial || hojeISO()
    const fim = somarDias(inicio, dias)
    mudarItem(it._k, { data_inicial: inicio, data_final: fim, vencimento: fim })
  }

  function adicionarItem(origem?: Linha) {
    const ult = origem ?? itens[itens.length - 1]
    const nova = origem
      ? { ...origem, id: undefined, _k: novaChave() }
      : comChave({ ...itemVazio(), data_inicial: ult?.data_inicial ?? hojeISO(), data_final: ult?.data_final ?? null, vencimento: ult?.vencimento ?? null, margem: ult?.margem ?? 0, comissao: ult?.comissao ?? 0, frete: ult?.frete ?? 0 })
    setItens(l => {
      if (!origem) return [...l, nova]
      const idx = l.findIndex(x => x._k === origem._k)
      return [...l.slice(0, idx + 1), nova, ...l.slice(idx + 1)]
    })
    setFocar(nova._k)
    marcar()
  }

  function removerItem(k: number) {
    setItens(l => (l.length === 1 ? [comChave({ ...itemVazio(), data_inicial: hojeISO() })] : l.filter(x => x._k !== k)))
    marcar()
  }

  function alternar(k: number) {
    setFechados(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })
  }

  async function buscarPtax() {
    setPtaxStatus('buscando')
    try {
      const r = await fetch('/api/ptax')
      const j = await r.json()
      if (!r.ok || !j.valor) throw new Error()
      setParam(p => ({ ...p, ptax: Number(j.valor) }))
      setCab(c => ({ ...c, ptax_modo: 'auto', ptax_data: j.data }))
      setPtaxStatus('')
      marcar()
    } catch {
      setPtaxStatus('erro')
    }
  }

  function mensagemErro(e: { message?: string } | null, padrao: string) {
    const m = e?.message ?? ''
    return /margem|motivo|aprova/i.test(m) ? m : padrao
  }

  // Salva cabeçalho → itens (de uma vez) → status. Assim a checagem de margem do banco vê os itens finais.
  async function salvar(statusForcado?: string, extra: Partial<Cabecalho> = {}): Promise<string | null> {
    setErro(''); setOk('')
    const cab = { ...cabAtual, ...extra }
    if (!cab.cliente_nome.trim()) { setErro('Informe o cliente da cotação.'); setEditandoCliente(true); return null }
    const validos = itens.filter(i => i.produto_nome.trim())
    if (validos.length === 0) { setErro('Adicione ao menos um produto.'); return null }
    const statusDesejado = statusForcado ?? cab.status
    const semQtd = validos.find(i => !(i.quantidade > 0))
    if (semQtd && (statusDesejado === 'enviada' || statusDesejado === 'aprovada')) {
      setErro(`Informe a quantidade de "${semQtd.produto_nome}" antes de enviar.`)
      setFechados(f => { const n = new Set(f); n.delete(semQtd._k); return n })
      setTimeout(() => document.querySelector<HTMLInputElement>(`[data-qtd="${semQtd._k}"]`)?.focus(), 50)
      return null
    }
    if (!admin && (statusDesejado === 'enviada' || statusDesejado === 'aprovada') && !liberada) {
      setErro('Há preço abaixo do mínimo permitido. Solicite a aprovação do administrador antes de enviar.')
      return null
    }
    setSalvando(true)

    const nulo = (v: string) => v || null
    const payload: Record<string, unknown> = {
      cliente_id: nulo(cab.cliente_id), cliente_nome: cab.cliente_nome.trim(),
      empresa_rural: nulo(cab.empresa_rural), cidade: nulo(cab.cidade), cpf_cnpj: nulo(cab.cpf_cnpj),
      inscricao_produtor: nulo(cab.inscricao_produtor), contato: nulo(cab.contato),
      observacoes: nulo(cab.observacoes), observacoes_cliente: nulo(cab.observacoes_cliente),
      transportador: nulo(cab.transportador), obs_pedido: nulo(cab.obs_pedido),
      validade: nulo(cab.validade), visita_id: nulo(cab.visita_id), ptax_modo: cab.ptax_modo, ptax_data: nulo(cab.ptax_data),
      motivo_perda: nulo(cab.motivo_perda), aprovacao_status: nulo(cab.aprovacao_status),
      pedido_status: nulo(cab.pedido_status), nota_fiscal: nulo(cab.nota_fiscal), faturado_em: nulo(cab.faturado_em),
      entregue_em: nulo(cab.entregue_em), pagamento_status: nulo(cab.pagamento_status), pago_em: nulo(cab.pago_em),
      pedido_obs: nulo(cab.pedido_obs),
      ...param, updated_at: new Date().toISOString(),
    }

    // rascunho/perdida mudam junto com o cabeçalho (antes dos itens); enviada/aprovada só depois, já com os itens finais
    const statusAtual = cotacaoId ? statusSalvo : 'rascunho'
    const statusJunto = !!cotacaoId && statusDesejado !== statusAtual && (statusDesejado === 'rascunho' || statusDesejado === 'perdida')
    if (statusJunto) payload.status = statusDesejado

    let id = cotacaoId
    if (id) {
      const { error } = await supabase.from('cotacoes').update(payload).eq('id', id)
      if (error) { setErro(mensagemErro(error, 'Erro ao salvar a cotação.')); setSalvando(false); return null }
    } else {
      const { data, error } = await supabase.from('cotacoes').insert({ ...payload, status: 'rascunho' }).select('id').single()
      if (error || !data) { setErro(mensagemErro(error, 'Erro ao criar a cotação.')); setSalvando(false); return null }
      id = data.id
    }

    const { error: errIt } = await supabase.rpc('salvar_itens_cotacao', { p_cotacao: id, p_itens: linhasParaBanco(validos) })
    if (errIt) { setErro(mensagemErro(errIt, 'Erro ao salvar os produtos. Nada foi alterado nos itens.')); setSalvando(false); return cotacaoId ? null : id ?? null }

    if (statusDesejado !== statusAtual && !statusJunto) {
      const { error: errSt } = await supabase.from('cotacoes').update({ status: statusDesejado, motivo_perda: nulo(cab.motivo_perda) }).eq('id', id)
      if (errSt) {
        setErro(mensagemErro(errSt, 'A cotação foi salva, mas o status não pôde ser alterado.'))
        setSalvando(false)
        if (!cotacaoId) router.replace(`${base}/${id}`)
        return null
      }
    }

    setSalvando(false)
    setAlterado(false)
    if (!cotacaoId) { router.replace(`${base}/${id}`); return id ?? null }
    // recarrega campos que o banco preenche (data de envio, pedido)
    const { data: atual } = await supabase.from('cotacoes').select('status, enviada_em, pedido_status, pagamento_status, aprovacao_status').eq('id', id).single()
    if (atual) {
      setStatusSalvo(atual.status)
      setCab(c => ({ ...c, status: atual.status, enviada_em: atual.enviada_em ?? '', pedido_status: atual.pedido_status ?? '', pagamento_status: atual.pagamento_status ?? '', aprovacao_status: atual.aprovacao_status ?? '' }))
    }
    setOk('Cotação salva.')
    return id ?? null
  }

  function mudarStatus(st: string) {
    if (st === cab.status) return
    if (st === 'perdida') { setPerdaMotivo(''); setPerdaDetalhe(''); setPerdaAberta(true); return }
    mudarCab('status', st)
  }

  function confirmarPerda() {
    const motivo = perdaMotivo === 'Outro' ? perdaDetalhe.trim() || 'Outro' : [perdaMotivo, perdaDetalhe.trim()].filter(Boolean).join(' — ')
    setCab(c => ({ ...c, status: 'perdida', motivo_perda: motivo }))
    marcar()
    setPerdaAberta(false)
  }

  async function solicitarAprovacao() {
    const extra: Partial<Cabecalho> = { aprovacao_status: 'pendente', status: 'rascunho' }
    setCab(c => ({ ...c, ...extra }))
    const id = await salvar('rascunho', extra)
    if (id) setOk('Aprovação solicitada. O administrador vai analisar o preço.')
  }

  async function decidirAprovacao(aprovar: boolean) {
    if (!cotacaoId) return
    if (alterado) { setErro('Salve a cotação antes de aprovar ou reprovar.'); return }
    const campos = aprovar
      ? { aprovacao_status: 'aprovada', aprovacao_margem: minMargem ?? 0, aprovado_por: uid, aprovado_em: new Date().toISOString(), aprovacao_obs: obsAprovacao || null }
      : { aprovacao_status: 'reprovada', aprovacao_obs: obsAprovacao || null }
    const { error } = await supabase.from('cotacoes').update(campos).eq('id', cotacaoId)
    if (error) { setErro('Não foi possível registrar a decisão.'); return }
    setCab(c => ({ ...c, aprovacao_status: campos.aprovacao_status, aprovacao_obs: obsAprovacao, ...(aprovar ? { aprovacao_margem: minMargem ?? 0 } : {}) }))
    setReprovarAberto(false)
    setObsAprovacao('')
    setOk(aprovar ? 'Preço aprovado. O consultor já pode enviar a cotação.' : 'Preço reprovado. O consultor foi orientado a revisar.')
  }

  async function imprimir(doc: string) {
    setImprimirAberto(false)
    if (doc !== 'resultado' && !liberada) { setErro('Documento bloqueado: há preço abaixo do mínimo sem aprovação.'); return }
    const id = alterado || !cotacaoId ? await salvar() : cotacaoId
    if (id) window.open(`/imprimir/cotacao/${id}?doc=${doc}`, '_blank')
  }

  // Envio ao cliente: marca como enviada (se ainda não estava) e abre WhatsApp/e-mail com o link do orçamento
  async function enviarCliente(canal: 'whatsapp' | 'email' | 'link') {
    if (!liberada) { setErro('Há preço abaixo do mínimo sem aprovação. Solicite a aprovação antes de enviar.'); return }
    const janela = canal === 'whatsapp' ? window.open('', '_blank') : null
    const precisaEnviar = cab.status === 'rascunho'
    const id = alterado || !cotacaoId || precisaEnviar ? await salvar(precisaEnviar ? 'enviada' : undefined) : cotacaoId
    if (!id) { janela?.close(); return }
    const link = `${window.location.origin}/o/${cab.token_publico}`
    const nome = cab.cliente_nome.split(' ')[0]
    const texto = `Olá, ${nome}! Segue o orçamento Nº ${cab.numero} da Aderi Agro${cab.validade ? `, válido até ${dataCurta(cab.validade)}` : ''}: ${link}`
    if (canal === 'whatsapp' && janela) janela.location.href = `https://wa.me/${telZap(cab.contato)}?text=${encodeURIComponent(texto)}`
    if (canal === 'email') window.location.href = `mailto:?subject=${encodeURIComponent(`Orçamento Nº ${cab.numero} - Aderi Agro`)}&body=${encodeURIComponent(texto)}`
    if (canal === 'link') { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2000) }
  }

  function cobrarFollowup() {
    const texto = `Olá, ${cab.cliente_nome.split(' ')[0]}! Conseguiu avaliar o orçamento Nº ${cab.numero}? Fico à disposição para qualquer ajuste. ${linkPublico}`
    window.open(`https://wa.me/${telZap(cab.contato)}?text=${encodeURIComponent(texto)}`, '_blank')
  }

  async function duplicar() {
    const { error, data } = await supabase.from('cotacoes').insert({
      status: 'rascunho', cliente_id: cab.cliente_id || null, cliente_nome: cab.cliente_nome, empresa_rural: cab.empresa_rural || null,
      cidade: cab.cidade || null, cpf_cnpj: cab.cpf_cnpj || null, inscricao_produtor: cab.inscricao_produtor || null, contato: cab.contato || null,
      observacoes: cab.observacoes || null, observacoes_cliente: cab.observacoes_cliente || null, transportador: cab.transportador || null,
      obs_pedido: cab.obs_pedido || null, validade: somarDias(hojeISO(), config.validade_cotacao_dias), ptax_modo: cab.ptax_modo, ...param,
    }).select('id').single()
    if (error || !data) { setErro('Erro ao duplicar.'); return }
    await supabase.rpc('salvar_itens_cotacao', { p_cotacao: data.id, p_itens: linhasParaBanco(itens.filter(i => i.produto_nome.trim())) })
    router.push(`${base}/${data.id}`)
  }

  async function excluir() {
    if (!cotacaoId) return
    const { error } = await supabase.from('cotacoes').delete().eq('id', cotacaoId)
    if (error) { setErro('Erro ao excluir.'); setExcluirAberto(false); return }
    router.push(base)
  }

  function navegarEnter(e: React.KeyboardEvent<HTMLDivElement>) {
    const alvo = e.target as HTMLElement
    if (e.key !== 'Enter' || e.ctrlKey || e.metaKey || alvo.tagName !== 'INPUT') return
    e.preventDefault()
    const campos = [...document.querySelectorAll<HTMLInputElement>('[data-nav]')]
    const idx = campos.indexOf(alvo as HTMLInputElement)
    if (idx >= 0 && idx < campos.length - 1) campos[idx + 1].focus()
    else document.querySelector<HTMLButtonElement>('[data-add-produto]')?.focus()
  }

  const atalhos = useRef({ salvar, adicionarItem, imprimir })
  useEffect(() => { atalhos.current = { salvar, adicionarItem, imprimir } })
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (mod && k === 's') { e.preventDefault(); atalhos.current.salvar() }
      else if (mod && k === 'p') { e.preventDefault(); atalhos.current.imprimir(e.shiftKey ? 'pedido' : 'orcamento') }
      else if (e.altKey && k === 'n') { e.preventDefault(); atalhos.current.adicionarItem() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const opcoesClientes = useMemo(() => clientes.map(c => ({ id: c.id, label: c.nome, sub: [c.nome_fazenda, [c.cidade, c.estado].filter(Boolean).join('/')].filter(Boolean).join(' · ') })), [clientes])

  if (carregando) {
    return <div className="ui-card ui-card-pad"><div className="ui-skeleton" style={{ height: 18, width: 220, marginBottom: 12 }} /><div className="ui-skeleton" style={{ height: 160 }} /></div>
  }

  const st = STATUS_COTACAO[cab.status] ?? STATUS_COTACAO.rascunho
  const dadosDoc: DadosDocumento = {
    numero: cab.numero, emissao: null, validade: cab.validade || null, cliente_nome: cab.cliente_nome, empresa_rural: cab.empresa_rural || null,
    cidade: cab.cidade || null, cpf_cnpj: cab.cpf_cnpj || null, inscricao_produtor: cab.inscricao_produtor || null, contato: cab.contato || null,
    transportador: cab.transportador || null, obs_pedido: cab.obs_pedido || null, observacoes_cliente: cab.observacoes_cliente || null,
    observacoes: cab.observacoes || null, autor_nome: autor || null, autor_telefone: autorTel || null,
  }
  const preenchidos = itens.filter(i => i.produto_nome.trim()).length
  const corResultado = tot.resultado < 0 ? '#c0392b' : '#1e8a4c'
  const hoje = hojeISO()
  const diasEnviada = cab.status === 'enviada' && cab.enviada_em ? diasEntre(cab.enviada_em, hoje) : null
  const diasValidade = cab.validade && (cab.status === 'rascunho' || cab.status === 'enviada') ? diasEntre(hoje, cab.validade) : null

  return (
    <>
      <style>{EDITOR_CSS}</style>

      <div className="ui-breadcrumb">
        <Link href={base}><Ic d={D.voltar} /> Cotações</Link>
        <span className="ui-breadcrumb-sep">/</span>
        <span className="ui-breadcrumb-atual">{cotacaoId ? cab.numero : 'Nova cotação'}</span>
      </div>

      <div className="ui-page-header">
        <div>
          <div className="ui-title">{cotacaoId ? `Cotação ${cab.numero}` : 'Nova cotação'}</div>
          <div className="ui-sub">
            {autor ? `Criada por ${autor}` : 'Escolha o cliente e adicione os produtos. O preço sugerido é calculado na hora.'}
            {visitaInfo && <> · <Link href={`${raiz}/visitas/${visitaInfo.id}`} style={{ color: '#E67E22', fontWeight: 600 }}>gerada na visita de {dataCurta(visitaInfo.data)}</Link></>}
          </div>
        </div>
        <div className="ui-header-actions">
          <div className="ce-status" role="radiogroup" aria-label="Status">
            {Object.entries(STATUS_COTACAO).map(([k, v]) => {
              const bloqueado = !liberada && (k === 'enviada' || k === 'aprovada')
              return (
                <button key={k} role="radio" aria-checked={cab.status === k} disabled={bloqueado}
                  title={bloqueado ? 'Preço abaixo do mínimo: precisa de aprovação do administrador' : undefined}
                  className={`ce-status-btn ${cab.status === k ? `ativo ${k}` : ''}`} onClick={() => mudarStatus(k)}>{v.label}</button>
              )
            })}
          </div>
        </div>
      </div>

      {erro && <div className="ui-alert ui-alert-erro"><Ic d={D.alerta} size={15} /> {erro}</div>}
      {ok && <div className="ui-alert ui-alert-ok"><Ic d={D.check} /> {ok}</div>}

      {/* ── Avisos de aprovação, follow-up e validade ── */}
      {abaixo && !coberta && (
        <div className={`ce-faixa ${admin ? 'info' : 'alerta'}`}>
          <Ic d={D.cadeado} size={16} />
          <div style={{ flex: 1 }}>
            <b>{admin ? 'Preço abaixo da margem mínima' : 'Preço abaixo do mínimo permitido'}</b>
            <div>
              {cab.aprovacao_status === 'pendente' ? 'Aguardando aprovação do administrador.'
                : cab.aprovacao_status === 'reprovada' ? `Aprovação reprovada${cab.aprovacao_obs ? `: ${cab.aprovacao_obs}` : ''}. Revise o preço ou solicite de novo.`
                : admin ? `Margem líquida mínima configurada: ${pct(config.margem_minima, 1)}. Como administrador, você pode enviar mesmo assim.`
                : 'Ajuste o preço (veja o mínimo em cada produto) ou solicite a aprovação do administrador para enviar.'}
            </div>
          </div>
          {!admin && cab.aprovacao_status !== 'pendente' && <button className="ui-btn ui-btn-dark ui-btn-sm" onClick={solicitarAprovacao} disabled={salvando}>Solicitar aprovação</button>}
          {admin && cab.aprovacao_status === 'pendente' && (
            <div style={{ display: 'flex', gap: '.4rem' }}>
              <button className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => { setObsAprovacao(''); setReprovarAberto(true) }}>Reprovar</button>
              <button className="ui-btn ui-btn-success ui-btn-sm" onClick={() => decidirAprovacao(true)}>Aprovar preço</button>
            </div>
          )}
        </div>
      )}
      {abaixo && coberta && <div className="ce-faixa ok"><Ic d={D.check} /> <div><b>Preço aprovado pelo administrador</b>{cab.aprovacao_obs ? <div>{cab.aprovacao_obs}</div> : null}</div></div>}
      {diasEnviada != null && diasEnviada >= config.dias_followup && (
        <div className="ce-faixa alerta">
          <Ic d={D.relogio} size={16} />
          <div style={{ flex: 1 }}><b>Enviada há {diasEnviada} dias sem resposta</b><div>Faça um follow-up com o cliente ou atualize o status.</div></div>
          <button className="ui-btn ui-btn-success ui-btn-sm" onClick={cobrarFollowup}><Ic d={D.zap} /> Cobrar pelo WhatsApp</button>
        </div>
      )}
      {diasValidade != null && diasValidade <= 2 && (
        <div className={`ce-faixa ${diasValidade < 0 ? 'erro' : 'alerta'}`}>
          <Ic d={D.relogio} size={16} />
          <div style={{ flex: 1 }}><b>{diasValidade < 0 ? `Validade vencida há ${-diasValidade} dia${diasValidade === -1 ? '' : 's'}` : diasValidade === 0 ? 'Validade vence hoje' : `Validade vence em ${diasValidade} dia${diasValidade === 1 ? '' : 's'}`}</b><div>Confira os preços antes de renovar.</div></div>
          <button className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => mudarCab('validade', somarDias(hoje, config.validade_cotacao_dias))}>Renovar por {config.validade_cotacao_dias} dias</button>
        </div>
      )}
      {cab.status === 'perdida' && cab.motivo_perda && <div className="ce-faixa erro"><Ic d={D.alerta} size={16} /><div><b>Perdida</b><div>Motivo: {cab.motivo_perda}</div></div></div>}

      <div className="ce-abas" role="tablist" aria-label="Documentos da cotação">
        {([
          ['cotacao', 'Cotação', 'Preencher'],
          ['orcamento', 'Orçamento', 'Para o cliente'],
          ['pedido', 'Pedido', 'Pedido de compra'],
          ...(admin ? [['resultado', 'Resultado', 'Custos (interno)']] : []),
        ] as [typeof aba, string, string][]).map(([k, t, d]) => (
          <button key={k} role="tab" aria-selected={aba === k} className={`ce-aba ${aba === k ? 'ativo' : ''}`} onClick={() => setAba(k)}>
            <span className="ce-aba-t">{t}</span><span className="ce-aba-d">{d}</span>
          </button>
        ))}
        <span className="ce-abas-dica">Orçamento, Pedido e Resultado são gerados automaticamente a partir da cotação, como nas abas da planilha.</span>
      </div>

      {aba !== 'cotacao' && (
        <div className="ce-doc">
          <div className="ce-doc-barra">
            <div className="ce-doc-info">
              {aba === 'orcamento' && 'Documento enviado ao cliente: produtos, quantidades, preço de venda e vencimentos.'}
              {aba === 'pedido' && 'Pedido de compra (Verde Agro) para o cliente assinar. Abaixo, o acompanhamento de faturamento, entrega e pagamento.'}
              {aba === 'resultado' && 'Custos e resultado de cada produto. Uso interno, só para administradores.'}
              {alterado && <b> As alterações ainda não foram salvas.</b>}
            </div>
            <div className="ce-doc-acoes">
              {aba === 'orcamento' && cotacaoId && cab.status !== 'perdida' && <>
                <button className="ui-btn ui-btn-success ui-btn-sm" onClick={() => enviarCliente('whatsapp')} disabled={!liberada || salvando}><Ic d={D.zap} /> WhatsApp</button>
                <button className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => enviarCliente('email')} disabled={!liberada || salvando}><Ic d={D.mail} /> E-mail</button>
                <button className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => enviarCliente('link')} disabled={!liberada || salvando}><Ic d={D.link} /> {copiado ? 'Copiado!' : 'Copiar link'}</button>
              </>}
              <button className="ui-btn ui-btn-primary ui-btn-sm" onClick={() => imprimir(aba)} disabled={salvando || (aba !== 'resultado' && !liberada)}><Ic d={D.impr} /> Imprimir / PDF</button>
            </div>
          </div>
          {aba === 'pedido' && cab.status !== 'aprovada' && !cab.pedido_status && (
            <div className="ce-faixa info" style={{ maxWidth: '210mm', margin: '0 auto 1rem' }}><Ic d={D.alerta} size={16} /><div>O pedido já pode ser impresso para o cliente assinar. Quando ele aprovar, marque a cotação como <b>Aprovada</b> e acompanhe aqui o faturamento, a entrega e o pagamento.</div></div>
          )}
          {aba === 'pedido' && (cab.status === 'aprovada' || cab.pedido_status) && (
            <section className="ui-card ce-sec" style={{ maxWidth: '210mm', margin: '0 auto 1.2rem' }}>
              <div className="ce-sec-head">
                <span className="ce-step" style={{ background: '#1a7f4b' }}><Ic d={D.caminhao} size={12} /></span>
                <span className="ce-sec-tit">Pedido</span>
                {cab.pedido_status && <span className={`ui-badge ${cab.pedido_status === 'entregue' ? 'ui-badge-realizada' : cab.pedido_status === 'cancelado' ? 'ui-badge-cancelada' : 'ui-badge-agendada'}`} style={{ marginLeft: 'auto' }}>{PEDIDO_STATUS[cab.pedido_status]}</span>}
              </div>
              <div className="ce-sec-body">
                <div className="ce-campos" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
                  <div className="ui-field"><label className="ui-label">Situação do pedido</label>
                    <select className="ui-select" value={cab.pedido_status} onChange={e => mudarCab('pedido_status', e.target.value)}>
                      <option value="">—</option>{Object.entries(PEDIDO_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="ui-field"><label className="ui-label">Nota fiscal</label><input className="ui-input" value={cab.nota_fiscal} onChange={e => mudarCab('nota_fiscal', e.target.value)} placeholder="Nº da NF" /></div>
                  <div className="ui-field"><label className="ui-label">Faturado em</label><input type="date" className="ui-input" value={cab.faturado_em} onChange={e => mudarCab('faturado_em', e.target.value)} /></div>
                  <div className="ui-field"><label className="ui-label">Entregue em</label><input type="date" className="ui-input" value={cab.entregue_em} onChange={e => { mudarCab('entregue_em', e.target.value); if (e.target.value && cab.pedido_status !== 'cancelado') mudarCab('pedido_status', 'entregue') }} /></div>
                  <div className="ui-field"><label className="ui-label">Pagamento</label>
                    <select className="ui-select" value={cab.pagamento_status} onChange={e => mudarCab('pagamento_status', e.target.value)}>
                      <option value="">—</option>{Object.entries(PAGAMENTO_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="ui-field"><label className="ui-label">Pago em</label><input type="date" className="ui-input" value={cab.pago_em} onChange={e => mudarCab('pago_em', e.target.value)} /></div>
                </div>
                <div className="ui-field" style={{ marginBottom: 0 }}><label className="ui-label">Observações do pedido</label><input className="ui-input" value={cab.pedido_obs} onChange={e => mudarCab('pedido_obs', e.target.value)} placeholder="Ex.: entrega em 2 cargas, pagamento parcial na safra..." /></div>
              </div>
            </section>
          )}
          {aba !== 'resultado' && !liberada
            ? <div className="ce-faixa alerta" style={{ maxWidth: '210mm', margin: '0 auto' }}><Ic d={D.cadeado} size={16} /><div><b>Documento bloqueado</b><div>Há preço abaixo do mínimo permitido. Solicite a aprovação do administrador na aba Cotação.</div></div></div>
            : <DocumentoCotacao tipo={aba} dados={dadosDoc} itens={itens} param={param} embutida />}
        </div>
      )}

      {aba === 'cotacao' && (
      <div className="ce-layout">
        <div className="ce-main">
          <section className="ui-card ce-sec">
            <div className="ce-sec-head">
              <span className="ce-step">1</span>
              <span className="ce-sec-tit">Cliente</span>
              {!editandoCliente && <button className="ui-btn ui-btn-ghost ui-btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setEditandoCliente(true)}>Alterar</button>}
            </div>
            {!editandoCliente ? (
              <div className="ce-cli">
                <div className="ce-cli-av"><Ic d={D.user} size={18} /></div>
                <div style={{ minWidth: 0 }}>
                  <div className="ce-cli-nome">{cab.cliente_nome}</div>
                  <div className="ce-cli-sub">{[cab.empresa_rural, cab.cidade].filter(Boolean).join(' · ') || 'Sem fazenda / cidade'}</div>
                  <div className="ce-cli-meta">
                    {cab.cpf_cnpj && <span>CPF/CNPJ {cab.cpf_cnpj}</span>}
                    {cab.inscricao_produtor && <span>IE {cab.inscricao_produtor}</span>}
                    {cab.contato && <span>{cab.contato}</span>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="ce-sec-body">
                <Combobox opcoes={opcoesClientes} valor={cab.cliente_id} onChange={escolherCliente} placeholder="Buscar cliente da carteira..." vazioTexto="Nenhum cliente encontrado" />
                <div className="ce-ou"><span>ou preencha / ajuste os dados</span></div>
                <div className="ce-campos">
                  <div className="ui-field ce-span2"><label className="ui-label">Empresário rural <span className="ui-req">*</span></label><input className="ui-input" value={cab.cliente_nome} onChange={e => mudarCab('cliente_nome', e.target.value)} /></div>
                  <div className="ui-field"><label className="ui-label">Empresa rural</label><input className="ui-input" value={cab.empresa_rural} onChange={e => mudarCab('empresa_rural', e.target.value)} /></div>
                  <div className="ui-field"><label className="ui-label">Cidade</label><input className="ui-input" value={cab.cidade} onChange={e => mudarCab('cidade', e.target.value)} /></div>
                  <div className="ui-field"><label className="ui-label">CPF / CNPJ</label><input className="ui-input" value={cab.cpf_cnpj} onChange={e => mudarCab('cpf_cnpj', e.target.value)} /></div>
                  <div className="ui-field"><label className="ui-label">Inscrição do produtor</label><input className="ui-input" value={cab.inscricao_produtor} onChange={e => mudarCab('inscricao_produtor', e.target.value)} /></div>
                  <div className="ui-field ce-span2"><label className="ui-label">Contato (telefone p/ WhatsApp)</label><input className="ui-input" value={cab.contato} onChange={e => mudarCab('contato', e.target.value)} /></div>
                </div>
                {cab.cliente_nome.trim() && <button className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => setEditandoCliente(false)}><Ic d={D.check} /> Pronto</button>}
              </div>
            )}
          </section>

          <div className="ce-prod-head">
            <span className="ce-step">2</span>
            <span className="ce-sec-tit">Produtos</span>
            <span className="ce-count">{preenchidos}</span>
            {itens.length > 1 && <button className="ce-link" onClick={() => setFechados(fechados.size ? new Set() : new Set(itens.map(i => i._k)))}>{fechados.size ? 'Expandir todos' : 'Recolher todos'}</button>}
          </div>

          <div onKeyDown={navegarEnter}>
            {itens.map((it, idx) => (
              <ItemCard
                key={it._k}
                it={it}
                idx={idx}
                c={tot.calc[idx]}
                admin={admin}
                produtos={produtos}
                aberto={!fechados.has(it._k)}
                minimo={precoMinimo(it, param, config.margem_minima)}
                abaixo={abaixoDoMinimo(it, param, config.margem_minima) && !coberta}
                historico={{ cliente: historico.cliente.get(chaveProduto(it.produto_nome)), media: historico.media.get(chaveProduto(it.produto_nome)) }}
                onAlternar={() => alternar(it._k)}
                onMudar={campos => mudarItem(it._k, campos)}
                onEscolher={p => escolherProduto(it._k, p)}
                onPrazo={d => definirPrazo(it, d)}
                onDuplicar={() => adicionarItem(it)}
                onRemover={() => removerItem(it._k)}
              />
            ))}
          </div>

          <button className="ce-add" data-add-produto onClick={() => adicionarItem()}><Ic d={D.mais} size={15} /> Adicionar produto <kbd>Alt N</kbd></button>
          {produtos.length === 0 && (
            <div className="ce-aviso">{admin ? <>Nenhum produto cadastrado ainda. <Link href="/admin/produtos">Cadastrar produtos</Link> para escolher da lista.</> : 'Nenhum produto no cadastro: digite o nome do produto.'}</div>
          )}

          <section className="ui-card ce-sec" style={{ marginTop: '1.2rem' }}>
            <div className="ce-sec-head">
              <span className="ce-step">3</span>
              <span className="ce-sec-tit">Observações</span>
              <div className="ui-segmented" style={{ marginLeft: 'auto' }}>
                <button className={abaObs === 'orcamento' ? 'ativo' : ''} onClick={() => setAbaObs('orcamento')}>Orçamento</button>
                <button className={abaObs === 'pedido' ? 'ativo' : ''} onClick={() => setAbaObs('pedido')}>Pedido</button>
                <button className={abaObs === 'interna' ? 'ativo' : ''} onClick={() => setAbaObs('interna')}>Interna</button>
              </div>
            </div>
            <div className="ce-sec-body">
              {abaObs === 'orcamento' && <><textarea className="ui-textarea" value={cab.observacoes_cliente} onChange={e => mudarCab('observacoes_cliente', e.target.value)} /><div className="ui-hint">Sai no orçamento enviado ao cliente.</div></>}
              {abaObs === 'pedido' && (
                <div className="ce-campos" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="ui-field"><label className="ui-label">Transportador</label><input className="ui-input" value={cab.transportador} onChange={e => mudarCab('transportador', e.target.value)} /></div>
                  <div className="ui-field"><label className="ui-label">Observação do pedido de compra</label><input className="ui-input" value={cab.obs_pedido} onChange={e => mudarCab('obs_pedido', e.target.value)} /></div>
                </div>
              )}
              {abaObs === 'interna' && <><textarea className="ui-textarea" value={cab.observacoes} onChange={e => mudarCab('observacoes', e.target.value)} placeholder="Anotações da negociação, não aparecem para o cliente" /><div className="ui-hint">Só aparece aqui e no documento de resultado.</div></>}
            </div>
          </section>

          {cotacaoId && (
            <div style={{ marginTop: '1.4rem', display: 'flex', gap: '.6rem' }}>
              <button className="ui-btn ui-btn-ghost ui-btn-sm" onClick={duplicar}><Ic d={D.copiar} /> Duplicar cotação</button>
              <button className="ui-btn ui-btn-danger ui-btn-sm" onClick={() => setExcluirAberto(true)}><Ic d={D.lixo} /> Excluir</button>
            </div>
          )}
        </div>

        <aside className="ce-aside">
          <div className="ui-card ce-resumo">
            <div className="ce-resumo-top">
              <span className={`ui-badge ${st.badge}`}>{st.label}</span>
              {alterado ? <span className="ce-pend">Não salvo</span> : cotacaoId ? <span className="ce-salvo"><Ic d={D.check} /> Salvo</span> : null}
            </div>
            <div className="ce-resumo-l">Total da venda</div>
            <div className="ce-resumo-total">{brl(tot.venda)}</div>
            <div className="ce-resumo-sub">{num(tot.quantidade, tot.quantidade % 1 ? 2 : 0)} un. · {preenchidos} produto{preenchidos !== 1 ? 's' : ''}</div>

            <div className="ce-linhas">
              <div><span>Financiamento</span><b>{brl(tot.financiamento)}</b></div>
              {admin && <>
                <div><span>Custo total</span><b>{brl(tot.custo)}</b></div>
                <div><span>Impostos</span><b>{brl(tot.imposto)}</b></div>
              </>}
              {cab.enviada_em && <div><span>Enviada em</span><b>{dataCurta(cab.enviada_em.slice(0, 10))}</b></div>}
            </div>

            {admin && (
              <div className="ce-res" style={{ background: tot.resultado < 0 ? '#fdeeec' : '#eaf7ef' }}>
                <div><span>Resultado</span><b style={{ color: corResultado }}>{brl(tot.resultado)}</b></div>
                <div className="ce-res-pct" style={{ color: corResultado }}>{pct(tot.pctResultado, 2)}{minMargem != null && ` · menor margem ${pct(minMargem, 1)}`}</div>
              </div>
            )}

            <button className="ui-btn ui-btn-primary ce-salvar" onClick={() => salvar()} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar cotação'} <kbd>{CTRL} S</kbd></button>
            <div className="ce-imprimir">
              <button className="ui-btn ui-btn-secondary" style={{ width: '100%' }} onClick={() => setImprimirAberto(a => !a)} disabled={salvando}><Ic d={D.impr} /> Gerar documento</button>
              {imprimirAberto && (
                <div className="ce-imprimir-menu" onMouseLeave={() => setImprimirAberto(false)}>
                  <button onClick={() => imprimir('orcamento')} disabled={!liberada}><span>Orçamento<small>{liberada ? 'Para enviar ao cliente' : 'Bloqueado até aprovação'}</small></span><kbd>{CTRL} P</kbd></button>
                  <button onClick={() => imprimir('pedido')} disabled={!liberada}><span>Pedido do cliente<small>Pedido de compra Verde Agro</small></span><kbd>{CTRL} ⇧ P</kbd></button>
                  {admin && <button onClick={() => imprimir('resultado')}><span>Resultado<small>Custos e resultado (interno)</small></span></button>}
                </div>
              )}
            </div>
          </div>

          {cotacaoId && cab.status !== 'perdida' && (
            <div className="ui-card ce-cond">
              <div className="ce-cond-tit">Enviar ao cliente</div>
              <div className="ce-envio">
                <button className="ui-btn ui-btn-success ui-btn-sm" onClick={() => enviarCliente('whatsapp')} disabled={!liberada || salvando}><Ic d={D.zap} /> WhatsApp</button>
                <button className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => enviarCliente('email')} disabled={!liberada || salvando}><Ic d={D.mail} /> E-mail</button>
                <button className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => enviarCliente('link')} disabled={!liberada || salvando}><Ic d={D.link} /> {copiado ? 'Copiado!' : 'Copiar link'}</button>
              </div>
              <div className="ce-cond-dica">{cab.status === 'rascunho' ? 'Ao enviar, a cotação passa para "Enviada" e o cliente recebe um link do orçamento (sem custos).' : 'O cliente abre o orçamento pelo link, sem precisar de login.'}</div>
            </div>
          )}

          <div className="ui-card ce-cond">
            <div className="ce-cond-tit">Condições</div>
            <div className="ce-ptax">
              <div className="ui-segmented">
                <button className={cab.ptax_modo === 'manual' ? 'ativo' : ''} onClick={() => mudarCab('ptax_modo', 'manual')}>PTAX manual</button>
                <button className={cab.ptax_modo === 'auto' ? 'ativo' : ''} onClick={buscarPtax}>Automática (BC)</button>
              </div>
              {cab.ptax_modo === 'auto' && (
                <div className="ce-ptax-info">
                  {ptaxStatus === 'buscando' ? 'Consultando o Banco Central...' : ptaxStatus === 'erro' ? <span style={{ color: '#c0392b' }}>Não foi possível consultar. Digite manualmente.</span> : <>Venda de {dataCurta(cab.ptax_data)} · <button className="ce-link" style={{ margin: 0 }} onClick={buscarPtax}><Ic d={D.atualizar} size={11} /> atualizar</button></>}
                </div>
              )}
              <div className="ce-ptax-obs">
                {cab.ptax_modo === 'auto'
                  ? <>A <b>PTAX automática</b> busca no Banco Central a cotação oficial do dólar (valor de venda) do último dia útil e usa esse valor para converter o preço de tabela em reais. Ela é consultada quando você escolhe esta opção ou clica em atualizar; depois disso fica gravada na cotação e não muda sozinha. Digitar um valor volta para o modo manual.</>
                  : <>Na <b>PTAX manual</b> você digita o valor do dólar. Use 1 quando o preço de tabela já está em reais. A opção automática busca a cotação oficial do Banco Central.</>}
              </div>
            </div>
            <div className="ce-cond-grid">
              <label>PTAX<NumInput className="ui-input" valor={param.ptax} onChange={v => { mudarParam('ptax', v); if (cab.ptax_modo === 'auto') mudarCab('ptax_modo', 'manual') }} casas={4} /></label>
              <label>Juros a.m. %<NumInput className="ui-input" pct valor={param.juros_mes} onChange={v => mudarParam('juros_mes', v)} /></label>
              {admin && <>
                <label>ICMS %<NumInput className="ui-input" pct valor={param.aliquota_icms} onChange={v => mudarParam('aliquota_icms', v)} /></label>
                <label>IR/CSLL %<NumInput className="ui-input" pct valor={param.aliquota_ir} onChange={v => mudarParam('aliquota_ir', v)} /></label>
              </>}
              <label style={{ gridColumn: '1/-1' }}>Validade do orçamento<input type="date" className="ui-input" value={cab.validade} onChange={e => mudarCab('validade', e.target.value)} /></label>
            </div>
            <div className="ce-cond-dica">PTAX 1 = preços já em reais · juros diário {pct(param.juros_mes / 30, 4)}</div>
          </div>

          <div className="ce-atalhos">
            <div><kbd>{CTRL} S</kbd> salvar</div>
            <div><kbd>Alt N</kbd> novo produto</div>
            <div><kbd>Enter</kbd> próximo campo</div>
            <div><kbd>{CTRL} P</kbd> orçamento</div>
          </div>
        </aside>
      </div>
      )}

      <div className="ce-barra-m">
        <div><small>Total</small><b>{brl(tot.venda)}</b></div>
        <button className="ui-btn ui-btn-secondary" onClick={() => imprimir('orcamento')} disabled={salvando || !liberada} aria-label="Gerar orçamento"><Ic d={D.impr} /></button>
        <button className="ui-btn ui-btn-primary" onClick={() => salvar()} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
      </div>

      {perdaAberta && (
        <div className="ui-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setPerdaAberta(false) }}>
          <div className="ui-modal" style={{ maxWidth: 480 }}>
            <div className="ui-title" style={{ fontSize: '1.1rem', marginBottom: '.3rem' }}>Por que a cotação foi perdida?</div>
            <div className="ui-sub" style={{ marginBottom: '1rem' }}>O motivo aparece no relatório de vendas e ajuda a entender onde estamos perdendo negócio.</div>
            <div className="ce-motivos">
              {MOTIVOS_PERDA.map(m => <button key={m} type="button" className={`ce-motivo ${perdaMotivo === m ? 'on' : ''}`} onClick={() => setPerdaMotivo(m)}>{m}</button>)}
            </div>
            <label className="ui-label" style={{ marginTop: '1rem' }}>Detalhe {perdaMotivo === 'Outro' && <span className="ui-req">*</span>}</label>
            <input className="ui-input" value={perdaDetalhe} onChange={e => setPerdaDetalhe(e.target.value)} placeholder="Ex.: concorrente fez R$ 2.800/t à vista" />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.6rem', marginTop: '1.2rem' }}>
              <button className="ui-btn ui-btn-ghost" onClick={() => setPerdaAberta(false)}>Cancelar</button>
              <button className="ui-btn ui-btn-danger" onClick={confirmarPerda} disabled={!perdaMotivo || (perdaMotivo === 'Outro' && !perdaDetalhe.trim())}>Marcar como perdida</button>
            </div>
          </div>
        </div>
      )}

      {reprovarAberto && (
        <div className="ui-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setReprovarAberto(false) }}>
          <div className="ui-modal" style={{ maxWidth: 460 }}>
            <div className="ui-title" style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Reprovar preço</div>
            <label className="ui-label">Orientação para o consultor</label>
            <textarea className="ui-textarea" style={{ minHeight: 80 }} value={obsAprovacao} onChange={e => setObsAprovacao(e.target.value)} placeholder="Ex.: preço mínimo R$ 2.950/t; ofereça prazo menor." autoFocus />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.6rem', marginTop: '1.2rem' }}>
              <button className="ui-btn ui-btn-ghost" onClick={() => setReprovarAberto(false)}>Cancelar</button>
              <button className="ui-btn ui-btn-danger" onClick={() => decidirAprovacao(false)}>Reprovar</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog aberto={excluirAberto} titulo="Excluir esta cotação?" confirmarTexto="Excluir" perigo onConfirmar={excluir} onCancelar={() => setExcluirAberto(false)}>
        A cotação {cab.numero} e todos os seus produtos serão apagados. Essa ação não pode ser desfeita.
      </ConfirmDialog>
    </>
  )
}

function linhasParaBanco(itens: ItemCotacao[]) {
  return itens.map((it, ordem) => ({
    ordem, produto_id: it.produto_id, produto_nome: it.produto_nome.trim(), fornecedor: it.fornecedor,
    quantidade: it.quantidade, unidade: it.unidade, preco_tabela: it.preco_tabela, desconto: it.desconto, frete: it.frete,
    data_inicial: it.data_inicial || null, data_final: it.data_final || null, margem: it.margem, comissao: it.comissao,
    preco_cliente: it.preco_cliente, vencimento: it.vencimento || it.data_final || null,
  }))
}

type ItemCardProps = {
  it: Linha
  idx: number
  c: CalculoItem
  admin: boolean
  produtos: ProdutoCadastro[]
  aberto: boolean
  minimo: number | null
  abaixo: boolean
  historico: Historico
  onAlternar: () => void
  onMudar: (campos: Partial<ItemCotacao>) => void
  onEscolher: (p: ProdutoCadastro) => void
  onPrazo: (dias: number) => void
  onDuplicar: () => void
  onRemover: () => void
}

function ItemCard({ it, idx, c, admin, produtos, aberto, minimo, abaixo, historico, onAlternar, onMudar, onEscolher, onPrazo, onDuplicar, onRemover }: ItemCardProps) {
  const nav = { 'data-nav': it._k }
  const semPreco = !it.preco_cliente
  const abaixoSugerido = !semPreco && c.diferenca < -0.005
  const faltaQtd = !!it.produto_nome.trim() && !(it.quantidade > 0)
  const focarQtd = () => document.querySelector<HTMLInputElement>(`[data-qtd="${it._k}"]`)?.focus()

  return (
    <div className={`ui-card ce-item ${aberto ? '' : 'fechado'} ${abaixo ? 'abaixo-min' : ''}`}>
      <div className="ce-item-head">
        <span className="ce-item-n">{idx + 1}</span>
        <ProdutoPicker produtos={produtos} nome={it.produto_nome} produtoId={it.produto_id} onEscolher={onEscolher}
          onLivre={nome => onMudar({ produto_nome: nome, produto_id: null })} onConcluir={() => setTimeout(focarQtd, 0)}
          inputProps={{ 'data-picker': it._k, 'data-nav': it._k }} />
        <div className="ce-item-acoes">
          <button className="ce-ico" onClick={onDuplicar} title="Duplicar produto"><Ic d={D.copiar} /></button>
          <button className="ce-ico perigo" onClick={onRemover} title="Remover produto"><Ic d={D.lixo} /></button>
          <button className="ce-ico" onClick={onAlternar} title={aberto ? 'Recolher' : 'Expandir'}><IconChevron aberto={aberto} /></button>
        </div>
      </div>

      {!aberto ? (
        <button className="ce-item-resumo" onClick={onAlternar}>
          <span>{it.fornecedor || 'Sem fornecedor'}</span>
          <span>{num(it.quantidade, it.quantidade % 1 ? 2 : 0)} {it.unidade} × {brl(it.preco_cliente)}</span>
          <span>venc. {dataCurta(it.vencimento || it.data_final)}</span>
          {abaixo && <span className="ui-badge ui-badge-cancelada">abaixo do mínimo</span>}
          {faltaQtd && <span className="ui-badge ui-badge-cancelada">sem quantidade</span>}
          <b>{brl(c.total)}</b>
        </button>
      ) : (
        <>
          {it.produto_nome ? (
            <div className="ce-forn"><input value={it.fornecedor ?? ''} onChange={e => onMudar({ fornecedor: e.target.value })} placeholder="Fornecedor" aria-label="Fornecedor" /></div>
          ) : null}

          <div className="ce-blocos">
            <div className="ce-bloco">
              <div className="ce-bloco-tit">Custo <small>por {(it.unidade || 'un.').toLowerCase()}</small></div>
              <div className="ce-f3">
                <label>Tabela<NumInput className="ui-input" valor={it.preco_tabela} onChange={v => onMudar({ preco_tabela: v })} inputProps={nav} /></label>
                <label>Desconto<NumInput className="ui-input" valor={it.desconto} onChange={v => onMudar({ desconto: v })} inputProps={nav} /></label>
                <label>Frete<NumInput className="ui-input" valor={it.frete} onChange={v => onMudar({ frete: v })} inputProps={nav} /></label>
              </div>
              <div className="ce-calc"><span>Preço líquido</span><b>{brl(c.precoLiquido)}</b></div>
            </div>

            <div className="ce-bloco">
              <div className="ce-bloco-tit">Prazo</div>
              <div className="ce-f2">
                <label>Início<input type="date" className="ui-input" value={it.data_inicial ?? ''} onChange={e => onMudar({ data_inicial: e.target.value || null })} {...nav} /></label>
                <label>Fim<input type="date" className="ui-input" value={it.data_final ?? ''} onChange={e => onMudar({ data_final: e.target.value || null, ...(!it.vencimento || it.vencimento === it.data_final ? { vencimento: e.target.value || null } : {}) })} {...nav} /></label>
              </div>
              <div className="ce-chips">{PRAZOS.map(d => <button key={d} type="button" className={c.prazoDias === d ? 'ativo' : ''} onClick={() => onPrazo(d)}>{d}d</button>)}</div>
              <div className="ce-calc"><span>{c.prazoDias} dias · financ.</span><b>{brl(c.financiamento)}</b></div>
            </div>

            <div className="ce-bloco">
              <div className="ce-bloco-tit">Margem</div>
              <div className="ce-f2">
                <label>Margem %<NumInput className="ui-input" pct valor={it.margem} onChange={v => onMudar({ margem: v })} inputProps={nav} /></label>
                <label>Comissão %<NumInput className="ui-input" pct valor={it.comissao} onChange={v => onMudar({ comissao: v })} inputProps={nav} /></label>
              </div>
              <div className="ce-calc"><span>Base de custo</span><b>{brl(c.baseCusto)}</b></div>
            </div>
          </div>

          <div className="ce-preco">
            <div className="ce-sug">
              <span>Preço sugerido</span>
              <b>{brl(c.precoSugerido)}</b>
              <button type="button" onClick={() => onMudar({ preco_cliente: Math.round(c.precoSugerido * 100) / 100 })}><Ic d={D.varinha} size={12} /> Usar</button>
            </div>
            <label className={`ce-qtd-campo ${faltaQtd ? 'falta' : ''}`}>
              Quantidade
              <div className="ce-qtd">
                <NumInput className="ui-input" valor={it.quantidade} onChange={v => onMudar({ quantidade: v })} casas={it.quantidade % 1 ? 2 : 0} placeholder="0" ariaLabel="Quantidade" inputProps={{ ...nav, 'data-qtd': it._k }} />
                <input className="ce-und" value={it.unidade ?? ''} onChange={e => onMudar({ unidade: e.target.value.toUpperCase() })} aria-label="Unidade" placeholder="UN" />
              </div>
              {faltaQtd && <small className="ce-qtd-aviso">Informe a quantidade</small>}
            </label>
            <label className="ce-pc">
              Preço ao cliente
              <NumInput className={`ui-input ${abaixo || abaixoSugerido ? 'abaixo' : ''}`} valor={it.preco_cliente} onChange={v => onMudar({ preco_cliente: v })} placeholder={num(c.precoSugerido)} inputProps={nav} />
            </label>
            <label className="ce-venc">
              Vencimento
              <input type="date" className="ui-input" value={it.vencimento ?? it.data_final ?? ''} onChange={e => onMudar({ vencimento: e.target.value || null })} {...nav} />
            </label>
            <div className="ce-total"><span>Total</span><b>{brl(c.total)}</b></div>
          </div>

          {(historico.cliente || historico.media || minimo != null) && it.produto_nome && (
            <div className="ce-hist">
              {minimo != null && <span className={abaixo ? 'neg' : ''}>Preço mínimo sem aprovação: <b>{brl(minimo)}</b></span>}
              {historico.cliente && <span>Último p/ este cliente: <b>{brl(historico.cliente.preco)}</b> em {dataCurta(historico.cliente.data.slice(0, 10))} (Nº {historico.cliente.numero})</span>}
              {historico.media && <span>Média aprovada (6 meses): <b>{brl(historico.media.media)}</b> · {historico.media.n} venda{historico.media.n !== 1 ? 's' : ''}</span>}
            </div>
          )}

          {(admin || abaixoSugerido) && !semPreco && (
            <div className="ce-indic">
              {abaixoSugerido && <span className="ce-tag alerta">{brl(Math.abs(c.diferenca))} abaixo do sugerido</span>}
              {!abaixoSugerido && c.diferenca > 0.005 && <span className="ce-tag ok">{brl(c.diferenca)} acima do sugerido</span>}
              {admin && <>
                <span className="ce-tag">Margem bruta <b>{pct(c.margemBruta, 2)}</b></span>
                <span className={`ce-tag ${c.margemLiquida < 0 ? 'alerta' : 'ok'}`}>Margem líquida <b>{pct(c.margemLiquida, 2)}</b></span>
                <span className="ce-tag">Impostos <b>{brl(c.impostoTotal)}</b></span>
                <span className={`ce-tag ${c.resultadoLiquido < 0 ? 'alerta' : 'ok'}`}>Resultado <b>{brl(c.resultadoLiquido)}</b></span>
              </>}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const EDITOR_CSS = `
  ${DOC_CSS}
  .ce-abas{display:flex;align-items:stretch;gap:.4rem;flex-wrap:wrap;margin:0 0 1.1rem;border-bottom:1px solid #eae5de;padding-bottom:.6rem}
  .ce-aba{display:flex;flex-direction:column;align-items:flex-start;gap:.05rem;border:1.5px solid #eae5de;background:#fff;border-radius:10px;padding:.5rem .95rem;font-family:inherit;cursor:pointer;text-align:left;min-width:120px}
  .ce-aba:hover{border-color:#cfc8bd}
  .ce-aba.ativo{background:#162a1e;border-color:#162a1e}
  .ce-aba-t{font-size:.82rem;font-weight:600;color:#162a1e}
  .ce-aba-d{font-size:.64rem;color:#8f978f}
  .ce-aba.ativo .ce-aba-t{color:#fff}.ce-aba.ativo .ce-aba-d{color:rgba(255,255,255,.65)}
  .ce-abas-dica{align-self:center;margin-left:auto;font-size:.68rem;color:#8f978f;max-width:340px;line-height:1.5}
  .ce-doc{display:flex;flex-direction:column;gap:1rem}
  .ce-doc-barra{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;max-width:210mm;width:100%;margin:0 auto}
  .ce-doc-info{font-size:.76rem;color:#5b6660;flex:1;min-width:240px}
  .ce-doc-info b{color:#c0651a;font-weight:600}
  .ce-doc-acoes{display:flex;gap:.4rem;flex-wrap:wrap}
  @media(max-width:700px){.ce-abas-dica{display:none}.ce-aba{min-width:0;flex:1}}
  .ce-layout{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:1.3rem;align-items:start}
  .ce-aside{position:sticky;top:76px;display:flex;flex-direction:column;gap:1rem}
  .ce-faixa{display:flex;align-items:center;gap:.8rem;padding:.8rem 1rem;border-radius:12px;margin-bottom:.9rem;font-size:.78rem;line-height:1.5;flex-wrap:wrap}
  .ce-faixa b{font-weight:600}
  .ce-faixa.alerta{background:#fdf3e9;border:1px solid #f5d9bd;color:#8a4a0e}
  .ce-faixa.erro{background:#fdeeec;border:1px solid #f6d3cf;color:#a93226}
  .ce-faixa.info{background:#eef1ef;border:1px solid #dfe5e1;color:#162a1e}
  .ce-faixa.ok{background:#eaf7ef;border:1px solid #bfe6cf;color:#1e7a45}
  .ce-sec{margin-bottom:1.2rem}
  .ce-sec-head{display:flex;align-items:center;gap:.6rem;padding:1rem 1.3rem;border-bottom:1px solid #f2efea}
  .ce-sec-body{padding:1.1rem 1.3rem}
  .ce-step{width:22px;height:22px;border-radius:50%;background:#162a1e;color:#fff;font-size:.66rem;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .ce-sec-tit{font-size:.9rem;font-weight:600;color:#162a1e}
  .ce-cli{display:flex;gap:.9rem;align-items:center;padding:1.1rem 1.3rem}
  .ce-cli-av{width:44px;height:44px;border-radius:12px;background:#fdf3e9;color:#E67E22;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .ce-cli-nome{font-size:.98rem;font-weight:600;color:#162a1e}
  .ce-cli-sub{font-size:.74rem;color:#E67E22;font-weight:600;margin-top:.15rem}
  .ce-cli-meta{display:flex;flex-wrap:wrap;gap:.3rem .9rem;font-size:.7rem;color:#8f978f;margin-top:.35rem}
  .ce-ou{display:flex;align-items:center;gap:.7rem;margin:1rem 0 .8rem;font-size:.66rem;font-weight:600;color:#b8bdb6;text-transform:uppercase;letter-spacing:.08em}
  .ce-ou::before,.ce-ou::after{content:'';flex:1;height:1px;background:#f2efea}
  .ce-campos{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0 .9rem}
  .ce-campos .ui-field{margin-bottom:.8rem}
  .ce-span2{grid-column:span 2}
  .ce-prod-head{display:flex;align-items:center;gap:.6rem;margin:0 0 .7rem}
  .ce-count{font-size:.66rem;font-weight:600;background:#eae5de;color:#5b6660;border-radius:999px;padding:.12rem .5rem}
  .ce-link{margin-left:auto;border:none;background:none;font-family:inherit;font-size:.72rem;font-weight:600;color:#8f978f;cursor:pointer;display:inline-flex;align-items:center;gap:.25rem}
  .ce-link:hover{color:#E67E22}
  .ce-item{margin-bottom:.8rem;transition:box-shadow .2s}
  .ce-item.abaixo-min{box-shadow:0 0 0 1.5px #f0b4ab}
  .ce-item:focus-within{box-shadow:0 0 0 2px rgba(230,126,34,.25),0 8px 24px rgba(22,42,30,.07)}
  .ce-item-head{display:flex;align-items:center;gap:.6rem;padding:.7rem .8rem .7rem 1rem}
  .ce-item-n{width:26px;height:26px;border-radius:8px;background:#fdf3e9;color:#E67E22;font-size:.72rem;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .ce-qtd{display:flex;align-items:stretch;border:1.5px solid #f5d9bd;border-radius:9px;overflow:hidden;background:#fff;min-width:0}
  .ce-qtd:focus-within{border-color:#E67E22;box-shadow:0 0 0 3px rgba(230,126,34,.12)}
  .ce-qtd .ui-input{border:none;flex:1;min-width:0;width:auto;text-align:right;padding:.55rem .6rem;font-size:.95rem;font-weight:600;box-shadow:none !important}
  .ce-qtd-campo.falta{color:#c0392b}
  .ce-qtd-campo.falta .ce-qtd{border-color:#e8907f;background:#fff7f5}
  .ce-qtd-campo.falta .ce-qtd .ui-input{background:#fff7f5}
  .ce-qtd-aviso{font-size:.62rem;font-weight:600;color:#c0392b}
  .ce-und{width:46px;flex-shrink:0;border:none;border-left:1px solid #f2efea;background:#faf8f5;padding:.5rem .4rem;font-family:inherit;font-size:.7rem;font-weight:600;color:#5b6660;text-align:center;outline:none;align-self:stretch}
  .ce-item-acoes{display:flex;gap:.15rem}
  .ce-ico{width:32px;height:32px;border:none;background:none;border-radius:8px;color:#8f978f;cursor:pointer;display:flex;align-items:center;justify-content:center}
  .ce-ico:hover{background:#f7f5f1;color:#162a1e}
  .ce-ico.perigo:hover{background:#fdeeec;color:#c0392b}
  .ce-item-resumo{display:flex;align-items:center;gap:1.1rem;width:100%;border:none;border-top:1px solid #f2efea;background:#fcfbf9;padding:.6rem 1rem .6rem calc(1rem + 26px + .6rem);font-family:inherit;font-size:.72rem;color:#8f978f;cursor:pointer;text-align:left;border-radius:0 0 16px 16px}
  .ce-item-resumo b{margin-left:auto;font-size:.86rem;color:#162a1e}
  .ce-forn{padding:0 1rem .4rem calc(1rem + 26px + .6rem);margin-top:-.45rem}
  .ce-forn input{border:none;background:none;font-family:inherit;font-size:.72rem;font-weight:600;color:#E67E22;outline:none;padding:.15rem .65rem;border-radius:6px;width:100%}
  .ce-forn input:focus{background:#fdf3e9}
  .ce-blocos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.7rem;padding:.3rem 1rem .9rem}
  .ce-bloco{background:#faf8f5;border:1px solid #f2efea;border-radius:12px;padding:.75rem .8rem;display:flex;flex-direction:column;gap:.55rem;min-width:0}
  .ce-bloco-tit{font-size:.6rem;font-weight:600;color:#8f978f;text-transform:uppercase;letter-spacing:.08em}
  .ce-bloco-tit small{text-transform:none;letter-spacing:0;font-weight:400;margin-left:.2rem}
  .ce-bloco label,.ce-preco label,.ce-cond-grid label{display:flex;flex-direction:column;gap:.25rem;font-size:.64rem;font-weight:600;color:#5b6660;min-width:0}
  .ce-bloco .ui-input{padding:.45rem .55rem;font-size:.8rem;text-align:right;background:#fff}
  .ce-bloco input[type=date]{text-align:left;padding:.42rem .45rem;font-size:.74rem}
  .ce-f3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.4rem}
  .ce-f2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.4rem}
  .ce-calc{display:flex;justify-content:space-between;align-items:baseline;gap:.5rem;font-size:.66rem;color:#8f978f;border-top:1px dashed #e6e0d6;padding-top:.5rem;margin-top:auto}
  .ce-calc b{font-size:.8rem;color:#162a1e}
  .ce-chips{display:flex;flex-wrap:wrap;gap:.25rem}
  .ce-chips button{border:1px solid #eae5de;background:#fff;border-radius:999px;padding:.18rem .48rem;font-family:inherit;font-size:.62rem;font-weight:600;color:#5b6660;cursor:pointer}
  .ce-chips button:hover{border-color:#E67E22;color:#E67E22}
  .ce-chips button.ativo{background:#162a1e;border-color:#162a1e;color:#fff}
  .ce-preco{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr) minmax(0,1fr) minmax(0,.9fr) minmax(0,1fr);gap:.75rem;align-items:start;padding:.85rem 1rem;border-top:1px solid #f2efea}
  .ce-sug{display:flex;flex-direction:column;gap:.15rem;font-size:.64rem;font-weight:600;color:#8f978f}
  .ce-sug b{font-size:1rem;color:#c0651a}
  .ce-sug button{align-self:flex-start;display:inline-flex;align-items:center;gap:.3rem;border:none;background:#fdf3e9;color:#c0651a;border-radius:7px;padding:.28rem .6rem;font-family:inherit;font-size:.66rem;font-weight:600;cursor:pointer;margin-top:.15rem}
  .ce-pc .ui-input{font-size:.95rem;font-weight:600;text-align:right;border-color:#f5d9bd}
  .ce-pc .ui-input.abaixo{border-color:#f0b4ab;background:#fffafa}
  .ce-venc .ui-input{padding:.6rem .5rem;font-size:.78rem}
  .ce-total{text-align:right;display:flex;flex-direction:column;gap:.15rem;align-self:end}
  .ce-total span{font-size:.64rem;font-weight:600;color:#8f978f}
  .ce-total b{font-size:1.15rem;color:#162a1e;white-space:nowrap}
  .ce-hist{display:flex;flex-wrap:wrap;gap:.3rem 1.2rem;padding:0 1rem .75rem;font-size:.68rem;color:#8f978f}
  .ce-hist b{color:#162a1e;font-weight:600}
  .ce-hist .neg,.ce-hist .neg b{color:#c0392b}
  .ce-indic{display:flex;flex-wrap:wrap;gap:.35rem;padding:0 1rem .85rem}
  .ce-tag{font-size:.66rem;color:#5b6660;background:#f7f5f1;border-radius:999px;padding:.25rem .6rem}
  .ce-tag b{color:#162a1e}
  .ce-tag.ok{background:#eaf7ef;color:#1e8a4c}.ce-tag.ok b{color:#1e8a4c}
  .ce-tag.alerta{background:#fdeeec;color:#c0392b}.ce-tag.alerta b{color:#c0392b}
  .ce-add{width:100%;display:flex;align-items:center;justify-content:center;gap:.5rem;border:1.5px dashed #d9d2c7;background:transparent;border-radius:14px;padding:.9rem;font-family:inherit;font-size:.82rem;font-weight:600;color:#5b6660;cursor:pointer}
  .ce-add:hover,.ce-add:focus-visible{border-color:#E67E22;color:#E67E22;background:#fffaf4;outline:none}
  kbd{font-family:inherit;font-size:.6rem;font-weight:600;border:1px solid currentColor;opacity:.55;border-radius:5px;padding:.08rem .35rem;margin-left:.2rem}
  .ce-aviso{font-size:.72rem;color:#8f978f;margin-top:.6rem;text-align:center}
  .ce-aviso a{color:#E67E22;font-weight:600}
  .ce-detalhe{margin-top:1.2rem;overflow:hidden}
  .ce-detalhe summary{cursor:pointer;padding:1rem 1.3rem;font-size:.86rem;font-weight:600;color:#162a1e;list-style:none;display:flex;align-items:baseline;gap:.7rem;flex-wrap:wrap}
  .ce-detalhe summary::before{content:'›';color:#E67E22;font-size:1.1rem;transition:transform .2s;display:inline-block}
  .ce-detalhe[open] summary::before{transform:rotate(90deg)}
  .ce-detalhe summary span{font-size:.68rem;font-weight:400;color:#8f978f}
  .ce-tab{width:100%;border-collapse:collapse;font-size:.74rem}
  .ce-tab th{background:#faf8f5;font-size:.6rem;font-weight:600;color:#8f978f;text-transform:uppercase;letter-spacing:.06em;text-align:right;padding:.6rem .7rem;white-space:nowrap}
  .ce-tab td{padding:.55rem .7rem;border-top:1px solid #f2efea;text-align:right;white-space:nowrap;color:#5b6660}
  .ce-tab th:first-child,.ce-tab td:first-child{text-align:left;color:#162a1e;font-weight:600}
  .ce-tab tfoot td{background:#faf8f5;font-weight:600;color:#162a1e}
  .ce-status{display:inline-flex;background:#f7f5f1;border:1px solid #eae5de;border-radius:10px;padding:3px;gap:2px}
  .ce-status-btn{border:none;background:none;font-family:inherit;font-size:.72rem;font-weight:600;color:#8f978f;border-radius:7px;padding:.42rem .75rem;cursor:pointer}
  .ce-status-btn:hover:not(:disabled){color:#162a1e}
  .ce-status-btn:disabled{opacity:.4;cursor:not-allowed}
  .ce-status-btn.ativo{background:#fff;color:#162a1e;box-shadow:0 1px 3px rgba(22,42,30,.12)}
  .ce-status-btn.ativo.enviada{color:#c0651a}.ce-status-btn.ativo.aprovada{color:#1e8a4c}.ce-status-btn.ativo.perdida{color:#c0392b}
  .ce-resumo{padding:1.2rem}
  .ce-resumo-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:.9rem}
  .ce-pend{font-size:.66rem;font-weight:600;color:#c0651a}
  .ce-salvo{font-size:.66rem;font-weight:600;color:#1e8a4c;display:inline-flex;align-items:center;gap:.25rem}
  .ce-resumo-l{font-size:.62rem;font-weight:600;color:#8f978f;text-transform:uppercase;letter-spacing:.08em}
  .ce-resumo-total{font-size:1.65rem;font-weight:600;color:#162a1e;letter-spacing:-.02em;margin-top:.2rem;white-space:nowrap}
  .ce-resumo-sub{font-size:.7rem;color:#8f978f;margin-top:.15rem}
  .ce-linhas{display:flex;flex-direction:column;gap:.45rem;margin:1rem 0;padding-top:.9rem;border-top:1px solid #f2efea}
  .ce-linhas div{display:flex;justify-content:space-between;font-size:.74rem;color:#8f978f}
  .ce-linhas b{color:#162a1e}
  .ce-res{border-radius:12px;padding:.75rem .85rem;margin-bottom:1rem}
  .ce-res div:first-child{display:flex;justify-content:space-between;align-items:baseline;font-size:.74rem;font-weight:600;color:#5b6660}
  .ce-res b{font-size:1rem}
  .ce-res-pct{font-size:.7rem;font-weight:600;text-align:right;margin-top:.1rem}
  .ce-salvar{width:100%;margin-bottom:.5rem;padding:.8rem}
  .ce-imprimir{position:relative}
  .ce-imprimir-menu{position:absolute;left:0;right:0;top:calc(100% + 6px);background:#fff;border:1px solid #eae5de;border-radius:12px;box-shadow:0 16px 40px rgba(22,42,30,.16);padding:.35rem;z-index:200}
  .ce-imprimir-menu button{display:flex;align-items:center;justify-content:space-between;width:100%;text-align:left;border:none;background:none;padding:.6rem .7rem;border-radius:8px;font-family:inherit;font-size:.78rem;font-weight:600;color:#162a1e;cursor:pointer}
  .ce-imprimir-menu button:hover:not(:disabled){background:#f7f5f1}
  .ce-imprimir-menu button:disabled{opacity:.45;cursor:not-allowed}
  .ce-imprimir-menu small{display:block;font-size:.64rem;color:#8f978f;font-weight:400;margin-top:.1rem}
  .ce-cond{padding:1rem 1.1rem}
  .ce-cond-tit{font-size:.62rem;font-weight:600;color:#8f978f;text-transform:uppercase;letter-spacing:.08em;margin-bottom:.7rem}
  .ce-cond-grid{display:grid;grid-template-columns:1fr 1fr;gap:.6rem}
  .ce-cond-grid .ui-input{padding:.45rem .6rem;font-size:.8rem;text-align:right}
  .ce-cond-grid input[type=date]{text-align:left}
  .ce-cond-dica{font-size:.64rem;color:#b8bdb6;margin-top:.6rem;line-height:1.5}
  .ce-ptax{margin-bottom:.7rem}
  .ce-ptax .ui-segmented{width:100%}
  .ce-ptax .ui-segmented button{flex:1;justify-content:center}
  .ce-ptax-info{font-size:.68rem;color:#8f978f;margin-top:.4rem;display:flex;align-items:center;gap:.3rem}
  .ce-ptax-obs{font-size:.66rem;line-height:1.55;color:#5b6660;background:#faf8f5;border:1px solid #f2efea;border-radius:9px;padding:.55rem .65rem;margin-top:.5rem}
  .ce-ptax-obs b{color:#162a1e;font-weight:600}
  .ce-envio{display:flex;flex-wrap:wrap;gap:.4rem}
  .ce-envio .ui-btn{flex:1}
  .ce-motivos{display:flex;flex-wrap:wrap;gap:.4rem}
  .ce-motivo{border:1.5px solid #eae5de;background:#fff;border-radius:999px;padding:.4rem .85rem;font-family:inherit;font-size:.76rem;font-weight:600;color:#5b6660;cursor:pointer}
  .ce-motivo.on{background:#c0392b;border-color:#c0392b;color:#fff}
  .ce-atalhos{display:grid;grid-template-columns:1fr 1fr;gap:.35rem .6rem;font-size:.64rem;color:#8f978f;padding:0 .3rem}
  .ce-atalhos kbd{margin:0 .25rem 0 0;opacity:.8}
  .ce-barra-m{display:none}
  @media(max-width:1100px){
    .ce-layout{grid-template-columns:1fr}
    .ce-aside{position:static}
    .ce-atalhos{display:none}
    .ce-barra-m{display:flex;align-items:center;gap:.5rem;position:sticky;bottom:.6rem;z-index:60;margin-top:1rem;padding:.65rem .8rem;background:#fff;border:1px solid #eae5de;border-radius:14px;box-shadow:0 -6px 24px rgba(22,42,30,.10)}
    .ce-barra-m div{flex:1;display:flex;flex-direction:column}
    .ce-barra-m small{font-size:.6rem;color:#8f978f;font-weight:600;text-transform:uppercase}
    .ce-barra-m b{font-size:1.05rem;color:#162a1e}
  }
  @media(max-width:760px){
    .ce-blocos{grid-template-columns:1fr}
    .ce-preco{grid-template-columns:1fr 1fr}
    .ce-campos{grid-template-columns:1fr 1fr}
    .ce-item-head{flex-wrap:wrap}
    .ce-item-head .pp-wrap{flex-basis:calc(100% - 26px - .6rem)}
    .ce-item-acoes{margin-left:auto}
    .ce-item-resumo{flex-wrap:wrap;gap:.3rem .8rem;padding-left:1rem}
    .ce-status-btn{padding:.4rem .5rem}
  }
`

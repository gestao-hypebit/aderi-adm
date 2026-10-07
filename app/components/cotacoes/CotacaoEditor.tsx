'use client'

import { hojeISO } from '@/lib/dateUtils'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Combobox from '@/app/admin/_ui/Combobox'
import ConfirmDialog from '@/app/admin/_ui/ConfirmDialog'
import NumInput from './NumInput'
import ProdutoPicker, { ProdutoCadastro } from './ProdutoPicker'
import {
  ItemCotacao, ParametrosCotacao, PARAMETROS_PADRAO, STATUS_COTACAO, CalculoItem,
  calcularTotais, itemVazio, itemDoBanco, parametrosDoBanco, brl, num, pct, dataCurta,
} from '@/lib/cotacao'

type ClienteOpcao = { id: string; nome: string; nome_fazenda: string | null; cidade: string | null; estado: string | null; cpf_cnpj: string | null; telefone: string | null }
type Linha = ItemCotacao & { _k: number }

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
}

const OBS_CLIENTE_PADRAO = 'PREÇO CIF - POSTO FAZENDA\nFÁBRICA EUROCHEM - HERINGER\nPRODUTO 100% GRANULADO SEM PÓ\nEMBALAGEM: BIG BAG 1000 QUILOS'

const CAB_VAZIO: Cabecalho = {
  numero: '', status: 'rascunho', cliente_id: '', cliente_nome: '', empresa_rural: '', cidade: '', cpf_cnpj: '',
  inscricao_produtor: '', contato: '', observacoes: '', observacoes_cliente: OBS_CLIENTE_PADRAO, transportador: '', obs_pedido: '',
}

const PRAZOS = [30, 60, 90, 120, 180, 270, 360]

let seq = 0
const novaChave = () => ++seq
const comChave = (i: ItemCotacao): Linha => ({ ...i, _k: novaChave() })
function somarDias(iso: string, d: number) {
  const dt = new Date(iso + 'T12:00')
  dt.setDate(dt.getDate() + d)
  return dt.toISOString().slice(0, 10)
}
const mac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)
const CTRL = mac ? '⌘' : 'Ctrl'

function IconArrowLeft() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
}
function IconPlus() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function IconTrash() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
}
function IconPrinter() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
}
function IconCopy() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
}
function IconAlert() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
}
function IconChevron({ aberto }: { aberto: boolean }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><polyline points="6 9 12 15 18 9"/></svg>
}
function IconUser() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
}
function IconCheck() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
}
function IconWand() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5"/></svg>
}

type Props = { cotacaoId?: string; base: string }

export default function CotacaoEditor({ cotacaoId, base }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [cab, setCab] = useState<Cabecalho>(CAB_VAZIO)
  const [param, setParam] = useState<ParametrosCotacao>(PARAMETROS_PADRAO)
  const [itens, setItens] = useState<Linha[]>([])
  const [produtos, setProdutos] = useState<ProdutoCadastro[]>([])
  const [clientes, setClientes] = useState<ClienteOpcao[]>([])
  const [admin, setAdmin] = useState(false)
  const [autor, setAutor] = useState('')
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

  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      const [{ data: perfil }, { data: prods }, { data: clis }] = await Promise.all([
        supabase.from('profiles').select('role').eq('id', user?.id ?? '').single(),
        supabase.from('produtos').select('id, nome, fornecedor, unidade, preco_tabela').eq('ativo', true).order('nome'),
        supabase.from('clientes').select('id, nome, nome_fazenda, cidade, estado, cpf_cnpj, telefone').order('nome'),
      ])
      setAdmin(perfil?.role === 'admin')
      setProdutos((prods ?? []).map(p => ({ ...p, preco_tabela: Number(p.preco_tabela) })))
      setClientes(clis ?? [])

      if (cotacaoId) {
        const [{ data: c }, { data: its }] = await Promise.all([
          supabase.from('cotacoes').select('*, autor:profiles(nome_completo)').eq('id', cotacaoId).single(),
          supabase.from('cotacao_itens').select('*').eq('cotacao_id', cotacaoId).order('ordem'),
        ])
        if (!c) { setErro('Cotação não encontrada ou sem permissão.'); setCarregando(false); return }
        const a = Array.isArray(c.autor) ? c.autor[0] : c.autor
        setAutor(a?.nome_completo ?? '')
        setCab({
          numero: c.numero, status: c.status, cliente_id: c.cliente_id ?? '', cliente_nome: c.cliente_nome ?? '',
          empresa_rural: c.empresa_rural ?? '', cidade: c.cidade ?? '', cpf_cnpj: c.cpf_cnpj ?? '',
          inscricao_produtor: c.inscricao_produtor ?? '', contato: c.contato ?? '', observacoes: c.observacoes ?? '',
          observacoes_cliente: c.observacoes_cliente ?? '', transportador: c.transportador ?? '', obs_pedido: c.obs_pedido ?? '',
        })
        setEditandoCliente(!c.cliente_nome)
        setParam(parametrosDoBanco(c))
        const linhas = (its?.length ? its.map(itemDoBanco) : [itemVazio()]).map(comChave)
        setItens(linhas)
        // cotações com vários produtos abrem recolhidas, exceto o primeiro
        if (linhas.length > 2) setFechados(new Set(linhas.slice(1).map(l => l._k)))
      } else {
        setItens([comChave({ ...itemVazio(), data_inicial: hojeISO() })])
      }
      setCarregando(false)
    }
    carregar()
  }, [cotacaoId])

  useEffect(() => {
    if (!alterado) return
    const aviso = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [alterado])

  // foca o campo de produto de uma linha recém-criada
  useEffect(() => {
    if (focar == null) return
    document.querySelector<HTMLInputElement>(`[data-picker="${focar}"]`)?.focus()
  }, [focar])

  const tot = useMemo(() => calcularTotais(itens, param), [itens, param])

  function marcar() { setAlterado(true); setOk('') }
  function mudarCab<K extends keyof Cabecalho>(k: K, v: Cabecalho[K]) { setCab(c => ({ ...c, [k]: v })); marcar() }
  function mudarParam<K extends keyof ParametrosCotacao>(k: K, v: number) { setParam(p => ({ ...p, [k]: v })); marcar() }
  function mudarItem(k: number, campos: Partial<ItemCotacao>) {
    setItens(lista => lista.map(it => (it._k === k ? { ...it, ...campos } : it)))
    marcar()
  }

  function escolherCliente(id: string) {
    const c = clientes.find(x => x.id === id)
    if (!c) return
    setCab(atual => ({
      ...atual,
      cliente_id: c.id,
      cliente_nome: c.nome,
      empresa_rural: c.nome_fazenda ?? '',
      cidade: [c.cidade, c.estado].filter(Boolean).join(' - '),
      cpf_cnpj: c.cpf_cnpj ?? '',
      contato: c.telefone ?? '',
    }))
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

  function adicionarItem(base?: Linha) {
    const ult = base ?? itens[itens.length - 1]
    const nova = base
      ? { ...base, id: undefined, _k: novaChave() }
      : comChave({ ...itemVazio(), data_inicial: ult?.data_inicial ?? hojeISO(), data_final: ult?.data_final ?? null, vencimento: ult?.vencimento ?? null, margem: ult?.margem ?? 0, comissao: ult?.comissao ?? 0, frete: ult?.frete ?? 0 })
    setItens(l => {
      if (!base) return [...l, nova]
      const idx = l.findIndex(x => x._k === base._k)
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

  async function salvar(): Promise<string | null> {
    setErro(''); setOk('')
    if (!cab.cliente_nome.trim()) { setErro('Informe o cliente da cotação.'); setEditandoCliente(true); return null }
    const validos = itens.filter(i => i.produto_nome.trim())
    if (validos.length === 0) { setErro('Adicione ao menos um produto.'); return null }
    setSalvando(true)

    const payload = {
      status: cab.status, cliente_id: cab.cliente_id || null, cliente_nome: cab.cliente_nome.trim(),
      empresa_rural: cab.empresa_rural || null, cidade: cab.cidade || null, cpf_cnpj: cab.cpf_cnpj || null,
      inscricao_produtor: cab.inscricao_produtor || null, contato: cab.contato || null,
      observacoes: cab.observacoes || null, observacoes_cliente: cab.observacoes_cliente || null,
      transportador: cab.transportador || null, obs_pedido: cab.obs_pedido || null,
      ...param, updated_at: new Date().toISOString(),
    }

    let id = cotacaoId
    if (id) {
      const { error } = await supabase.from('cotacoes').update(payload).eq('id', id)
      if (error) { setErro('Erro ao salvar a cotação.'); setSalvando(false); return null }
      const { error: errDel } = await supabase.from('cotacao_itens').delete().eq('cotacao_id', id)
      if (errDel) { setErro('Erro ao salvar os itens.'); setSalvando(false); return null }
    } else {
      const { data, error } = await supabase.from('cotacoes').insert(payload).select('id, numero').single()
      if (error || !data) { setErro('Erro ao criar a cotação.'); setSalvando(false); return null }
      id = data.id
    }

    const { error: errIt } = await supabase.from('cotacao_itens').insert(linhasParaBanco(validos, id!))
    if (errIt) { setErro('Cotação salva, mas houve erro nos itens. Tente salvar de novo.'); setSalvando(false); return id ?? null }

    setSalvando(false)
    setAlterado(false)
    if (!cotacaoId) { router.replace(`${base}/${id}`); return id ?? null }
    setOk('Cotação salva.')
    return id ?? null
  }

  async function imprimir(doc: string) {
    setImprimirAberto(false)
    const id = alterado || !cotacaoId ? await salvar() : cotacaoId
    if (id) window.open(`/imprimir/cotacao/${id}?doc=${doc}`, '_blank')
  }

  async function duplicar() {
    const { error, data } = await supabase.from('cotacoes').insert({
      status: 'rascunho', cliente_id: cab.cliente_id || null, cliente_nome: cab.cliente_nome, empresa_rural: cab.empresa_rural || null,
      cidade: cab.cidade || null, cpf_cnpj: cab.cpf_cnpj || null, inscricao_produtor: cab.inscricao_produtor || null, contato: cab.contato || null,
      observacoes: cab.observacoes || null, observacoes_cliente: cab.observacoes_cliente || null, transportador: cab.transportador || null,
      obs_pedido: cab.obs_pedido || null, ...param,
    }).select('id').single()
    if (error || !data) { setErro('Erro ao duplicar.'); return }
    await supabase.from('cotacao_itens').insert(linhasParaBanco(itens.filter(i => i.produto_nome.trim()), data.id))
    router.push(`${base}/${data.id}`)
  }

  async function excluir() {
    if (!cotacaoId) return
    const { error } = await supabase.from('cotacoes').delete().eq('id', cotacaoId)
    if (error) { setErro('Erro ao excluir.'); setExcluirAberto(false); return }
    router.push(base)
  }

  // Enter avança para o próximo campo do produto; no último, vai para o próximo produto
  function navegarEnter(e: React.KeyboardEvent<HTMLDivElement>) {
    const alvo = e.target as HTMLElement
    if (e.key !== 'Enter' || e.ctrlKey || e.metaKey || alvo.tagName !== 'INPUT') return
    e.preventDefault()
    const campos = [...document.querySelectorAll<HTMLInputElement>('[data-nav]')]
    const idx = campos.indexOf(alvo as HTMLInputElement)
    if (idx >= 0 && idx < campos.length - 1) campos[idx + 1].focus()
    else document.querySelector<HTMLButtonElement>('[data-add-produto]')?.focus()
  }

  // Atalhos de teclado
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
  const preenchidos = itens.filter(i => i.produto_nome.trim()).length
  const corResultado = tot.resultado < 0 ? '#c0392b' : '#1e8a4c'

  return (
    <>
      <style>{EDITOR_CSS}</style>

      <div className="ui-breadcrumb">
        <Link href={base}><IconArrowLeft /> Cotações</Link>
        <span className="ui-breadcrumb-sep">/</span>
        <span className="ui-breadcrumb-atual">{cotacaoId ? cab.numero : 'Nova cotação'}</span>
      </div>

      <div className="ui-page-header">
        <div>
          <div className="ui-title" style={{ display: 'flex', alignItems: 'center', gap: '.7rem', flexWrap: 'wrap' }}>
            {cotacaoId ? `Cotação ${cab.numero}` : 'Nova cotação'}
          </div>
          <div className="ui-sub">{autor ? `Criada por ${autor}` : 'Escolha o cliente e adicione os produtos. O preço sugerido é calculado na hora.'}</div>
        </div>
        <div className="ui-header-actions">
          <div className="ce-status" role="radiogroup" aria-label="Status">
            {Object.entries(STATUS_COTACAO).map(([k, v]) => (
              <button key={k} role="radio" aria-checked={cab.status === k} className={`ce-status-btn ${cab.status === k ? `ativo ${k}` : ''}`} onClick={() => mudarCab('status', k)}>{v.label}</button>
            ))}
          </div>
        </div>
      </div>

      {erro && <div className="ui-alert ui-alert-erro"><IconAlert /> {erro}</div>}
      {ok && <div className="ui-alert ui-alert-ok"><IconCheck /> {ok}</div>}

      <div className="ce-layout">
        <div className="ce-main">
          {/* ── Cliente ── */}
          <section className="ui-card ce-sec">
            <div className="ce-sec-head">
              <span className="ce-step">1</span>
              <span className="ce-sec-tit">Cliente</span>
              {!editandoCliente && <button className="ui-btn ui-btn-ghost ui-btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setEditandoCliente(true)}>Alterar</button>}
            </div>
            {!editandoCliente ? (
              <div className="ce-cli">
                <div className="ce-cli-av"><IconUser /></div>
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
                  <div className="ui-field ce-span2"><label className="ui-label">Contato</label><input className="ui-input" value={cab.contato} onChange={e => mudarCab('contato', e.target.value)} /></div>
                </div>
                {cab.cliente_nome.trim() && <button className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => setEditandoCliente(false)}><IconCheck /> Pronto</button>}
              </div>
            )}
          </section>

          {/* ── Produtos ── */}
          <div className="ce-prod-head">
            <span className="ce-step">2</span>
            <span className="ce-sec-tit">Produtos</span>
            <span className="ce-count">{preenchidos}</span>
            {itens.length > 1 && (
              <button className="ce-link" onClick={() => setFechados(fechados.size ? new Set() : new Set(itens.map(i => i._k)))}>
                {fechados.size ? 'Expandir todos' : 'Recolher todos'}
              </button>
            )}
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
                onAlternar={() => alternar(it._k)}
                onMudar={campos => mudarItem(it._k, campos)}
                onEscolher={p => escolherProduto(it._k, p)}
                onPrazo={d => definirPrazo(it, d)}
                onDuplicar={() => adicionarItem(it)}
                onRemover={() => removerItem(it._k)}
              />
            ))}
          </div>

          <button className="ce-add" data-add-produto onClick={() => adicionarItem()}>
            <IconPlus /> Adicionar produto <kbd>Alt N</kbd>
          </button>
          {produtos.length === 0 && (
            <div className="ce-aviso">
              {admin ? <>Nenhum produto cadastrado ainda. <Link href="/admin/produtos">Cadastrar produtos</Link> para escolher da lista.</> : 'Nenhum produto no cadastro: digite o nome do produto.'}
            </div>
          )}

          {/* ── Observações ── */}
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
              {abaObs === 'orcamento' && <><textarea className="ui-textarea" value={cab.observacoes_cliente} onChange={e => mudarCab('observacoes_cliente', e.target.value)} /><div className="ui-hint">Sai impressa no orçamento enviado ao cliente.</div></>}
              {abaObs === 'pedido' && (
                <div className="ce-campos" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="ui-field"><label className="ui-label">Transportador</label><input className="ui-input" value={cab.transportador} onChange={e => mudarCab('transportador', e.target.value)} /></div>
                  <div className="ui-field"><label className="ui-label">Observação do pedido</label><input className="ui-input" value={cab.obs_pedido} onChange={e => mudarCab('obs_pedido', e.target.value)} /></div>
                </div>
              )}
              {abaObs === 'interna' && <><textarea className="ui-textarea" value={cab.observacoes} onChange={e => mudarCab('observacoes', e.target.value)} placeholder="Anotações da negociação, não aparecem para o cliente" /><div className="ui-hint">Só aparece aqui e no documento de resultado.</div></>}
            </div>
          </section>

          {admin && preenchidos > 0 && (
            <details className="ui-card ce-detalhe">
              <summary>Detalhamento do resultado <span>Compra, frete, financiamento, comissão e impostos por produto</span></summary>
              <div style={{ overflowX: 'auto' }}>
                <table className="ce-tab">
                  <thead><tr><th>Produto</th><th>Quant.</th><th>Compra forn.</th><th>Frete</th><th>Financ.</th><th>Comissão</th><th>Impostos</th><th>Custo total</th><th>Venda</th><th>Resultado</th></tr></thead>
                  <tbody>
                    {itens.map((it, i) => {
                      if (!it.produto_nome) return null
                      const c = tot.calc[i]
                      return (
                        <tr key={it._k}>
                          <td>{it.produto_nome}</td><td>{num(it.quantidade)}</td><td>{brl(c.compraTotal)}</td><td>{brl(c.freteTotal)}</td><td>{brl(c.financTotal)}</td>
                          <td>{brl(c.comissaoTotal)}</td><td>{brl(c.impostoTotal)}</td><td>{brl(c.custoTotal)}</td><td>{brl(c.total)}</td>
                          <td style={{ color: c.resultadoLiquido < 0 ? '#c0392b' : '#1e8a4c', fontWeight: 600 }}>{brl(c.resultadoLiquido)} · {pct(c.pctResultado, 2)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Total</td><td>{num(tot.quantidade)}</td><td>{brl(tot.compra)}</td><td>{brl(tot.frete)}</td><td>{brl(tot.financiamento)}</td><td>{brl(tot.comissao)}</td>
                      <td>{brl(tot.imposto)}</td><td>{brl(tot.custo)}</td><td>{brl(tot.venda)}</td><td style={{ color: corResultado }}>{brl(tot.resultado)} · {pct(tot.pctResultado, 2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </details>
          )}

          {cotacaoId && (
            <div style={{ marginTop: '1.4rem', display: 'flex', gap: '.6rem' }}>
              <button className="ui-btn ui-btn-ghost ui-btn-sm" onClick={duplicar}><IconCopy /> Duplicar cotação</button>
              <button className="ui-btn ui-btn-danger ui-btn-sm" onClick={() => setExcluirAberto(true)}><IconTrash /> Excluir</button>
            </div>
          )}
        </div>

        {/* ── Resumo lateral ── */}
        <aside className="ce-aside">
          <div className="ui-card ce-resumo">
            <div className="ce-resumo-top">
              <span className={`ui-badge ${st.badge}`}>{st.label}</span>
              {alterado ? <span className="ce-pend">Não salvo</span> : cotacaoId ? <span className="ce-salvo"><IconCheck /> Salvo</span> : null}
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
            </div>

            {admin && (
              <div className="ce-res" style={{ background: tot.resultado < 0 ? '#fdeeec' : '#eaf7ef' }}>
                <div><span>Resultado</span><b style={{ color: corResultado }}>{brl(tot.resultado)}</b></div>
                <div className="ce-res-pct" style={{ color: corResultado }}>{pct(tot.pctResultado, 2)}</div>
              </div>
            )}

            <button className="ui-btn ui-btn-primary ce-salvar" onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar cotação'} <kbd>{CTRL} S</kbd>
            </button>
            <div className="ce-imprimir">
              <button className="ui-btn ui-btn-secondary" style={{ width: '100%' }} onClick={() => setImprimirAberto(a => !a)} disabled={salvando}><IconPrinter /> Gerar documento</button>
              {imprimirAberto && (
                <div className="ce-imprimir-menu" onMouseLeave={() => setImprimirAberto(false)}>
                  <button onClick={() => imprimir('orcamento')}><span>Orçamento<small>Para enviar ao cliente</small></span><kbd>{CTRL} P</kbd></button>
                  <button onClick={() => imprimir('pedido')}><span>Pedido do cliente<small>Pedido de compra Verde Agro</small></span><kbd>{CTRL} ⇧ P</kbd></button>
                  {admin && <button onClick={() => imprimir('resultado')}><span>Resultado<small>Custos e resultado (interno)</small></span></button>}
                </div>
              )}
            </div>
          </div>

          <div className="ui-card ce-cond">
            <div className="ce-cond-tit">Condições</div>
            <div className="ce-cond-grid">
              <label>PTAX<NumInput className="ui-input" valor={param.ptax} onChange={v => mudarParam('ptax', v)} casas={4} /></label>
              <label>Juros a.m. %<NumInput className="ui-input" pct valor={param.juros_mes} onChange={v => mudarParam('juros_mes', v)} /></label>
              {admin && <>
                <label>ICMS %<NumInput className="ui-input" pct valor={param.aliquota_icms} onChange={v => mudarParam('aliquota_icms', v)} /></label>
                <label>IR/CSLL %<NumInput className="ui-input" pct valor={param.aliquota_ir} onChange={v => mudarParam('aliquota_ir', v)} /></label>
              </>}
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

      {/* barra fixa no celular */}
      <div className="ce-barra-m">
        <div><small>Total</small><b>{brl(tot.venda)}</b></div>
        <button className="ui-btn ui-btn-secondary" onClick={() => imprimir('orcamento')} disabled={salvando} aria-label="Gerar orçamento"><IconPrinter /></button>
        <button className="ui-btn ui-btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
      </div>

      <ConfirmDialog aberto={excluirAberto} titulo="Excluir esta cotação?" confirmarTexto="Excluir" perigo onConfirmar={excluir} onCancelar={() => setExcluirAberto(false)}>
        A cotação {cab.numero} e todos os seus produtos serão apagados. Essa ação não pode ser desfeita.
      </ConfirmDialog>
    </>
  )
}

function linhasParaBanco(itens: ItemCotacao[], cotacaoId: string) {
  return itens.map((it, ordem) => ({
    cotacao_id: cotacaoId, ordem, produto_id: it.produto_id, produto_nome: it.produto_nome.trim(), fornecedor: it.fornecedor,
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
  onAlternar: () => void
  onMudar: (campos: Partial<ItemCotacao>) => void
  onEscolher: (p: ProdutoCadastro) => void
  onPrazo: (dias: number) => void
  onDuplicar: () => void
  onRemover: () => void
}

function ItemCard({ it, idx, c, admin, produtos, aberto, onAlternar, onMudar, onEscolher, onPrazo, onDuplicar, onRemover }: ItemCardProps) {
  const nav = { 'data-nav': it._k }
  const semPreco = !it.preco_cliente
  const abaixo = !semPreco && c.diferenca < -0.005
  const focarQtd = () => document.querySelector<HTMLInputElement>(`[data-qtd="${it._k}"]`)?.focus()

  return (
    <div className={`ui-card ce-item ${aberto ? '' : 'fechado'}`}>
      <div className="ce-item-head">
        <span className="ce-item-n">{idx + 1}</span>
        <ProdutoPicker
          produtos={produtos}
          nome={it.produto_nome}
          produtoId={it.produto_id}
          onEscolher={onEscolher}
          onLivre={nome => onMudar({ produto_nome: nome, produto_id: null })}
          onConcluir={() => setTimeout(focarQtd, 0)}
          inputProps={{ 'data-picker': it._k, 'data-nav': it._k }}
        />
        <div className="ce-qtd">
          <NumInput className="ui-input" valor={it.quantidade} onChange={v => onMudar({ quantidade: v })} casas={2} placeholder="Qtd." ariaLabel="Quantidade" inputProps={{ ...nav, 'data-qtd': it._k }} />
          <input className="ce-und" value={it.unidade ?? ''} onChange={e => onMudar({ unidade: e.target.value.toUpperCase() })} aria-label="Unidade" />
        </div>
        <div className="ce-item-acoes">
          <button className="ce-ico" onClick={onDuplicar} title="Duplicar produto"><IconCopy /></button>
          <button className="ce-ico perigo" onClick={onRemover} title="Remover produto"><IconTrash /></button>
          <button className="ce-ico" onClick={onAlternar} title={aberto ? 'Recolher' : 'Expandir'}><IconChevron aberto={aberto} /></button>
        </div>
      </div>

      {!aberto ? (
        <button className="ce-item-resumo" onClick={onAlternar}>
          <span>{it.fornecedor || 'Sem fornecedor'}</span>
          <span>{num(it.quantidade, it.quantidade % 1 ? 2 : 0)} {it.unidade} × {brl(it.preco_cliente)}</span>
          <span>venc. {dataCurta(it.vencimento || it.data_final)}</span>
          <b>{brl(c.total)}</b>
        </button>
      ) : (
        <>
          {it.produto_nome ? (
            <div className="ce-forn">
              <input value={it.fornecedor ?? ''} onChange={e => onMudar({ fornecedor: e.target.value })} placeholder="Fornecedor" aria-label="Fornecedor" />
            </div>
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
              <div className="ce-chips">
                {PRAZOS.map(d => <button key={d} type="button" className={c.prazoDias === d ? 'ativo' : ''} onClick={() => onPrazo(d)}>{d}d</button>)}
              </div>
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
              <button type="button" onClick={() => onMudar({ preco_cliente: Math.round(c.precoSugerido * 100) / 100 })}><IconWand /> Usar</button>
            </div>
            <label className="ce-pc">
              Preço ao cliente
              <NumInput className={`ui-input ${abaixo ? 'abaixo' : ''}`} valor={it.preco_cliente} onChange={v => onMudar({ preco_cliente: v })} placeholder={num(c.precoSugerido)} inputProps={nav} />
            </label>
            <label className="ce-venc">
              Vencimento
              <input type="date" className="ui-input" value={it.vencimento ?? it.data_final ?? ''} onChange={e => onMudar({ vencimento: e.target.value || null })} {...nav} />
            </label>
            <div className="ce-total">
              <span>Total</span>
              <b>{brl(c.total)}</b>
            </div>
          </div>

          {(admin || abaixo) && !semPreco && (
            <div className="ce-indic">
              {abaixo && <span className="ce-tag alerta">{brl(Math.abs(c.diferenca))} abaixo do sugerido</span>}
              {!abaixo && c.diferenca > 0.005 && <span className="ce-tag ok">{brl(c.diferenca)} acima do sugerido</span>}
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
  .ce-layout{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:1.3rem;align-items:start}
  .ce-aside{position:sticky;top:76px;display:flex;flex-direction:column;gap:1rem}
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
  .ce-link{margin-left:auto;border:none;background:none;font-family:inherit;font-size:.72rem;font-weight:600;color:#8f978f;cursor:pointer}
  .ce-link:hover{color:#E67E22}

  .ce-item{margin-bottom:.8rem;transition:box-shadow .2s}
  .ce-item:focus-within{box-shadow:0 0 0 2px rgba(230,126,34,.25),0 8px 24px rgba(22,42,30,.07)}
  .ce-item-head{display:flex;align-items:center;gap:.6rem;padding:.7rem .8rem .7rem 1rem}
  .ce-item-n{width:26px;height:26px;border-radius:8px;background:#fdf3e9;color:#E67E22;font-size:.72rem;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .ce-qtd{display:flex;align-items:center;border:1.5px solid #eae5de;border-radius:9px;overflow:hidden;background:#fff;flex-shrink:0;transition:border-color .15s}
  .ce-qtd:focus-within{border-color:#E67E22}
  .ce-qtd .ui-input{border:none;width:90px;text-align:right;padding:.5rem .55rem;font-weight:600;box-shadow:none !important}
  .ce-und{width:52px;border:none;border-left:1px solid #f2efea;background:#faf8f5;padding:.5rem .4rem;font-family:inherit;font-size:.7rem;font-weight:600;color:#5b6660;text-align:center;outline:none;align-self:stretch}
  .ce-item-acoes{display:flex;gap:.15rem}
  .ce-ico{width:32px;height:32px;border:none;background:none;border-radius:8px;color:#8f978f;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s,color .15s}
  .ce-ico:hover{background:#f7f5f1;color:#162a1e}
  .ce-ico.perigo:hover{background:#fdeeec;color:#c0392b}
  .ce-item-resumo{display:flex;align-items:center;gap:1.1rem;width:100%;border:none;border-top:1px solid #f2efea;background:#fcfbf9;padding:.6rem 1rem .6rem calc(1rem + 26px + .6rem);font-family:inherit;font-size:.72rem;color:#8f978f;cursor:pointer;text-align:left;border-radius:0 0 16px 16px}
  .ce-item-resumo b{margin-left:auto;font-size:.86rem;color:#162a1e}
  .ce-forn{padding:0 1rem .4rem calc(1rem + 26px + .6rem);margin-top:-.45rem}
  .ce-forn input{border:none;background:none;font-family:inherit;font-size:.72rem;font-weight:600;color:#E67E22;outline:none;padding:.15rem .65rem;border-radius:6px;width:100%}
  .ce-forn input:focus{background:#fdf3e9}
  .ce-forn input::placeholder{color:#d4c3b0}

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
  .ce-chips button{border:1px solid #eae5de;background:#fff;border-radius:999px;padding:.18rem .48rem;font-family:inherit;font-size:.62rem;font-weight:600;color:#5b6660;cursor:pointer;transition:all .15s}
  .ce-chips button:hover{border-color:#E67E22;color:#E67E22}
  .ce-chips button.ativo{background:#162a1e;border-color:#162a1e;color:#fff}

  .ce-preco{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr) minmax(0,.9fr) minmax(0,1fr);gap:.8rem;align-items:end;padding:.85rem 1rem;border-top:1px solid #f2efea}
  .ce-sug{display:flex;flex-direction:column;gap:.15rem;font-size:.64rem;font-weight:600;color:#8f978f}
  .ce-sug b{font-size:1rem;color:#c0651a}
  .ce-sug button{align-self:flex-start;display:inline-flex;align-items:center;gap:.3rem;border:none;background:#fdf3e9;color:#c0651a;border-radius:7px;padding:.28rem .6rem;font-family:inherit;font-size:.66rem;font-weight:600;cursor:pointer;margin-top:.15rem}
  .ce-sug button:hover{background:#f5d9bd}
  .ce-pc .ui-input{font-size:.95rem;font-weight:600;text-align:right;border-color:#f5d9bd}
  .ce-pc .ui-input.abaixo{border-color:#f0b4ab;background:#fffafa}
  .ce-venc .ui-input{padding:.6rem .5rem;font-size:.78rem}
  .ce-total{text-align:right;display:flex;flex-direction:column;gap:.15rem}
  .ce-total span{font-size:.64rem;font-weight:600;color:#8f978f}
  .ce-total b{font-size:1.15rem;color:#162a1e;white-space:nowrap}
  .ce-indic{display:flex;flex-wrap:wrap;gap:.35rem;padding:0 1rem .85rem}
  .ce-tag{font-size:.66rem;color:#5b6660;background:#f7f5f1;border-radius:999px;padding:.25rem .6rem}
  .ce-tag b{color:#162a1e}
  .ce-tag.ok{background:#eaf7ef;color:#1e8a4c}.ce-tag.ok b{color:#1e8a4c}
  .ce-tag.alerta{background:#fdeeec;color:#c0392b}.ce-tag.alerta b{color:#c0392b}

  .ce-add{width:100%;display:flex;align-items:center;justify-content:center;gap:.5rem;border:1.5px dashed #d9d2c7;background:transparent;border-radius:14px;padding:.9rem;font-family:inherit;font-size:.82rem;font-weight:600;color:#5b6660;cursor:pointer;transition:all .15s}
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
  .ce-status-btn:hover{color:#162a1e}
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
  .ce-imprimir-menu button:hover{background:#f7f5f1}
  .ce-imprimir-menu small{display:block;font-size:.64rem;color:#8f978f;font-weight:400;margin-top:.1rem}
  .ce-cond{padding:1rem 1.1rem}
  .ce-cond-tit{font-size:.62rem;font-weight:600;color:#8f978f;text-transform:uppercase;letter-spacing:.08em;margin-bottom:.7rem}
  .ce-cond-grid{display:grid;grid-template-columns:1fr 1fr;gap:.6rem}
  .ce-cond-grid .ui-input{padding:.45rem .6rem;font-size:.8rem;text-align:right}
  .ce-cond-dica{font-size:.62rem;color:#b8bdb6;margin-top:.6rem;line-height:1.5}
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
    .ce-qtd{margin-left:calc(26px + .6rem)}
    .ce-item-acoes{margin-left:auto}
    .ce-item-resumo{flex-wrap:wrap;gap:.3rem .8rem;padding-left:1rem}
    .ce-status-btn{padding:.4rem .5rem}
  }
`

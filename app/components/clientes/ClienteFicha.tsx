'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { hojeISO } from '@/lib/dateUtils'
import { linkPontoGoogle, linkRotaGoogle } from '@/lib/geo'
import { STATUS_COTACAO, calcularTotais, itemDoBanco, parametrosDoBanco, brl } from '@/lib/cotacao'
import ConfirmDialog from '@/app/admin/_ui/ConfirmDialog'
import { Paginacao, usePaginacao } from '@/app/components/Tabela'

const Mapa = dynamic(() => import('@/app/components/Mapa'), { ssr: false, loading: () => <div className="ui-skeleton" style={{ height: 200, borderRadius: 12 }} /> })

type Rel<T> = T | T[] | null
const um = <T,>(r: Rel<T> | undefined): T | null => (Array.isArray(r) ? r[0] ?? null : r ?? null)

type Cliente = {
  id: string; nome: string; cpf_cnpj: string | null; inscricao_produtor: string | null; telefone: string | null; email: string | null
  cidade: string | null; estado: string | null; nome_fazenda: string | null; hectares: number | null; cultura_principal: string | null
  observacoes: string | null; created_at: string | null; criado_por: string | null; latitude: number | null; longitude: number | null
  responsavel: Rel<{ id: string; nome_completo: string | null }>
}
type Visita = {
  id: string; data_visita: string; hora_visita: string | null; status: string; motivo_visita: string | null; motivo_outro: string | null
  observacao_finalizacao: string | null; checkin_em: string | null; checklist: { cultura?: string; estadio?: string } | null
  funcionario: Rel<{ id: string; nome_completo: string | null }>
}
type Cotacao = { id: string; numero: string; status: string; created_at: string; pedido_status: string | null; venda: number; autor: string }
type Contato = { id: string; nome: string; funcao: string | null; telefone: string | null; email: string | null; principal: boolean }

type Evento = { id: string; data: string; tipo: 'visita' | 'cotacao'; titulo: string; sub: string; badge: { txt: string; cls: string }; href: string; extra?: string }

const STATUS_VISITA: Record<string, string> = { agendada: 'Agendada', realizada: 'Realizada', cancelada: 'Cancelada' }
const PEDIDO_LABEL: Record<string, string> = { aguardando: 'Pedido aguardando', faturado: 'Faturado', entregue: 'Entregue', cancelado: 'Pedido cancelado' }

function Icone({ d, size = 15 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" dangerouslySetInnerHTML={{ __html: d }} />
}
const I = {
  voltar: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  editar: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  mais: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  lixo: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  tel: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>',
  mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  doc: '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>',
  area: '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  visita: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
  cot: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  copiar: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  zap: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
}

const fmt = (d: string) => d.slice(0, 10).split('-').reverse().join('/')
const zapLink = (tel: string) => { const d = tel.replace(/\D/g, ''); return `https://wa.me/${d.length <= 11 ? '55' + d : d}` }

export default function ClienteFicha({ clienteId, base, admin }: { clienteId: string; base: string; admin: boolean }) {
  const supabase = createClient()
  const router = useRouter()
  const raiz = base.startsWith('/admin') ? '/admin' : '/dashboard'
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([])
  const [contatos, setContatos] = useState<Contato[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState<'tudo' | 'visita' | 'cotacao'>('tudo')
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [erro, setErro] = useState('')
  const [contatoForm, setContatoForm] = useState<Partial<Contato> | null>(null)
  const [salvandoContato, setSalvandoContato] = useState(false)
  const [excluirContato, setExcluirContato] = useState<Contato | null>(null)
  const [linkCopiado, setLinkCopiado] = useState(false)

  async function carregarContatos() {
    const { data } = await supabase.from('cliente_contatos').select('*').eq('cliente_id', clienteId).order('principal', { ascending: false }).order('nome')
    setContatos(data ?? [])
  }

  useEffect(() => {
    Promise.all([
      supabase.from('clientes').select('*, responsavel:profiles!clientes_responsavel_id_fkey(id, nome_completo)').eq('id', clienteId).single(),
      supabase.from('visitas').select('id, data_visita, hora_visita, status, motivo_visita, motivo_outro, observacao_finalizacao, checkin_em, checklist, funcionario:profiles(id, nome_completo)')
        .eq('cliente_id', clienteId).order('data_visita', { ascending: false }),
      supabase.from('cotacoes').select('id, numero, status, created_at, pedido_status, ptax, juros_mes, aliquota_icms, aliquota_ir, autor:profiles!cotacoes_criado_por_fkey(nome_completo), itens:cotacao_itens(*)')
        .eq('cliente_id', clienteId).order('created_at', { ascending: false }),
      supabase.from('cliente_contatos').select('*').eq('cliente_id', clienteId).order('principal', { ascending: false }).order('nome'),
    ]).then(([c, v, q, ct]) => {
      setCliente(c.data as Cliente | null)
      setVisitas((v.data ?? []) as unknown as Visita[])
      setCotacoes((q.data ?? []).map(x => ({
        id: x.id, numero: x.numero, status: x.status, created_at: x.created_at, pedido_status: x.pedido_status,
        autor: um(x.autor as Rel<{ nome_completo: string | null }>)?.nome_completo ?? '—',
        venda: calcularTotais(((x.itens ?? []) as Record<string, unknown>[]).map(itemDoBanco), parametrosDoBanco(x)).venda,
      })))
      setContatos(ct.data ?? [])
      setCarregando(false)
    })
  }, [clienteId])

  const eventos = useMemo<Evento[]>(() => {
    const hoje = hojeISO()
    const ev: Evento[] = visitas.map(v => {
      const atrasada = v.status === 'agendada' && v.data_visita < hoje
      const motivo = v.motivo_visita === 'Outros' ? `Outros — ${v.motivo_outro ?? ''}` : v.motivo_visita || 'Visita'
      const tecnico = v.checklist?.cultura ? ` · ${v.checklist.cultura}${v.checklist.estadio ? ` (${v.checklist.estadio})` : ''}` : ''
      return {
        id: `v-${v.id}`, data: v.data_visita + (v.hora_visita ? `T${v.hora_visita}` : 'T00:00'), tipo: 'visita',
        titulo: motivo, sub: `${um(v.funcionario)?.nome_completo ?? '—'}${tecnico}${v.checkin_em ? ' · check-in feito' : ''}`,
        badge: atrasada ? { txt: 'Atrasada', cls: 'ui-badge-cancelada' } : { txt: STATUS_VISITA[v.status] ?? v.status, cls: `ui-badge-${v.status}` },
        href: `${raiz}/visitas/${v.id}`, extra: v.observacao_finalizacao ?? undefined,
      }
    })
    cotacoes.forEach(q => {
      const st = STATUS_COTACAO[q.status] ?? STATUS_COTACAO.rascunho
      ev.push({
        id: `q-${q.id}`, data: q.created_at, tipo: 'cotacao', titulo: `Cotação ${q.numero} · ${brl(q.venda)}`,
        sub: `${q.autor}${q.pedido_status ? ` · ${PEDIDO_LABEL[q.pedido_status]}` : ''}`,
        badge: { txt: st.label, cls: st.badge }, href: `${raiz}/cotacoes/${q.id}`,
      })
    })
    return ev.sort((a, b) => b.data.localeCompare(a.data))
  }, [visitas, cotacoes, raiz])

  const exibidos = filtro === 'tudo' ? eventos : eventos.filter(e => e.tipo === filtro)
  const pag = usePaginacao(exibidos, 10, filtro)

  async function excluir() {
    setExcluindo(true)
    setErro('')
    const { error } = await supabase.from('clientes').delete().eq('id', clienteId)
    if (error) { setErro('Não foi possível excluir. Verifique sua permissão e tente novamente.'); setExcluindo(false); return }
    router.push(base)
  }

  async function salvarContato(e: React.FormEvent) {
    e.preventDefault()
    if (!contatoForm?.nome?.trim()) return
    setSalvandoContato(true)
    const payload = { cliente_id: clienteId, nome: contatoForm.nome.trim(), funcao: contatoForm.funcao || null, telefone: contatoForm.telefone || null, email: contatoForm.email || null, principal: !!contatoForm.principal }
    if (payload.principal) await supabase.from('cliente_contatos').update({ principal: false }).eq('cliente_id', clienteId)
    const { error } = contatoForm.id
      ? await supabase.from('cliente_contatos').update(payload).eq('id', contatoForm.id)
      : await supabase.from('cliente_contatos').insert(payload)
    setSalvandoContato(false)
    if (error) { setErro('Não foi possível salvar o contato.'); return }
    setContatoForm(null)
    carregarContatos()
  }

  async function confirmarExclusaoContato() {
    if (!excluirContato) return
    await supabase.from('cliente_contatos').delete().eq('id', excluirContato.id)
    setExcluirContato(null)
    carregarContatos()
  }

  if (carregando) {
    return <div><div className="ui-skeleton" style={{ height: 14, width: 160, marginBottom: '1rem' }} /><div className="ui-skeleton" style={{ height: 120, borderRadius: 16, marginBottom: '1.2rem' }} /><div className="ui-skeleton" style={{ height: 260, borderRadius: 16 }} /></div>
  }
  if (!cliente) {
    return <div className="ui-card" style={{ maxWidth: 520 }}><div className="ui-empty"><div className="ui-empty-title">Cliente não encontrado</div><div className="ui-empty-text">Ele pode ter sido excluído.</div><Link href={base} className="ui-btn ui-btn-secondary ui-btn-sm">Voltar para clientes</Link></div></div>
  }

  const hoje = hojeISO()
  const realizadas = visitas.filter(v => v.status === 'realizada')
  const ultima = realizadas[0]
  const proxima = [...visitas].reverse().find(v => v.status === 'agendada' && v.data_visita >= hoje)
  const diasSem = ultima ? Math.round((Date.parse(hoje) - Date.parse(ultima.data_visita)) / 86400000) : null
  const vendido = cotacoes.filter(c => c.status === 'efetivada').reduce((s, c) => s + c.venda, 0)
  const responsavel = um(cliente.responsavel)
  const local = [cliente.cidade, cliente.estado].filter(Boolean).join('/')
  const temPonto = cliente.latitude != null && cliente.longitude != null
  const linkMapa = temPonto ? linkPontoGoogle({ lat: cliente.latitude!, lng: cliente.longitude! }) : ''

  // Mensagem pronta para o motorista: o link abre o Google Maps já em modo navegação até a sede
  const linkRota = temPonto ? linkRotaGoogle([{ lat: cliente.latitude!, lng: cliente.longitude! }]) ?? '' : ''
  const textoMotorista = [
    `Entrega/visita: ${cliente.nome_fazenda || cliente.nome}`,
    cliente.nome_fazenda ? `Produtor: ${cliente.nome}` : '',
    local ? `Cidade: ${local}` : '',
    cliente.telefone ? `Contato: ${cliente.telefone}` : '',
    `Rota até a sede (abre no GPS): ${linkRota}`,
  ].filter(Boolean).join('\n')

  async function enviarMotorista() {
    if (navigator.share) {
      try { await navigator.share({ text: textoMotorista }); return } catch (e) { if ((e as Error).name === 'AbortError') return }
    }
    // sem número: o WhatsApp pede para escolher a conversa do motorista
    window.open(`https://wa.me/?text=${encodeURIComponent(textoMotorista)}`, '_blank')
  }

  async function copiarLocalizacao() {
    try { await navigator.clipboard.writeText(textoMotorista) } catch { window.prompt('Copie a rota:', linkRota); return }
    setLinkCopiado(true)
    setTimeout(() => setLinkCopiado(false), 2000)
  }

  const dados: { icone: string; label: string; valor: React.ReactNode }[] = [
    { icone: I.tel, label: 'Telefone', valor: cliente.telefone ? <span>{cliente.telefone} <a href={zapLink(cliente.telefone)} target="_blank" rel="noreferrer" className="cf-zap">WhatsApp</a></span> : null },
    { icone: I.mail, label: 'E-mail', valor: cliente.email },
    { icone: I.doc, label: 'CPF / CNPJ', valor: cliente.cpf_cnpj },
    { icone: I.doc, label: 'Inscrição do produtor', valor: cliente.inscricao_produtor },
    { icone: I.area, label: 'Área', valor: cliente.hectares ? `${cliente.hectares.toLocaleString('pt-BR')} hectares` : null },
    { icone: I.pin, label: 'Localização', valor: temPonto ? (
      <span className="cf-loc">
        <a href={linkMapa} target="_blank" rel="noreferrer" className="cf-link">{[local, `${cliente.latitude!.toFixed(5)}, ${cliente.longitude!.toFixed(5)}`].filter(Boolean).join(' · ')}</a>
        <span className="cf-loc-acoes">
          <button type="button" className="cf-zap cf-btn" onClick={enviarMotorista}><Icone d={I.zap} size={11} /> Enviar ao motorista</button>
          <button type="button" className="cf-zap cf-btn" onClick={copiarLocalizacao}><Icone d={I.copiar} size={11} /> {linkCopiado ? 'Rota copiada!' : 'Copiar rota'}</button>
          <a href={linkMapa} target="_blank" rel="noreferrer" className="cf-zap"><Icone d={I.pin} size={11} /> Abrir no mapa</a>
        </span>
      </span>
    ) : null },
    { icone: I.user, label: 'Consultor responsável', valor: responsavel ? (admin ? <Link href={`/admin/consultores/${responsavel.id}`} className="cf-link">{responsavel.nome_completo}</Link> : responsavel.nome_completo) : null },
  ]

  return (
    <>
      <style>{`
        .cf-hero{padding:1.4rem 1.5rem;display:flex;gap:1.1rem;align-items:flex-start;flex-wrap:wrap;margin-bottom:1.2rem}
        .cf-ini{width:60px;height:60px;border-radius:16px;background:#162a1e;color:#fff;font-size:1.5rem;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .cf-tit{flex:1;min-width:220px}
        .cf-nome{font-size:1.35rem;font-weight:600;color:#162a1e;line-height:1.25}
        .cf-meta{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-top:.45rem;font-size:.78rem;color:#8f978f}
        .cf-meta .laranja{color:#E67E22;font-weight:600}
        .cf-acoes{display:flex;gap:.5rem;flex-wrap:wrap}
        .cf-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-bottom:1.2rem}
        .cf-kpi{padding:1rem 1.2rem}
        .cf-kpi-l{font-size:.72rem;font-weight:500;color:#5b6660}
        .cf-kpi-n{font-size:1.25rem;font-weight:600;color:#162a1e;margin-top:.35rem}
        .cf-kpi-s{font-size:.7rem;color:#8f978f;margin-top:.2rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .cf-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:1.2rem;align-items:start}
        .cf-col{display:flex;flex-direction:column;gap:1.2rem;min-width:0}
        .cf-info{padding:.4rem 1.3rem .6rem}
        .cf-item{display:flex;gap:.75rem;align-items:flex-start;padding:.7rem 0;border-bottom:1px solid #f2efea}
        .cf-item:last-child{border-bottom:none}
        .cf-ico{width:32px;height:32px;border-radius:9px;background:#f7f5f1;color:#5b6660;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .cf-l{font-size:.62rem;font-weight:600;color:#8f978f;text-transform:uppercase;letter-spacing:.06em}
        .cf-v{font-size:.82rem;font-weight:600;color:#162a1e;margin-top:.2rem;word-break:break-word}
        .cf-v.vazio{color:#b8bdb6;font-weight:400;font-style:italic}
        .cf-zap{font-size:.68rem;color:#1e8a4c;background:#eaf7ef;border-radius:999px;padding:.12rem .5rem;margin-left:.3rem;text-decoration:none}
        .cf-link{color:#162a1e;text-decoration:none;border-bottom:1px dashed #cfc8bd}
        .cf-loc{display:flex;flex-direction:column;gap:.35rem}
        .cf-loc-acoes{display:flex;gap:.3rem;flex-wrap:wrap}
        .cf-loc-acoes .cf-zap{margin-left:0;display:inline-flex;align-items:center;gap:.25rem}
        .cf-btn{border:none;cursor:pointer;font-family:inherit;font-weight:600}
        .cf-tl{list-style:none;margin:0;padding:.3rem 1.3rem .4rem}
        .cf-ev{display:flex;gap:.85rem;padding:.75rem 0;position:relative;text-decoration:none}
        .cf-ev:not(:last-child)::after{content:'';position:absolute;left:15px;top:44px;bottom:-6px;width:2px;background:#f2efea}
        .cf-ev-ico{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .cf-ev-ico.visita{background:#fdf3e9;color:#E67E22}
        .cf-ev-ico.cotacao{background:#eaf7ef;color:#1a7f4b}
        .cf-ev-main{flex:1;min-width:0}
        .cf-ev-top{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}
        .cf-ev-t{font-size:.82rem;font-weight:600;color:#162a1e}
        .cf-ev-d{font-size:.7rem;color:#8f978f;margin-left:auto;white-space:nowrap}
        .cf-ev-s{font-size:.72rem;color:#5b6660;margin-top:.15rem}
        .cf-ev-x{font-size:.74rem;color:#5b6660;margin-top:.35rem;background:#faf8f5;border-radius:8px;padding:.45rem .6rem;white-space:pre-wrap;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
        a.cf-ev:hover .cf-ev-t{color:#E67E22}
        .cf-contato{display:flex;align-items:flex-start;gap:.6rem;padding:.65rem 1.3rem;border-top:1px solid #f2efea}
        .cf-contato:first-child{border-top:none}
        .cf-contato-n{font-size:.8rem;font-weight:600;color:#162a1e}
        .cf-contato-s{font-size:.7rem;color:#8f978f;margin-top:.1rem}
        .cf-mini{border:none;background:none;color:#b8bdb6;cursor:pointer;padding:.2rem;border-radius:6px;display:flex}
        .cf-mini:hover{color:#162a1e;background:#f7f5f1}
        .cf-obs{padding:1rem 1.3rem 1.2rem;font-size:.8rem;color:#3d4a42;line-height:1.7;white-space:pre-wrap}
        @media(max-width:1000px){.cf-grid{grid-template-columns:1fr}.cf-kpis{grid-template-columns:1fr 1fr}}
        @media(max-width:600px){.cf-acoes{width:100%}.cf-acoes .ui-btn{flex:1}}
      `}</style>

      <ConfirmDialog aberto={confirmarExclusao} titulo={`Excluir ${cliente.nome}?`} perigo carregando={excluindo} onConfirmar={excluir}
        confirmarTexto={visitas.length ? `Excluir cliente e ${visitas.length} visita${visitas.length !== 1 ? 's' : ''}` : 'Excluir cliente'}
        onCancelar={() => { setConfirmarExclusao(false); setErro('') }}>
        {visitas.length ? <>Este cliente tem <b>{visitas.length} visita{visitas.length !== 1 ? 's' : ''}</b>. Todas serão apagadas junto, com fotos e observações. Cotações ficam guardadas sem o vínculo.</> : 'O cadastro será apagado permanentemente.'}
        {erro && <div className="ui-alert ui-alert-erro" style={{ marginTop: '.8rem', marginBottom: 0 }}>{erro}</div>}
      </ConfirmDialog>
      <ConfirmDialog aberto={!!excluirContato} titulo="Excluir contato?" perigo confirmarTexto="Excluir" onConfirmar={confirmarExclusaoContato} onCancelar={() => setExcluirContato(null)}>
        {excluirContato?.nome} será removido da lista de contatos.
      </ConfirmDialog>

      {contatoForm && (
        <div className="ui-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setContatoForm(null) }}>
          <form className="ui-modal" onSubmit={salvarContato} style={{ maxWidth: 480 }}>
            <div className="ui-title" style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>{contatoForm.id ? 'Editar contato' : 'Novo contato'}</div>
            <div className="ui-field"><label className="ui-label">Nome <span className="ui-req">*</span></label><input className="ui-input" autoFocus value={contatoForm.nome ?? ''} onChange={e => setContatoForm(f => ({ ...f, nome: e.target.value }))} required /></div>
            <div className="ui-field"><label className="ui-label">Função</label>
              <input className="ui-input" list="funcoes-contato" placeholder="Ex.: Gerente, Agrônomo, Esposa" value={contatoForm.funcao ?? ''} onChange={e => setContatoForm(f => ({ ...f, funcao: e.target.value }))} />
              <datalist id="funcoes-contato"><option value="Proprietário" /><option value="Gerente" /><option value="Agrônomo" /><option value="Financeiro" /><option value="Encarregado" /></datalist>
            </div>
            <div className="ui-grid-2">
              <div className="ui-field"><label className="ui-label">Telefone</label><input className="ui-input" type="tel" value={contatoForm.telefone ?? ''} onChange={e => setContatoForm(f => ({ ...f, telefone: e.target.value }))} /></div>
              <div className="ui-field"><label className="ui-label">E-mail</label><input className="ui-input" type="email" value={contatoForm.email ?? ''} onChange={e => setContatoForm(f => ({ ...f, email: e.target.value }))} /></div>
            </div>
            <label style={{ display: 'flex', gap: '.5rem', alignItems: 'center', fontSize: '.8rem', color: '#5b6660', fontWeight: 600, marginBottom: '1.2rem' }}>
              <input type="checkbox" checked={!!contatoForm.principal} onChange={e => setContatoForm(f => ({ ...f, principal: e.target.checked }))} /> Contato principal
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.6rem' }}>
              <button type="button" className="ui-btn ui-btn-ghost" onClick={() => setContatoForm(null)}>Cancelar</button>
              <button type="submit" className="ui-btn ui-btn-primary" disabled={salvandoContato}>{salvandoContato ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="ui-breadcrumb">
        <Link href={base}><Icone d={I.voltar} size={14} /> Clientes</Link>
        <span className="ui-breadcrumb-sep">/</span>
        <span className="ui-breadcrumb-atual">{cliente.nome}</span>
      </div>

      <div className="ui-card cf-hero">
        <div className="cf-ini">{cliente.nome.charAt(0).toUpperCase()}</div>
        <div className="cf-tit">
          <div className="cf-nome">{cliente.nome}</div>
          <div className="cf-meta">
            {cliente.nome_fazenda && <span className="laranja">{cliente.nome_fazenda}</span>}
            {local && <><span className="ui-dot-sep" /><span>{local}</span></>}
            {cliente.cultura_principal && <><span className="ui-dot-sep" /><span>{cliente.cultura_principal}</span></>}
            {responsavel && <><span className="ui-dot-sep" /><span>Responsável: {responsavel.nome_completo}</span></>}
          </div>
        </div>
        <div className="cf-acoes">
          <Link href={`${base}/${cliente.id}/editar`} className="ui-btn ui-btn-ghost ui-btn-sm"><Icone d={I.editar} size={14} /> Editar</Link>
          {(admin || cliente.criado_por) && <button className="ui-btn ui-btn-danger ui-btn-sm" onClick={() => setConfirmarExclusao(true)} aria-label="Excluir cliente" title="Excluir cliente"><Icone d={I.lixo} size={14} /></button>}
          <Link href={`${raiz}/cotacoes/nova?cliente=${cliente.id}`} className="ui-btn ui-btn-secondary ui-btn-sm"><Icone d={I.cot} size={14} /> Nova cotação</Link>
          <Link href={`${raiz}/visitas/novo?cliente=${cliente.id}`} className="ui-btn ui-btn-primary ui-btn-sm"><Icone d={I.mais} size={14} /> Agendar visita</Link>
        </div>
      </div>

      <div className="cf-kpis">
        <div className="ui-card cf-kpi"><div className="cf-kpi-l">Visitas realizadas</div><div className="cf-kpi-n">{realizadas.length}</div><div className="cf-kpi-s">de {visitas.length} registradas</div></div>
        <div className="ui-card cf-kpi"><div className="cf-kpi-l">Última visita</div><div className="cf-kpi-n" style={{ color: diasSem != null && diasSem > 60 ? '#c0651a' : undefined }}>{ultima ? fmt(ultima.data_visita) : '—'}</div><div className="cf-kpi-s">{diasSem != null ? `há ${diasSem} dia${diasSem !== 1 ? 's' : ''}` : 'Nenhuma realizada'}</div></div>
        <div className="ui-card cf-kpi"><div className="cf-kpi-l">Próxima visita</div><div className="cf-kpi-n" style={{ color: proxima ? '#E67E22' : undefined }}>{proxima ? fmt(proxima.data_visita) : '—'}</div><div className="cf-kpi-s">{proxima ? um(proxima.funcionario)?.nome_completo : 'Nada agendado'}</div></div>
        <div className="ui-card cf-kpi"><div className="cf-kpi-l">Compras efetivadas</div><div className="cf-kpi-n">{brl(vendido)}</div><div className="cf-kpi-s">{cotacoes.length} cotaç{cotacoes.length === 1 ? 'ão' : 'ões'} no total</div></div>
      </div>

      <div className="cf-grid">
        <div className="cf-col">
          <div className="ui-card" style={{ overflow: 'hidden' }}>
            <div className="ui-card-header">
              <div className="ui-card-title">Linha do tempo</div>
              <div className="ui-segmented">
                <button className={filtro === 'tudo' ? 'ativo' : ''} onClick={() => setFiltro('tudo')}>Tudo <span className="ui-count">{eventos.length}</span></button>
                <button className={filtro === 'visita' ? 'ativo' : ''} onClick={() => setFiltro('visita')}>Visitas <span className="ui-count">{visitas.length}</span></button>
                <button className={filtro === 'cotacao' ? 'ativo' : ''} onClick={() => setFiltro('cotacao')}>Cotações <span className="ui-count">{cotacoes.length}</span></button>
              </div>
            </div>
            {exibidos.length === 0 ? (
              <div className="ui-empty"><div className="ui-empty-title">Nada registrado ainda</div><div className="ui-empty-text">Visitas e cotações deste cliente aparecem aqui, da mais recente para a mais antiga.</div></div>
            ) : (
              <>
                <ul className="cf-tl">
                  {pag.visiveis.map(e => (
                    <li key={e.id}>
                      <Link href={e.href} className="cf-ev">
                        <span className={`cf-ev-ico ${e.tipo}`}><Icone d={e.tipo === 'visita' ? I.visita : I.cot} size={15} /></span>
                        <div className="cf-ev-main">
                          <div className="cf-ev-top"><span className="cf-ev-t">{e.titulo}</span><span className={`ui-badge ${e.badge.cls}`}>{e.badge.txt}</span><span className="cf-ev-d">{fmt(e.data)}</span></div>
                          <div className="cf-ev-s">{e.sub}</div>
                          {e.extra && <div className="cf-ev-x">{e.extra}</div>}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Paginacao controle={pag.controle} rotulo="registros" />
              </>
            )}
          </div>
        </div>

        <div className="cf-col">
          <div className="ui-card">
            <div className="ui-card-header"><div className="ui-card-title">Dados do cliente</div></div>
            <div className="cf-info">
              {dados.map(d => (
                <div key={d.label} className="cf-item">
                  <div className="cf-ico"><Icone d={d.icone} /></div>
                  <div style={{ minWidth: 0 }}><div className="cf-l">{d.label}</div><div className={`cf-v ${d.valor ? '' : 'vazio'}`}>{d.valor || 'Não informado'}</div></div>
                </div>
              ))}
            </div>
            {cliente.observacoes && <div className="cf-obs" style={{ borderTop: '1px solid #f2efea' }}>{cliente.observacoes}</div>}
          </div>

          <div className="ui-card" style={{ overflow: 'hidden' }}>
            <div className="ui-card-header">
              <div className="ui-card-title">Contatos</div>
              <button className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => setContatoForm({ principal: contatos.length === 0 })}><Icone d={I.mais} size={13} /> Adicionar</button>
            </div>
            {contatos.length === 0 ? (
              <div className="cf-obs" style={{ color: '#8f978f' }}>Nenhum contato extra. Cadastre gerente, agrônomo ou outros responsáveis da fazenda.</div>
            ) : contatos.map(c => (
              <div key={c.id} className="cf-contato">
                <div className="ui-avatar ui-avatar-sm" style={{ background: c.principal ? '#E67E22' : '#162a1e' }}>{c.nome.charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cf-contato-n">{c.nome}{c.principal && <span className="ui-badge ui-badge-agendada" style={{ marginLeft: '.4rem' }}>Principal</span>}</div>
                  <div className="cf-contato-s">{[c.funcao, c.email].filter(Boolean).join(' · ') || '—'}</div>
                  {c.telefone && <div className="cf-contato-s">{c.telefone} <a href={zapLink(c.telefone)} target="_blank" rel="noreferrer" className="cf-zap">WhatsApp</a></div>}
                </div>
                <button className="cf-mini" onClick={() => setContatoForm(c)} title="Editar"><Icone d={I.editar} size={13} /></button>
                <button className="cf-mini" onClick={() => setExcluirContato(c)} title="Excluir"><Icone d={I.lixo} size={13} /></button>
              </div>
            ))}
          </div>

          <div className="ui-card" style={{ overflow: 'hidden' }}>
            <div className="ui-card-header">
              <div className="ui-card-title">Localização</div>
              {temPonto && <button type="button" onClick={enviarMotorista} className="ui-btn ui-btn-success ui-btn-sm"><Icone d={I.zap} size={13} /> Enviar rota ao motorista</button>}
            </div>
            {temPonto ? (
              <div style={{ padding: '0 1rem 1rem' }}>
                <Mapa altura={200} zoom={14} marcadores={[{ id: cliente.id, lat: cliente.latitude!, lng: cliente.longitude!, titulo: cliente.nome_fazenda || cliente.nome, cor: '#E67E22' }]} />
              </div>
            ) : (
              <div className="cf-obs" style={{ color: '#8f978f' }}>
                Sem localização. <Link href={`${base}/${cliente.id}/editar`} style={{ color: '#E67E22', fontWeight: 600 }}>Marcar no mapa</Link> ou salvar no check-in da próxima visita.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

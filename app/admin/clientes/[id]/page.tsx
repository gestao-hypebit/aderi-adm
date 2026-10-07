'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import ConfirmDialog from '../../_ui/ConfirmDialog'

type Cliente = {
  id: string
  nome: string
  cpf_cnpj: string | null
  telefone: string | null
  email: string | null
  cidade: string | null
  estado: string | null
  nome_fazenda: string | null
  hectares: number | null
  cultura_principal: string | null
  observacoes: string | null
  created_at: string | null
  criado_por: string | null
  criador?: { id: string; nome_completo: string | null } | { id: string; nome_completo: string | null }[] | null
}

type Visita = {
  id: string
  data_visita: string
  status: string
  motivo_visita: string | null
  motivo_outro: string | null
  funcionario: { id: string; nome_completo: string } | { id: string; nome_completo: string }[] | null
}

const STATUS_LABEL: Record<string, string> = { agendada: 'Agendada', realizada: 'Realizada', cancelada: 'Cancelada' }

function IconArrowLeft() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
}
function IconPlus() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function IconEdit() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
}
function IconFile() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
}
function IconSprout({ color = 'currentColor' }: { color?: string }) {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M7 20h10"/><path d="M10 20c0-4 .5-8 2-10"/><path d="M14 20c0-4-.5-8-2-10"/><path d="M5 5c1.5 0 3 1 3.5 3C7 8 5 7.5 4 6c-.5-1 0-1 1-1z"/><path d="M19 8c-1.5 0-3 .5-4 2 1.5 1 3 1 4 0 1-.5 1-1.5 0-2z"/></svg>
}
function IconPin() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
}
function IconPhone() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
}
function IconMail() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
}
function IconId() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
}
function IconMap() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
}
function IconTrash() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
}
function IconClipboard() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
}

export default function AdminClienteDetalhe() {
  const { id } = useParams()
  const supabase = createClient()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [carregando, setCarregando] = useState(true)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [erroExclusao, setErroExclusao] = useState('')
  const router = useRouter()

  useEffect(() => {
    async function carregar() {
      const [{ data: c }, { data: v }] = await Promise.all([
        supabase.from('clientes').select('*, criador:profiles!clientes_criado_por_fkey(id, nome_completo)').eq('id', id).single(),
        supabase
          .from('visitas')
          .select('id, data_visita, status, motivo_visita, motivo_outro, funcionario:profiles(id, nome_completo)')
          .eq('cliente_id', id)
          .order('data_visita', { ascending: false }),
      ])
      setCliente(c)
      setVisitas((v ?? []) as Visita[])
      setCarregando(false)
    }
    carregar()
  }, [id])

  async function excluir() {
    setExcluindo(true)
    setErroExclusao('')
    const { error } = await supabase.from('clientes').delete().eq('id', id)
    if (error) {
      setErroExclusao('Não foi possível excluir. Verifique sua permissão e tente novamente.')
      setExcluindo(false)
      return
    }
    router.push('/admin/clientes')
  }

  if (carregando) {
    return (
      <div style={{ maxWidth: 1080 }}>
        <div className="ui-skeleton" style={{ height: 14, width: 160, marginBottom: '1rem' }} />
        <div className="ui-skeleton" style={{ height: 120, borderRadius: 16, marginBottom: '1.2rem' }} />
        <div className="ui-skeleton" style={{ height: 260, borderRadius: 16 }} />
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="ui-card" style={{ maxWidth: 520 }}>
        <div className="ui-empty">
          <div className="ui-empty-title">Cliente não encontrado</div>
          <div className="ui-empty-text">Ele pode ter sido excluído.</div>
          <Link href="/admin/clientes" className="ui-btn ui-btn-secondary ui-btn-sm">Voltar para clientes</Link>
        </div>
      </div>
    )
  }

  const hoje = new Date().toISOString().slice(0, 10)
  const realizadas = visitas.filter(v => v.status === 'realizada').length
  const proxima = [...visitas].reverse().find(v => v.status === 'agendada' && v.data_visita >= hoje)
  const ultima = visitas.find(v => v.status === 'realizada')
  const local = [cliente.cidade, cliente.estado].filter(Boolean).join('/')
  const umFunc = (v: Visita) => (Array.isArray(v.funcionario) ? v.funcionario[0] : v.funcionario)
  const nomeFunc = (v: Visita) => umFunc(v)?.nome_completo ?? '—'
  const criador = Array.isArray(cliente.criador) ? cliente.criador[0] : cliente.criador
  // Consultores que já atenderam este cliente, com contagem de visitas
  const atendidoPor = Array.from(
    visitas.reduce((m, v) => {
      const f = umFunc(v)
      if (f) m.set(f.id, { id: f.id, nome: f.nome_completo, total: (m.get(f.id)?.total ?? 0) + 1 })
      return m
    }, new Map<string, { id: string; nome: string; total: number }>()).values()
  ).sort((a, b) => b.total - a.total)
  const fmt = (d: string) => new Date(d + 'T12:00').toLocaleDateString('pt-BR')

  const dados: { Icon: () => React.ReactElement; label: string; valor: string | null }[] = [
    { Icon: IconPhone, label: 'Telefone', valor: cliente.telefone },
    { Icon: IconMail, label: 'E-mail', valor: cliente.email },
    { Icon: IconId, label: 'CPF / CNPJ', valor: cliente.cpf_cnpj },
    { Icon: IconMap, label: 'Área', valor: cliente.hectares ? `${cliente.hectares.toLocaleString('pt-BR')} hectares` : null },
  ]

  return (
    <>
      <style>{`
        .cd-wrap{max-width:1080px}
        .cd-hero{padding:1.4rem 1.5rem;display:flex;gap:1.1rem;align-items:flex-start;flex-wrap:wrap;margin-bottom:1.2rem}
        .cd-inicial{width:60px;height:60px;border-radius:16px;background:#162a1e;color:#fff;font-size:1.5rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .cd-titulo{flex:1;min-width:220px}
        .cd-nome{font-size:1.35rem;font-weight:700;color:#162a1e;line-height:1.25}
        .cd-meta{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-top:.45rem;font-size:.78rem;color:#8f978f}
        .cd-meta span{display:inline-flex;align-items:center;gap:.3rem}
        .cd-meta .cd-fazenda{color:#E67E22;font-weight:700}
        .cd-acoes{display:flex;gap:.5rem;flex-wrap:wrap}
        .cd-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-bottom:1.2rem}
        .cd-kpi{padding:1rem 1.2rem}
        .cd-kpi-label{font-size:.64rem;font-weight:700;color:#8f978f;text-transform:uppercase;letter-spacing:.06em}
        .cd-kpi-num{font-size:1.25rem;font-weight:700;color:#162a1e;margin-top:.35rem;letter-spacing:-.01em}
        .cd-kpi-sub{font-size:.68rem;color:#8f978f;margin-top:.2rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .cd-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:1.2rem;align-items:start}
        .cd-info{padding:.4rem 1.3rem .6rem}
        .cd-info-item{display:flex;gap:.75rem;align-items:flex-start;padding:.75rem 0;border-bottom:1px solid #f2efea}
        .cd-info-item:last-child{border-bottom:none}
        .cd-info-icon{width:32px;height:32px;border-radius:9px;background:#f7f5f1;color:#5b6660;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .cd-info-label{font-size:.62rem;font-weight:700;color:#8f978f;text-transform:uppercase;letter-spacing:.06em}
        .cd-info-valor{font-size:.82rem;font-weight:700;color:#162a1e;margin-top:.2rem;word-break:break-word}
        .cd-info-valor.vazio{color:#b8bdb6;font-weight:400;font-style:italic}
        .cd-obs{padding:1rem 1.3rem 1.2rem;border-top:1px solid #f2efea;font-size:.8rem;color:#3d4a42;line-height:1.7;white-space:pre-wrap}
        .cd-equipe{padding:1rem 1.3rem 1.2rem;border-top:1px solid #f2efea}
        .cd-equipe-item{display:flex;justify-content:space-between;align-items:center;gap:.6rem;font-size:.76rem;color:#8f978f;padding:.4rem 0}
        .cd-equipe-item a{color:#162a1e;font-weight:700;text-decoration:none}
        .cd-equipe-item a:hover{color:#E67E22}
        @media(max-width:960px){.cd-grid{grid-template-columns:1fr}.cd-kpis{grid-template-columns:1fr 1fr}}
        @media(max-width:600px){.cd-acoes{width:100%}.cd-acoes .ui-btn{flex:1}}
      `}</style>

      <ConfirmDialog
        aberto={confirmarExclusao}
        titulo={`Excluir ${cliente.nome}?`}
        confirmarTexto={visitas.length > 0 ? `Excluir cliente e ${visitas.length} visita${visitas.length !== 1 ? 's' : ''}` : 'Excluir cliente'}
        perigo
        carregando={excluindo}
        onConfirmar={excluir}
        onCancelar={() => { setConfirmarExclusao(false); setErroExclusao('') }}
      >
        {visitas.length > 0
          ? <>Este cliente tem <b>{visitas.length} visita{visitas.length !== 1 ? 's' : ''}</b> registrada{visitas.length !== 1 ? 's' : ''}. Todas serão apagadas junto, com fotos e observações. Essa ação não pode ser desfeita.</>
          : 'O cadastro será apagado permanentemente.'}
        {erroExclusao && <div className="ui-alert ui-alert-erro" style={{ marginTop: '.8rem', marginBottom: 0 }}>{erroExclusao}</div>}
      </ConfirmDialog>

      <div className="cd-wrap">
        <div className="ui-breadcrumb">
          <Link href="/admin/clientes"><IconArrowLeft /> Clientes</Link>
          <span className="ui-breadcrumb-sep">/</span>
          <span className="ui-breadcrumb-atual">{cliente.nome}</span>
        </div>

        <div className="ui-card cd-hero">
          <div className="cd-inicial">{cliente.nome.charAt(0).toUpperCase()}</div>
          <div className="cd-titulo">
            <div className="cd-nome">{cliente.nome}</div>
            <div className="cd-meta">
              {cliente.nome_fazenda && <span className="cd-fazenda"><IconSprout color="#E67E22" />{cliente.nome_fazenda}</span>}
              {local && <>{cliente.nome_fazenda && <span className="ui-dot-sep" />}<span><IconPin />{local}</span></>}
              {cliente.cultura_principal && <><span className="ui-dot-sep" /><span>{cliente.cultura_principal}</span></>}
            </div>
          </div>
          <div className="cd-acoes">
            <Link href={`/admin/clientes/${cliente.id}/editar`} className="ui-btn ui-btn-ghost ui-btn-sm"><IconEdit /> Editar</Link>
            <Link href={`/admin/relatorios/clientes/${cliente.id}`} className="ui-btn ui-btn-secondary ui-btn-sm"><IconFile /> Ficha em PDF</Link>
            <button className="ui-btn ui-btn-danger ui-btn-sm" onClick={() => setConfirmarExclusao(true)} aria-label="Excluir cliente" title="Excluir cliente"><IconTrash /></button>
            <Link href={`/admin/visitas/novo?cliente=${cliente.id}`} className="ui-btn ui-btn-primary ui-btn-sm"><IconPlus /> Agendar visita</Link>
          </div>
        </div>

        <div className="cd-kpis">
          <div className="ui-card cd-kpi">
            <div className="cd-kpi-label">Visitas</div>
            <div className="cd-kpi-num">{visitas.length}</div>
            <div className="cd-kpi-sub">{realizadas} realizada{realizadas !== 1 ? 's' : ''}</div>
          </div>
          <div className="ui-card cd-kpi">
            <div className="cd-kpi-label">Última visita</div>
            <div className="cd-kpi-num">{ultima ? fmt(ultima.data_visita) : '—'}</div>
            <div className="cd-kpi-sub">{ultima ? nomeFunc(ultima) : 'Nenhuma realizada'}</div>
          </div>
          <div className="ui-card cd-kpi">
            <div className="cd-kpi-label">Próxima visita</div>
            <div className="cd-kpi-num" style={{ color: proxima ? '#E67E22' : undefined }}>{proxima ? fmt(proxima.data_visita) : '—'}</div>
            <div className="cd-kpi-sub">{proxima ? nomeFunc(proxima) : 'Nada agendado'}</div>
          </div>
          <div className="ui-card cd-kpi">
            <div className="cd-kpi-label">Cliente desde</div>
            <div className="cd-kpi-num">{cliente.created_at ? new Date(cliente.created_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace(' de ', ' ').replace('.', '') : '—'}</div>
            <div className="cd-kpi-sub">data do cadastro</div>
          </div>
        </div>

        <div className="cd-grid">
          <div className="ui-card" style={{ overflow: 'hidden' }}>
            <div className="ui-card-header">
              <div className="ui-card-title">Histórico de visitas</div>
              <span style={{ fontSize: '.7rem', color: '#8f978f', fontWeight: 700 }}>{visitas.length} no total</span>
            </div>
            {visitas.length === 0 ? (
              <div className="ui-empty">
                <div className="ui-empty-icon"><IconClipboard /></div>
                <div className="ui-empty-title">Nenhuma visita ainda</div>
                <div className="ui-empty-text">Agende a primeira visita para este produtor.</div>
                <Link href={`/admin/visitas/novo?cliente=${cliente.id}`} className="ui-btn ui-btn-secondary ui-btn-sm"><IconPlus /> Agendar visita</Link>
              </div>
            ) : visitas.map(v => {
              const d = new Date(v.data_visita + 'T12:00')
              const motivo = v.motivo_visita === 'Outros' ? `Outros — ${v.motivo_outro || ''}` : v.motivo_visita
              return (
                <Link key={v.id} href={`/admin/visitas/${v.id}`} className="ui-row">
                  <div className="ui-date">
                    <div className="ui-date-dia">{String(d.getDate()).padStart(2, '0')}</div>
                    <div className="ui-date-mes">{d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')} {String(d.getFullYear()).slice(2)}</div>
                  </div>
                  <div className="ui-row-main">
                    <div className="ui-row-title">{motivo || 'Visita'}</div>
                    <div className="ui-row-meta">{nomeFunc(v)}</div>
                  </div>
                  <span className={`ui-badge ui-badge-${v.status}`}>{STATUS_LABEL[v.status] ?? v.status}</span>
                </Link>
              )
            })}
          </div>

          <div className="ui-card">
            <div className="ui-card-header"><div className="ui-card-title">Dados do cliente</div></div>
            <div className="cd-info">
              {dados.map(({ Icon, label, valor }) => (
                <div key={label} className="cd-info-item">
                  <div className="cd-info-icon"><Icon /></div>
                  <div style={{ minWidth: 0 }}>
                    <div className="cd-info-label">{label}</div>
                    <div className={`cd-info-valor ${valor ? '' : 'vazio'}`}>{valor || 'Não informado'}</div>
                  </div>
                </div>
              ))}
            </div>
            {cliente.observacoes && <div className="cd-obs">{cliente.observacoes}</div>}
            <div className="cd-equipe">
              <div className="cd-info-label" style={{ marginBottom: '.6rem' }}>Equipe</div>
              <div className="cd-equipe-item">
                <span>Cadastrado por</span>
                {criador ? <Link href={`/admin/consultores/${criador.id}`}>{criador.nome_completo}</Link> : <b style={{ color: '#b8bdb6', fontWeight: 400 }}>Não registrado</b>}
              </div>
              {atendidoPor.map(a => (
                <div key={a.id} className="cd-equipe-item">
                  <Link href={`/admin/consultores/${a.id}`} style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                    <span className="ui-avatar ui-avatar-sm">{a.nome.charAt(0).toUpperCase()}</span>{a.nome}
                  </Link>
                  <span>{a.total} visita{a.total !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

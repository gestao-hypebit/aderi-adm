'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Tabela from '@/app/components/Tabela'
import ConfirmDialog from '../../_ui/ConfirmDialog'
import { calcRange, hojeISO } from '@/lib/dateUtils'

type Perfil = { id: string; nome_completo: string | null; cargo: string | null; telefone: string | null; role: string; ativo: boolean | null; created_at: string | null }
type Visita = {
  id: string
  data_visita: string
  hora_visita: string | null
  status: string
  motivo_visita: string | null
  cliente: { id: string; nome: string; nome_fazenda: string | null; cidade: string | null } | { id: string; nome: string; nome_fazenda: string | null; cidade: string | null }[] | null
}
type ClienteCriado = { id: string; nome: string; nome_fazenda: string | null; cidade: string | null }

const STATUS_LABEL: Record<string, string> = { agendada: 'Agendada', realizada: 'Realizada', cancelada: 'Cancelada' }

function IconArrowLeft() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
}
function IconPlus() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function IconEdit() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
}
function IconCalendar() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function IconPhone() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
}
function IconPower() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
}
function IconClipboard() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
}
function IconUsers() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}

const umCliente = (v: Visita) => (Array.isArray(v.cliente) ? v.cliente[0] : v.cliente)

export default function AdminConsultorDetalhe() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [criados, setCriados] = useState<ClienteCriado[]>([])
  const [kmMes, setKmMes] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [aba, setAba] = useState<'visitas' | 'clientes'>('visitas')
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'agendada' | 'realizada' | 'cancelada'>('todas')
  const [confirmarStatus, setConfirmarStatus] = useState(false)
  const [salvandoStatus, setSalvandoStatus] = useState(false)
  const [souEu, setSouEu] = useState(false)

  useEffect(() => {
    async function carregar() {
      const { inicio, fim } = calcRange('este-mes')
      const [{ data: { user } }, { data: p }, { data: v }, { data: c }, { data: km }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('profiles').select('id, nome_completo, cargo, telefone, role, ativo, created_at').eq('id', id).single(),
        supabase.from('visitas')
          .select('id, data_visita, hora_visita, status, motivo_visita, cliente:clientes(id, nome, nome_fazenda, cidade)')
          .eq('funcionario_id', id)
          .order('data_visita', { ascending: false }),
        supabase.from('clientes').select('id, nome, nome_fazenda, cidade').eq('criado_por', id).order('nome'),
        supabase.from('km_diario').select('km_inicial, km_final').eq('funcionario_id', id).gte('data', inicio).lte('data', fim),
      ])
      setSouEu(user?.id === id)
      setPerfil(p)
      setVisitas((v ?? []) as Visita[])
      setCriados(c ?? [])
      setKmMes((km ?? []).reduce((s, k) => s + (k.km_inicial != null && k.km_final != null ? Number(k.km_final) - Number(k.km_inicial) : 0), 0))
      setCarregando(false)
    }
    carregar()
  }, [id])

  const hoje = hojeISO()
  const { inicio: inicioMes, fim: fimMes } = calcRange('este-mes')

  const resumo = useMemo(() => {
    const doMes = visitas.filter(v => v.data_visita >= inicioMes && v.data_visita <= fimMes)
    const realizadasMes = doMes.filter(v => v.status === 'realizada').length
    const agendadasMes = doMes.filter(v => v.status === 'agendada').length
    const atrasadas = visitas.filter(v => v.status === 'agendada' && v.data_visita < hoje).length
    const proxima = [...visitas].reverse().find(v => v.status === 'agendada' && v.data_visita >= hoje) ?? null
    return { realizadasMes, agendadasMes, atrasadas, proxima, taxa: realizadasMes + agendadasMes > 0 ? Math.round(realizadasMes / (realizadasMes + agendadasMes) * 100) : null }
  }, [visitas, inicioMes, fimMes, hoje])

  // Carteira: clientes cadastrados por ele + clientes com quem tem visita
  const carteira = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; nome_fazenda: string | null; cidade: string | null; visitas: number; ultima: string | null }>()
    criados.forEach(c => map.set(c.id, { ...c, visitas: 0, ultima: null }))
    visitas.forEach(v => {
      const c = umCliente(v)
      if (!c) return
      if (!map.has(c.id)) map.set(c.id, { ...c, visitas: 0, ultima: null })
      const item = map.get(c.id)!
      item.visitas++
      if (v.status === 'realizada' && (!item.ultima || v.data_visita > item.ultima)) item.ultima = v.data_visita
    })
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [criados, visitas])

  const visitasFiltradas = filtroStatus === 'todas' ? visitas : visitas.filter(v => v.status === filtroStatus)

  async function alternarAtivo() {
    if (!perfil) return
    setSalvandoStatus(true)
    const novo = perfil.ativo === false
    const { error } = await supabase.from('profiles').update({ ativo: novo }).eq('id', perfil.id)
    if (!error) setPerfil({ ...perfil, ativo: novo })
    setSalvandoStatus(false)
    setConfirmarStatus(false)
  }

  if (carregando) {
    return (
      <div>
        <div className="ui-skeleton" style={{ height: 14, width: 160, marginBottom: '1rem' }} />
        <div className="ui-skeleton" style={{ height: 120, borderRadius: 16, marginBottom: '1.2rem' }} />
        <div className="ui-skeleton" style={{ height: 300, borderRadius: 16 }} />
      </div>
    )
  }

  if (!perfil) {
    return (
      <div className="ui-card" style={{ maxWidth: 520 }}>
        <div className="ui-empty">
          <div className="ui-empty-title">Consultor não encontrado</div>
          <Link href="/admin/consultores" className="ui-btn ui-btn-secondary ui-btn-sm">Voltar para consultores</Link>
        </div>
      </div>
    )
  }

  const nome = perfil.nome_completo || 'Sem nome'
  const inativo = perfil.ativo === false
  const fmt = (d: string) => new Date(d + 'T12:00').toLocaleDateString('pt-BR')

  return (
    <>
      <style>{`
        .cs-wrap{width:100%}
        .cs-hero{padding:1.4rem 1.5rem;display:flex;gap:1.1rem;align-items:center;flex-wrap:wrap;margin-bottom:1.2rem}
        .cs-avatar{width:64px;height:64px;border-radius:50%;background:#162a1e;color:#fff;font-size:1.6rem;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative}
        .cs-avatar-dot{position:absolute;right:2px;bottom:2px;width:14px;height:14px;border-radius:50%;border:3px solid #fff}
        .cs-titulo{flex:1;min-width:200px}
        .cs-nome{font-size:1.35rem;font-weight:600;color:#162a1e;display:flex;align-items:center;gap:.6rem;flex-wrap:wrap}
        .cs-meta{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-top:.4rem;font-size:.76rem;color:#8f978f}
        .cs-meta a{color:#5b6660;text-decoration:none;display:inline-flex;align-items:center;gap:.3rem}
        .cs-acoes{display:flex;gap:.5rem;flex-wrap:wrap}
        .cs-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:1rem;margin-bottom:1.2rem}
        .cs-kpi{padding:1rem 1.15rem}
        .cs-kpi-label{font-size:.62rem;font-weight:600;color:#8f978f;text-transform:uppercase;letter-spacing:.06em}
        .cs-kpi-num{font-size:1.3rem;font-weight:600;color:#162a1e;margin-top:.35rem}
        .cs-kpi-sub{font-size:.66rem;color:#8f978f;margin-top:.2rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .cs-tabs{display:flex;gap:.2rem;padding:0 1rem;border-bottom:1px solid #f2efea;overflow-x:auto}
        .cs-tab{background:none;border:none;border-bottom:2px solid transparent;padding:.95rem .6rem .8rem;margin-bottom:-1px;font-family:'Poppins',sans-serif;font-size:.8rem;font-weight:600;color:#8f978f;cursor:pointer;display:flex;align-items:center;gap:.45rem;white-space:nowrap}
        .cs-tab:hover{color:#162a1e}
        .cs-tab.ativo{color:#162a1e;border-bottom-color:#E67E22}
        .cs-tab .ui-count{font-size:.64rem;background:#f2efea;color:#5b6660;border-radius:999px;padding:.1rem .45rem}
        .cs-toolbar{padding:.85rem 1.4rem;display:flex;justify-content:space-between;align-items:center;gap:.6rem;flex-wrap:wrap;border-bottom:1px solid #f2efea}
        .cs-inativo{display:flex;align-items:center;gap:.6rem;background:#fdeeec;border:1px solid #f6d3cf;color:#b03a2e;border-radius:12px;padding:.75rem 1rem;font-size:.78rem;font-weight:600;margin-bottom:1.2rem}
        @media(max-width:1000px){.cs-kpis{grid-template-columns:repeat(3,1fr)}}
        @media(max-width:600px){.cs-kpis{grid-template-columns:1fr 1fr}.cs-acoes{width:100%}.cs-acoes .ui-btn{flex:1}}
      `}</style>

      <ConfirmDialog
        aberto={confirmarStatus}
        titulo={inativo ? `Reativar o acesso de ${nome}?` : `Desativar o acesso de ${nome}?`}
        confirmarTexto={inativo ? 'Reativar acesso' : 'Desativar acesso'}
        perigo={!inativo}
        carregando={salvandoStatus}
        onConfirmar={alternarAtivo}
        onCancelar={() => setConfirmarStatus(false)}
      >
        {inativo
          ? 'A pessoa volta a conseguir entrar no sistema com o mesmo e-mail e senha.'
          : 'A pessoa não consegue mais entrar no sistema e deixa de aparecer para novos agendamentos. Visitas, clientes e histórico são mantidos.'}
      </ConfirmDialog>

      <div className="cs-wrap">
        <div className="ui-breadcrumb">
          <Link href="/admin/consultores"><IconArrowLeft /> Consultores</Link>
          <span className="ui-breadcrumb-sep">/</span>
          <span className="ui-breadcrumb-atual">{nome}</span>
        </div>

        {inativo && (
          <div className="cs-inativo">
            <IconPower /> Acesso desativado. Esta pessoa não consegue entrar no sistema.
          </div>
        )}

        <div className="ui-card cs-hero">
          <div className="cs-avatar" style={perfil.role === 'admin' ? { background: '#E67E22' } : undefined}>
            {nome.charAt(0).toUpperCase()}
            <span className="cs-avatar-dot" style={{ background: inativo ? '#e74c3c' : '#27ae60' }} />
          </div>
          <div className="cs-titulo">
            <div className="cs-nome">
              {nome}
              <span className={`ui-badge ${perfil.role === 'admin' ? 'ui-badge-agendada' : 'ui-badge-neutro'}`}>{perfil.role === 'admin' ? 'Administrador' : 'Consultor'}</span>
            </div>
            <div className="cs-meta">
              <span>{perfil.cargo || 'Consultor de campo'}</span>
              {perfil.telefone && <><span className="ui-dot-sep" /><a href={`tel:${perfil.telefone.replace(/\D/g, '')}`}><IconPhone />{perfil.telefone}</a></>}
              {perfil.created_at && <><span className="ui-dot-sep" /><span>Desde {new Date(perfil.created_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace(' de ', ' ').replace('.', '')}</span></>}
            </div>
          </div>
          <div className="cs-acoes">
            <Link href={`/admin/consultores/${perfil.id}/editar`} className="ui-btn ui-btn-ghost ui-btn-sm"><IconEdit /> Editar</Link>
            {!souEu && (
              <button className={`ui-btn ui-btn-sm ${inativo ? 'ui-btn-secondary' : 'ui-btn-danger'}`} onClick={() => setConfirmarStatus(true)}>
                <IconPower /> {inativo ? 'Reativar' : 'Desativar'}
              </button>
            )}
            <Link href={`/admin/agenda?func=${perfil.id}`} className="ui-btn ui-btn-secondary ui-btn-sm"><IconCalendar /> Agenda</Link>
            {!inativo && <Link href={`/admin/visitas/novo?funcionario=${perfil.id}`} className="ui-btn ui-btn-primary ui-btn-sm"><IconPlus /> Agendar visita</Link>}
          </div>
        </div>

        <div className="cs-kpis">
          <div className="ui-card cs-kpi">
            <div className="cs-kpi-label">Realizadas no mês</div>
            <div className="cs-kpi-num">{resumo.realizadasMes}</div>
            <div className="cs-kpi-sub">{resumo.agendadasMes} ainda agendada{resumo.agendadasMes !== 1 ? 's' : ''}</div>
          </div>
          <div className="ui-card cs-kpi">
            <div className="cs-kpi-label">Conclusão no mês</div>
            <div className="cs-kpi-num" style={{ color: resumo.taxa == null ? '#b8bdb6' : resumo.taxa >= 70 ? '#27ae60' : '#E67E22' }}>{resumo.taxa == null ? '—' : `${resumo.taxa}%`}</div>
            <div className="ui-progress" style={{ marginTop: '.45rem' }}><span style={{ width: `${resumo.taxa ?? 0}%`, background: (resumo.taxa ?? 0) >= 70 ? '#27ae60' : '#E67E22' }} /></div>
          </div>
          <div className="ui-card cs-kpi">
            <div className="cs-kpi-label">Atrasadas</div>
            <div className="cs-kpi-num" style={{ color: resumo.atrasadas > 0 ? '#e74c3c' : undefined }}>{resumo.atrasadas}</div>
            <div className="cs-kpi-sub">agendadas com data passada</div>
          </div>
          <div className="ui-card cs-kpi">
            <div className="cs-kpi-label">Próxima visita</div>
            <div className="cs-kpi-num" style={{ fontSize: '1.05rem', color: resumo.proxima ? '#E67E22' : '#b8bdb6' }}>{resumo.proxima ? fmt(resumo.proxima.data_visita) : '—'}</div>
            <div className="cs-kpi-sub">{resumo.proxima ? umCliente(resumo.proxima)?.nome : 'Nada agendado'}</div>
          </div>
          <div className="ui-card cs-kpi">
            <div className="cs-kpi-label">KM no mês</div>
            <div className="cs-kpi-num">{kmMes.toLocaleString('pt-BR')}</div>
            <div className="cs-kpi-sub"><Link href={`/admin/relatorios/km?func=${id}`} style={{ color: '#E67E22', textDecoration: 'none', fontWeight: 600 }}>Ver lançamentos →</Link></div>
          </div>
        </div>

        <div className="ui-card" style={{ overflow: 'hidden' }}>
          <div className="cs-tabs" role="tablist">
            <button role="tab" aria-selected={aba === 'visitas'} className={`cs-tab ${aba === 'visitas' ? 'ativo' : ''}`} onClick={() => setAba('visitas')}>
              Visitas <span className="ui-count">{visitas.length}</span>
            </button>
            <button role="tab" aria-selected={aba === 'clientes'} className={`cs-tab ${aba === 'clientes' ? 'ativo' : ''}`} onClick={() => setAba('clientes')}>
              Carteira de clientes <span className="ui-count">{carteira.length}</span>
            </button>
          </div>

          {aba === 'visitas' ? (
            <>
              <div className="cs-toolbar">
                <div className="ui-segmented">
                  {(['todas', 'agendada', 'realizada', 'cancelada'] as const).map(s => (
                    <button key={s} className={filtroStatus === s ? 'ativo' : ''} onClick={() => setFiltroStatus(s)}>
                      {s === 'todas' ? 'Todas' : STATUS_LABEL[s] + 's'}
                    </button>
                  ))}
                </div>
                <Link href={`/admin/visitas?func=${perfil.id}`} className="ui-card-link">Abrir na lista de visitas →</Link>
              </div>
              <Tabela
                embutida
                linhas={visitasFiltradas}
                chave={v => v.id}
                href={v => `/admin/visitas/${v.id}`}
                porPagina={10}
                reiniciar={filtroStatus}
                rotulo="visitas"
                destaque={v => v.status === 'agendada' && v.data_visita < hoje}
                vazio={
                  <div className="ui-empty">
                    <div className="ui-empty-icon"><IconClipboard /></div>
                    <div className="ui-empty-title">Nenhuma visita</div>
                    {!inativo && <Link href={`/admin/visitas/novo?funcionario=${perfil.id}`} className="ui-btn ui-btn-secondary ui-btn-sm"><IconPlus /> Agendar visita</Link>}
                  </div>
                }
                colunas={[
                  { id: 'data', titulo: 'Data', largura: '110px', ordenar: (a, b) => a.data_visita.localeCompare(b.data_visita),
                    celula: v => <><div className="ui-cel-num ui-cel-forte">{new Date(v.data_visita + 'T12:00').toLocaleDateString('pt-BR')}</div>{v.hora_visita && <div className="ui-cel-sub">{v.hora_visita.slice(0, 5)}</div>}</> },
                  { id: 'cliente', titulo: 'Cliente', ordenar: (a, b) => (umCliente(a)?.nome ?? '').localeCompare(umCliente(b)?.nome ?? ''),
                    celula: v => { const c = umCliente(v); return <div className="ui-cel-txt"><div className="ui-cel-titulo">{c?.nome ?? 'Cliente removido'}</div>{c?.nome_fazenda && <div className="ui-cel-sub laranja">{c.nome_fazenda}</div>}</div> } },
                  { id: 'motivo', titulo: 'Motivo', ocultar: 'tablet', celula: v => v.motivo_visita || 'Visita' },
                  { id: 'status', titulo: 'Status', largura: '110px', ordenar: (a, b) => a.status.localeCompare(b.status),
                    celula: v => v.status === 'agendada' && v.data_visita < hoje
                      ? <span className="ui-badge ui-badge-cancelada">Atrasada</span>
                      : <span className={`ui-badge ui-badge-${v.status}`}>{STATUS_LABEL[v.status] ?? v.status}</span> },
                ]}
              />
            </>
          ) : (
            <Tabela
              embutida
              linhas={carteira}
              chave={c => c.id}
              href={c => `/admin/clientes/${c.id}`}
              porPagina={10}
              rotulo="clientes"
              vazio={
                <div className="ui-empty">
                  <div className="ui-empty-icon"><IconUsers /></div>
                  <div className="ui-empty-title">Nenhum cliente na carteira</div>
                  <div className="ui-empty-text">Clientes aparecem aqui quando este consultor cadastra ou visita um produtor.</div>
                </div>
              }
              colunas={[
                { id: 'nome', titulo: 'Cliente', ordenar: (a, b) => a.nome.localeCompare(b.nome),
                  celula: c => <div className="ui-cel"><div className="ui-cel-ini">{c.nome.charAt(0).toUpperCase()}</div><div className="ui-cel-txt"><div className="ui-cel-titulo">{c.nome}</div>{c.nome_fazenda && <div className="ui-cel-sub laranja">{c.nome_fazenda}</div>}</div></div> },
                { id: 'cidade', titulo: 'Cidade', ocultar: 'celular', celula: c => c.cidade || <span className="ui-cel-mudo">—</span> },
                { id: 'visitas', titulo: 'Visitas', alinhar: 'dir', ordenar: (a, b) => a.visitas - b.visitas, celula: c => <span className="ui-cel-num ui-cel-forte">{c.visitas}</span> },
                { id: 'ultima', titulo: 'Última realizada', alinhar: 'dir', ocultar: 'celular', ordenar: (a, b) => (a.ultima ?? '').localeCompare(b.ultima ?? ''),
                  celula: c => c.ultima ? <span className="ui-cel-num">{new Date(c.ultima + 'T12:00').toLocaleDateString('pt-BR')}</span> : <span className="ui-cel-mudo">—</span> },
              ]}
            />
          )}
        </div>
      </div>
    </>
  )
}

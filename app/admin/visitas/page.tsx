'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { baixarCsv, dataBR } from '@/lib/csv'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import FiltrosPainel from '@/app/components/FiltrosPainel'
import { type Filtros, defaultFiltros } from '@/lib/dateUtils'

type VisitaRaw = {
  id: string
  data_visita: string
  hora_visita: string | null
  status: string
  motivo_visita: string | null
  motivo_outro: string | null
  cliente: { id: string; nome: string; nome_fazenda: string | null } | { id: string; nome: string; nome_fazenda: string | null }[]
  funcionario: { id: string; nome_completo: string } | { id: string; nome_completo: string }[]
}

type Visita = {
  id: string
  data_visita: string
  hora_visita: string | null
  status: string
  motivo_visita: string | null
  motivo_outro: string | null
  cliente: { id: string; nome: string; nome_fazenda: string | null }
  funcionario: { id: string; nome_completo: string }
}

type Colaborador = { id: string; nome_completo: string }
type Cliente = { id: string; nome: string }

const statusCor: Record<string, string> = {
  agendada: '#E67E22',
  realizada: '#27ae60',
  cancelada: '#e74c3c',
}

const statusLabel: Record<string, string> = {
  agendada: 'Agendada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
}

function IconSprout({ color = 'currentColor', size = 12 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M7 20h10"/><path d="M10 20c0-4 .5-8 2-10"/><path d="M14 20c0-4-.5-8-2-10"/><path d="M5 5c1.5 0 3 1 3.5 3C7 8 5 7.5 4 6c-.5-1 0-1 1-1z"/><path d="M19 8c-1.5 0-3 .5-4 2 1.5 1 3 1 4 0 1-.5 1-1.5 0-2z"/></svg>
}


function IconPlus() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function IconClipboard() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
}
function IconDownload() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
}
function IconChevron() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="9 18 15 12 9 6"/></svg>
}

function normalizar(raw: VisitaRaw): Visita {
  return {
    ...raw,
    cliente: Array.isArray(raw.cliente) ? raw.cliente[0] : raw.cliente,
    funcionario: Array.isArray(raw.funcionario) ? raw.funcionario[0] : raw.funcionario,
  }
}

function AdminVisitasLista() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  // Atalhos (ficha do consultor/cliente) chegam com ?func= / ?cliente= / ?status= e olham o ano todo
  const [filtros, setFiltros] = useState<Filtros>(() => {
    const func = searchParams.get('func') ?? ''
    const cliente = searchParams.get('cliente') ?? ''
    const base = defaultFiltros(func || cliente ? 'este-ano' : 'este-mes')
    return { ...base, funcionarioId: func, clienteId: cliente }
  })
  const [busca, setBusca] = useState('')
  const [mostrar, setMostrar] = useState(50)
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'agendada' | 'atrasada' | 'realizada' | 'cancelada'>(() => {
    const st = searchParams.get('status')
    return st === 'agendada' || st === 'atrasada' || st === 'realizada' || st === 'cancelada' ? st : 'todas'
  })

  useEffect(() => {
    async function carregarLookups() {
      const [{ data: colabs }, { data: clis }] = await Promise.all([
        supabase.from('profiles').select('id, nome_completo').eq('role', 'colaborador').order('nome_completo'),
        supabase.from('clientes').select('id, nome').order('nome'),
      ])
      setColaboradores(colabs || [])
      setClientes(clis || [])
    }
    carregarLookups()
  }, [])

  useEffect(() => {
    async function carregarVisitas() {
      setCarregando(true)
      let query = supabase
        .from('visitas')
        .select('id, data_visita, hora_visita, status, motivo_visita, motivo_outro, cliente:clientes(id, nome, nome_fazenda), funcionario:profiles(id, nome_completo)')
        .gte('data_visita', filtros.dataInicio)
        .lte('data_visita', filtros.dataFim)
        .order('data_visita', { ascending: false })

      if (filtros.funcionarioId) query = query.eq('funcionario_id', filtros.funcionarioId)
      if (filtros.clienteId) query = query.eq('cliente_id', filtros.clienteId)

      const { data } = await query
      setVisitas((data || []).map(v => normalizar(v as unknown as VisitaRaw)))
      setCarregando(false)
    }
    carregarVisitas()
  }, [filtros.dataInicio, filtros.dataFim, filtros.funcionarioId, filtros.clienteId])

  const hoje = new Date().toISOString().slice(0, 10)
  const ehAtrasada = (v: Visita) => v.status === 'agendada' && v.data_visita < hoje
  const termo = busca.trim().toLowerCase()
  const visitasBusca = termo
    ? visitas.filter(v =>
        (v.cliente?.nome ?? '').toLowerCase().includes(termo) ||
        (v.cliente?.nome_fazenda ?? '').toLowerCase().includes(termo) ||
        (v.funcionario?.nome_completo ?? '').toLowerCase().includes(termo) ||
        (v.motivo_visita ?? '').toLowerCase().includes(termo))
    : visitas
  const contagem: Record<string, number> = {
    todas: visitasBusca.length,
    agendada: visitasBusca.filter(v => v.status === 'agendada').length,
    atrasada: visitasBusca.filter(ehAtrasada).length,
    realizada: visitasBusca.filter(v => v.status === 'realizada').length,
    cancelada: visitasBusca.filter(v => v.status === 'cancelada').length,
  }
  const visitasExibidas =
    filtroStatus === 'todas' ? visitasBusca
    : filtroStatus === 'atrasada' ? visitasBusca.filter(ehAtrasada)
    : visitasBusca.filter(v => v.status === filtroStatus)

  function exportar() {
    baixarCsv(
      `visitas-aderi-${filtros.dataInicio}-a-${filtros.dataFim}`,
      ['Data', 'Hora', 'Cliente', 'Fazenda', 'Consultor', 'Motivo', 'Status'],
      visitasExibidas.map(v => [
        dataBR(v.data_visita), v.hora_visita?.slice(0, 5), v.cliente?.nome, v.cliente?.nome_fazenda, v.funcionario?.nome_completo,
        v.motivo_visita === 'Outros' ? `Outros — ${v.motivo_outro || ''}` : v.motivo_visita,
        ehAtrasada(v) ? 'Atrasada' : (statusLabel[v.status] || v.status),
      ])
    )
  }

  return (
    <>
      <style>{`
        .vl-toolbar{display:flex;align-items:center;justify-content:space-between;gap:.8rem;flex-wrap:wrap;margin-bottom:.9rem}
        .vl-busca{width:280px !important;padding:.55rem .8rem .55rem 2.1rem !important;font-size:.78rem !important;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238f978f' stroke-width='2.2'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'/%3E%3C/svg%3E") no-repeat .75rem center !important}
        .vl-mais{display:block;width:100%;padding:.85rem;border:none;border-top:1px solid #f2efea;background:#faf8f5;font-family:'Comfortaa',sans-serif;font-size:.76rem;font-weight:700;color:#E67E22;cursor:pointer}
        .vl-mais:hover{background:#fdf3e9}
        .vl-rodape{display:flex;justify-content:space-between;align-items:center;padding:.7rem 1.4rem;border-top:1px solid #f2efea;background:#faf8f5;font-size:.72rem;color:#8f978f;font-weight:700}
        .vl-lista{overflow:hidden}
        .vl-header,.vl-row{display:grid;grid-template-columns:96px minmax(0,1.6fr) minmax(0,1fr) minmax(0,1fr) 112px 18px;gap:1rem;align-items:center;padding:0 1.4rem}
        .vl-header{padding-top:.7rem;padding-bottom:.7rem;background:#faf8f5;font-size:.62rem;font-weight:700;color:#8f978f;letter-spacing:.08em;text-transform:uppercase;border-bottom:1px solid #f2efea}
        .vl-row{padding-top:.85rem;padding-bottom:.85rem;border-bottom:1px solid #f2efea;text-decoration:none;transition:background .15s}
        .vl-row:last-child{border-bottom:none}
        .vl-row:hover{background:#fcfaf7}
        .vl-row:hover .vl-chevron{color:#E67E22;transform:translateX(2px)}
        .vl-data{font-size:.8rem;font-weight:700;color:#162a1e}
        .vl-hora{font-size:.68rem;color:#8f978f;margin-top:.15rem}
        .vl-cliente{font-size:.84rem;font-weight:700;color:#162a1e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .vl-fazenda{display:flex;align-items:center;gap:.3rem;font-size:.7rem;color:#E67E22;font-weight:700;margin-top:.15rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .vl-colab{display:flex;align-items:center;gap:.5rem;font-size:.76rem;color:#5b6660;min-width:0}
        .vl-colab span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .vl-motivo{font-size:.74rem;color:#8f978f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .vl-chevron{color:#d4d0c9;transition:all .15s;display:flex}
        @media(max-width:900px){
          .vl-header{display:none}
          .vl-row{grid-template-columns:1fr auto;grid-template-areas:"cli status" "meta meta";gap:.35rem .8rem;padding:.9rem 1.1rem}
          .vl-c-data,.vl-motivo,.vl-chevron{display:none}
          .vl-c-cli{grid-area:cli}
          .vl-c-status{grid-area:status}
          .vl-colab{grid-area:meta}
          .vl-busca{width:100% !important}
          .vl-toolbar .ui-segmented{width:100%;overflow-x:auto;flex-wrap:nowrap}
        }
      `}</style>

      <div className="ui-page-header">
        <div>
          <div className="ui-title">Visitas</div>
          <div className="ui-sub">Todas as visitas da equipe, com filtro por período, consultor e cliente</div>
        </div>
        <div className="ui-header-actions">
          <button className="ui-btn ui-btn-secondary" onClick={exportar} disabled={carregando || visitasExibidas.length === 0}><IconDownload /> Exportar</button>
          <Link href="/admin/visitas/novo" className="ui-btn ui-btn-primary"><IconPlus /> Nova visita</Link>
        </div>
      </div>

      <FiltrosPainel
        value={filtros}
        onChange={setFiltros}
        showFuncionario
        clientes={clientes}
        funcionarios={colaboradores}
      />

      <div className="vl-toolbar">
        <div className="ui-segmented" role="tablist" aria-label="Filtrar por status">
          {([
            ['todas', 'Todas'],
            ['agendada', 'Agendadas'],
            ['atrasada', 'Atrasadas'],
            ['realizada', 'Realizadas'],
            ['cancelada', 'Canceladas'],
          ] as const).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={filtroStatus === k} className={filtroStatus === k ? 'ativo' : ''} onClick={() => { setFiltroStatus(k); setMostrar(50) }}>
              {k !== 'todas' && <span className="ui-badge-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: k === 'atrasada' ? '#c0392b' : statusCor[k] }} />}
              {label}
              <span className="ui-count">{carregando ? '·' : contagem[k]}</span>
            </button>
          ))}
        </div>
        <input
          className="ui-input vl-busca"
          placeholder="Buscar cliente, fazenda, consultor..."
          value={busca}
          onChange={e => { setBusca(e.target.value); setMostrar(50) }}
        />
      </div>

      <div className="ui-card vl-lista">
        <div className="vl-header">
          <span>Data</span><span>Cliente</span><span>Consultor</span><span>Motivo</span><span>Status</span><span />
        </div>
        {carregando ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="vl-row" style={{ pointerEvents: 'none' }}>
              <div className="ui-skeleton" style={{ height: 14, width: 70 }} />
              <div className="ui-skeleton" style={{ height: 14, width: '70%' }} />
              <div className="ui-skeleton" style={{ height: 14, width: '60%' }} />
              <div className="ui-skeleton" style={{ height: 14, width: '50%' }} />
              <div className="ui-skeleton" style={{ height: 20, width: 80, borderRadius: 999 }} />
              <span />
            </div>
          ))
        ) : visitasExibidas.length === 0 ? (
          <div className="ui-empty">
            <div className="ui-empty-icon"><IconClipboard /></div>
            <div className="ui-empty-title">Nenhuma visita encontrada</div>
            <div className="ui-empty-text">Ajuste o período ou os filtros acima, ou agende uma nova visita.</div>
            <Link href="/admin/visitas/novo" className="ui-btn ui-btn-secondary ui-btn-sm"><IconPlus /> Nova visita</Link>
          </div>
        ) : (
          visitasExibidas.slice(0, mostrar).map(v => {
            const motivo = v.motivo_visita === 'Outros'
              ? `Outros — ${v.motivo_outro || ''}`
              : (v.motivo_visita || '—')
            const nomeColab = v.funcionario?.nome_completo ?? '—'
            return (
              <Link key={v.id} href={`/admin/visitas/${v.id}`} className="vl-row">
                <div className="vl-c-data">
                  <div className="vl-data">{new Date(v.data_visita + 'T12:00').toLocaleDateString('pt-BR')}</div>
                  {v.hora_visita && <div className="vl-hora">{v.hora_visita.slice(0, 5)}</div>}
                </div>
                <div className="vl-c-cli" style={{ minWidth: 0 }}>
                  <div className="vl-cliente">{v.cliente?.nome}</div>
                  {v.cliente?.nome_fazenda && (
                    <div className="vl-fazenda"><IconSprout color="#E67E22" />{v.cliente.nome_fazenda}</div>
                  )}
                </div>
                <div className="vl-colab">
                  <div className="ui-avatar ui-avatar-sm">{nomeColab.charAt(0).toUpperCase()}</div>
                  <span>{nomeColab}</span>
                </div>
                <div className="vl-motivo">{motivo}</div>
                <div className="vl-c-status">
                  {ehAtrasada(v)
                    ? <span className="ui-badge ui-badge-cancelada" title="Agendada para uma data que já passou">Atrasada</span>
                    : <span className={`ui-badge ui-badge-${v.status}`}>{statusLabel[v.status] || v.status}</span>}
                </div>
                <span className="vl-chevron"><IconChevron /></span>
              </Link>
            )
          })
        )}
        {!carregando && visitasExibidas.length > mostrar && (
          <button className="vl-mais" onClick={() => setMostrar(m => m + 50)}>
            Mostrar mais ({visitasExibidas.length - mostrar} restantes)
          </button>
        )}
        {!carregando && visitasExibidas.length > 0 && (
          <div className="vl-rodape">
            <span>{visitasExibidas.length} visita{visitasExibidas.length !== 1 ? 's' : ''}</span>
            <span>{dataBR(filtros.dataInicio)} – {dataBR(filtros.dataFim)}</span>
          </div>
        )}
      </div>
    </>
  )
}

export default function AdminVisitasListaPage() {
  return (
    <Suspense fallback={null}>
      <AdminVisitasLista />
    </Suspense>
  )
}

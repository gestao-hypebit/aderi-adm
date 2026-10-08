'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { baixarCsv, dataBR } from '@/lib/csv'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import FiltrosPainel from '@/app/components/FiltrosPainel'
import Tabela from '@/app/components/Tabela'
import { type Filtros, defaultFiltros, descreverPeriodo, ehDesdeInicio, hojeISO } from '@/lib/dateUtils'

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



function IconPlus() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function IconClipboard() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
}
function IconDownload() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
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
  // Atalhos (ficha do consultor/cliente) chegam com ?func= / ?cliente= / ?status=
  const [filtros, setFiltros] = useState<Filtros>(() => {
    const func = searchParams.get('func') ?? ''
    const cliente = searchParams.get('cliente') ?? ''
    const base = defaultFiltros()
    return { ...base, funcionarioId: func, clienteId: cliente }
  })
  const [busca, setBusca] = useState('')
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
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

  const hoje = hojeISO()
  const ehAtrasada = (v: Visita) => v.status === 'agendada' && v.data_visita < hoje

  async function cancelarVisita(id: string) {
    setErro('')
    const { error } = await supabase.from('visitas').update({ status: 'cancelada' }).eq('id', id)
    if (error) { setErro('Não foi possível cancelar a visita.'); return }
    setVisitas(l => l.map(v => (v.id === id ? { ...v, status: 'cancelada' } : v)))
  }

  async function excluirVisita(id: string) {
    setErro('')
    const { error } = await supabase.from('visitas').delete().eq('id', id)
    if (error) { setErro('Não foi possível excluir a visita.'); return }
    setVisitas(l => l.filter(v => v.id !== id))
  }

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
      ehDesdeInicio(filtros.dataInicio, filtros.dataFim) ? 'visitas-aderi-todas' : `visitas-aderi-${filtros.dataInicio}-a-${filtros.dataFim}`,
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
        @media(max-width:900px){
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
            <button key={k} role="tab" aria-selected={filtroStatus === k} className={filtroStatus === k ? 'ativo' : ''} onClick={() => setFiltroStatus(k)}>
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
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {erro && <div className="ui-alert ui-alert-erro">{erro}</div>}
      <Tabela
        linhas={visitasExibidas}
        chave={v => v.id}
        href={v => `/admin/visitas/${v.id}`}
        carregando={carregando}
        reiniciar={`${filtroStatus}|${busca}|${filtros.dataInicio}|${filtros.dataFim}|${filtros.funcionarioId}|${filtros.clienteId}`}
        rotulo={`visitas · ${descreverPeriodo(filtros.dataInicio, filtros.dataFim)}`}
        destaque={ehAtrasada}
        acoes={v => [
          { rotulo: 'Abrir visita', icone: 'ver', href: `/admin/visitas/${v.id}` },
          { rotulo: 'Editar', icone: 'editar', href: `/admin/visitas/${v.id}/editar` },
          v.status === 'agendada' && { rotulo: 'Cancelar visita', icone: 'cancelar', onClick: () => cancelarVisita(v.id),
            confirmar: { titulo: 'Cancelar esta visita?', botao: 'Cancelar visita', texto: <>A visita de {dataBR(v.data_visita)} com {v.cliente?.nome ?? 'o cliente'} fica marcada como cancelada. Ela continua no histórico.</> } },
          { rotulo: 'Excluir', icone: 'excluir', perigo: true, onClick: () => excluirVisita(v.id),
            confirmar: { titulo: 'Excluir esta visita?', botao: 'Excluir visita', texto: <>A visita de {dataBR(v.data_visita)} com {v.cliente?.nome ?? 'o cliente'} será apagada, com fotos e observações. Para manter o histórico, prefira cancelar.</> } },
        ]}
        vazio={
          <div className="ui-empty">
            <div className="ui-empty-icon"><IconClipboard /></div>
            <div className="ui-empty-title">Nenhuma visita encontrada</div>
            <div className="ui-empty-text">Ajuste o período ou os filtros acima, ou agende uma nova visita.</div>
            <Link href="/admin/visitas/novo" className="ui-btn ui-btn-secondary ui-btn-sm"><IconPlus /> Nova visita</Link>
          </div>
        }
        colunas={[
          { id: 'data', titulo: 'Data', largura: '110px', ordenar: (a, b) => (a.data_visita + (a.hora_visita ?? '')).localeCompare(b.data_visita + (b.hora_visita ?? '')),
            celula: v => <><div className="ui-cel-forte ui-cel-num">{dataBR(v.data_visita)}</div>{v.hora_visita && <div className="ui-cel-sub">{v.hora_visita.slice(0, 5)}</div>}</> },
          { id: 'cliente', titulo: 'Cliente', ordenar: (a, b) => (a.cliente?.nome ?? '').localeCompare(b.cliente?.nome ?? ''),
            celula: v => <div className="ui-cel-txt"><div className="ui-cel-titulo">{v.cliente?.nome ?? 'Cliente removido'}</div>{v.cliente?.nome_fazenda && <div className="ui-cel-sub laranja">{v.cliente.nome_fazenda}</div>}</div> },
          { id: 'consultor', titulo: 'Consultor', ocultar: 'celular', ordenar: (a, b) => (a.funcionario?.nome_completo ?? '').localeCompare(b.funcionario?.nome_completo ?? ''),
            celula: v => <div className="ui-cel"><span className="ui-avatar ui-avatar-sm">{(v.funcionario?.nome_completo ?? '?').charAt(0).toUpperCase()}</span><span className="ui-cel-titulo" style={{ fontWeight: 500 }}>{v.funcionario?.nome_completo ?? '—'}</span></div> },
          { id: 'motivo', titulo: 'Motivo', ocultar: 'tablet',
            celula: v => <span className="ui-cel-sub" style={{ fontSize: '.76rem', display: 'block' }}>{v.motivo_visita === 'Outros' ? `Outros — ${v.motivo_outro || ''}` : (v.motivo_visita || '—')}</span> },
          { id: 'status', titulo: 'Status', largura: '120px', ordenar: (a, b) => a.status.localeCompare(b.status),
            celula: v => ehAtrasada(v)
              ? <span className="ui-badge ui-badge-cancelada" title="Agendada para uma data que já passou">Atrasada</span>
              : <span className={`ui-badge ui-badge-${v.status}`}>{statusLabel[v.status] || v.status}</span> },
        ]}
      />
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

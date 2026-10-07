'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import FiltrosPainel from '@/app/components/FiltrosPainel'
import Tabela from '@/app/components/Tabela'
import { type Filtros, defaultFiltros, descreverPeriodo, hojeISO } from '@/lib/dateUtils'

type Visita = {
  id: string
  data_visita: string
  hora_visita: string | null
  status: string
  motivo_visita: string | null
  motivo_outro: string | null
  cliente: { id: string; nome: string; nome_fazenda: string | null; cidade: string | null; estado: string | null } | null
}

type Cliente = { id: string; nome: string }
type FiltroStatus = 'todas' | 'agendada' | 'atrasada' | 'realizada' | 'cancelada'

const STATUS_LABEL: Record<string, string> = { agendada: 'Agendada', realizada: 'Realizada', cancelada: 'Cancelada' }
const STATUS_COR: Record<string, string> = { agendada: '#E67E22', atrasada: '#c0392b', realizada: '#27ae60', cancelada: '#e74c3c' }

function IconPlus() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function IconClipboard() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
}

const dataBR = (d: string) => d.split('-').reverse().join('/')

export default function VisitasPage() {
  const supabase = createClient()
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtros, setFiltros] = useState<Filtros>(() => defaultFiltros())
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todas')

  useEffect(() => {
    supabase.from('clientes').select('id, nome').order('nome').then(({ data }) => setClientes(data || []))
  }, [])

  useEffect(() => {
    let query = supabase
      .from('visitas')
      .select('id, data_visita, hora_visita, status, motivo_visita, motivo_outro, cliente:clientes(id, nome, nome_fazenda, cidade, estado)')
      .gte('data_visita', filtros.dataInicio)
      .lte('data_visita', filtros.dataFim)
      .order('data_visita', { ascending: false })
    if (filtros.clienteId) query = query.eq('cliente_id', filtros.clienteId)
    query.then(({ data }) => {
      setVisitas((data as unknown as Visita[]) || [])
      setCarregando(false)
    })
  }, [filtros.dataInicio, filtros.dataFim, filtros.clienteId])

  const hoje = hojeISO()
  const ehAtrasada = (v: Visita) => v.status === 'agendada' && v.data_visita < hoje
  const contagem: Record<FiltroStatus, number> = useMemo(() => ({
    todas: visitas.length,
    agendada: visitas.filter(v => v.status === 'agendada').length,
    atrasada: visitas.filter(v => v.status === 'agendada' && v.data_visita < hoje).length,
    realizada: visitas.filter(v => v.status === 'realizada').length,
    cancelada: visitas.filter(v => v.status === 'cancelada').length,
  }), [visitas, hoje])

  const exibidas = filtroStatus === 'todas' ? visitas
    : filtroStatus === 'atrasada' ? visitas.filter(ehAtrasada)
    : visitas.filter(v => v.status === filtroStatus)

  return (
    <>
      <div className="ui-page-header">
        <div>
          <div className="ui-title">Visitas</div>
          <div className="ui-sub">Suas visitas agendadas e realizadas</div>
        </div>
        <div className="ui-header-actions">
          <Link href="/dashboard/visitas/novo" className="ui-btn ui-btn-primary"><IconPlus /> Nova visita</Link>
        </div>
      </div>

      <FiltrosPainel value={filtros} onChange={f => { setCarregando(true); setFiltros(f) }} clientes={clientes} />

      <div style={{ marginBottom: '.9rem', overflowX: 'auto' }}>
        <div className="ui-segmented" role="tablist" aria-label="Filtrar por status">
          {([['todas', 'Todas'], ['agendada', 'Agendadas'], ['atrasada', 'Atrasadas'], ['realizada', 'Realizadas'], ['cancelada', 'Canceladas']] as [FiltroStatus, string][]).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={filtroStatus === k} className={filtroStatus === k ? 'ativo' : ''} onClick={() => setFiltroStatus(k)}>
              {k !== 'todas' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COR[k] }} />}
              {label}
              <span className="ui-count">{carregando ? '·' : contagem[k]}</span>
            </button>
          ))}
        </div>
      </div>

      <Tabela
        linhas={exibidas}
        chave={v => v.id}
        href={v => `/dashboard/visitas/${v.id}`}
        carregando={carregando}
        reiniciar={`${filtroStatus}|${filtros.dataInicio}|${filtros.dataFim}|${filtros.clienteId}`}
        rotulo={`visitas · ${descreverPeriodo(filtros.dataInicio, filtros.dataFim)}`}
        destaque={ehAtrasada}
        vazio={
          <div className="ui-empty">
            <div className="ui-empty-icon"><IconClipboard /></div>
            <div className="ui-empty-title">Nenhuma visita encontrada</div>
            <div className="ui-empty-text">Ajuste o período ou os filtros, ou agende uma nova visita.</div>
            <Link href="/dashboard/visitas/novo" className="ui-btn ui-btn-secondary ui-btn-sm"><IconPlus /> Nova visita</Link>
          </div>
        }
        colunas={[
          { id: 'data', titulo: 'Data', largura: '110px', ordenar: (a, b) => (a.data_visita + (a.hora_visita ?? '')).localeCompare(b.data_visita + (b.hora_visita ?? '')),
            celula: v => <><div className="ui-cel-forte ui-cel-num">{dataBR(v.data_visita)}</div>{v.hora_visita && <div className="ui-cel-sub">{v.hora_visita.slice(0, 5)}</div>}</> },
          { id: 'cliente', titulo: 'Cliente', ordenar: (a, b) => (a.cliente?.nome ?? '').localeCompare(b.cliente?.nome ?? ''),
            celula: v => <div className="ui-cel-txt"><div className="ui-cel-titulo">{v.cliente?.nome ?? 'Cliente removido'}</div>{v.cliente?.nome_fazenda && <div className="ui-cel-sub laranja">{v.cliente.nome_fazenda}</div>}</div> },
          { id: 'local', titulo: 'Cidade', ocultar: 'tablet',
            celula: v => [v.cliente?.cidade, v.cliente?.estado].filter(Boolean).join('/') || <span className="ui-cel-mudo">—</span> },
          { id: 'motivo', titulo: 'Motivo', ocultar: 'celular',
            celula: v => <span className="ui-cel-sub" style={{ fontSize: '.76rem', display: 'block' }}>{v.motivo_visita === 'Outros' ? `Outros — ${v.motivo_outro || ''}` : (v.motivo_visita || '—')}</span> },
          { id: 'status', titulo: 'Status', largura: '120px', ordenar: (a, b) => a.status.localeCompare(b.status),
            celula: v => ehAtrasada(v)
              ? <span className="ui-badge ui-badge-cancelada">Atrasada</span>
              : <span className={`ui-badge ui-badge-${v.status}`}>{STATUS_LABEL[v.status] ?? v.status}</span> },
        ]}
      />
    </>
  )
}

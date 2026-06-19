'use client'

import { useEffect, useState } from 'react'
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

function IconUser({ color = '#888', size = 12 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
}

function normalizar(raw: VisitaRaw): Visita {
  return {
    ...raw,
    cliente: Array.isArray(raw.cliente) ? raw.cliente[0] : raw.cliente,
    funcionario: Array.isArray(raw.funcionario) ? raw.funcionario[0] : raw.funcionario,
  }
}

export default function AdminVisitasListaPage() {
  const supabase = createClient()
  const [filtros, setFiltros] = useState<Filtros>(() => defaultFiltros('este-mes'))
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carregando, setCarregando] = useState(true)

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

  const realizadas = visitas.filter(v => v.status === 'realizada').length
  const agendadas = visitas.filter(v => v.status === 'agendada').length
  const canceladas = visitas.filter(v => v.status === 'cancelada').length

  return (
    <>
      <style>{`
        .page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem}
        .page-title{font-size:1.3rem;font-weight:700;color:#162a1e}
        .page-sub{font-size:.8rem;color:#aaa;margin-top:.2rem}
        .btn-nova{display:inline-flex;align-items:center;gap:.5rem;background:#E67E22;color:#fff;padding:.7rem 1.4rem;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.85rem;font-weight:700;text-decoration:none;transition:background .2s}
        .btn-nova:hover{background:#d35400}
        .kpis{display:flex;gap:.8rem;margin-bottom:1.2rem;flex-wrap:wrap}
        .kpi{background:#fff;border-radius:10px;padding:.75rem 1.2rem;display:flex;align-items:center;gap:.65rem;box-shadow:0 2px 8px rgba(0,0,0,.04)}
        .kpi-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
        .kpi-num{font-size:1.3rem;font-weight:900;color:#162a1e;line-height:1.1}
        .kpi-label{font-size:.7rem;color:#aaa;font-weight:700;text-transform:uppercase;letter-spacing:.03em}
        .lista{background:#fff;border-radius:14px;box-shadow:0 2px 10px rgba(0,0,0,.05);overflow:hidden}
        .lista-header{display:grid;grid-template-columns:110px 1fr 160px 160px 100px;gap:1rem;padding:.65rem 1.2rem;background:#f8f6f2;font-size:.65rem;font-weight:700;color:#aaa;letter-spacing:.06em;text-transform:uppercase;border-bottom:1px solid #f0ede8}
        .visita-row{display:grid;grid-template-columns:110px 1fr 160px 160px 100px;gap:1rem;padding:.9rem 1.2rem;border-bottom:1px solid #f8f6f2;text-decoration:none;transition:background .15s;align-items:center}
        .visita-row:last-child{border-bottom:none}
        .visita-row:hover{background:#fff8f3}
        .v-data{font-size:.8rem;font-weight:700;color:#162a1e}
        .v-hora{font-size:.7rem;color:#aaa;margin-top:.1rem}
        .v-cliente{font-size:.85rem;font-weight:700;color:#162a1e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .v-fazenda{display:flex;align-items:center;gap:.3rem;font-size:.72rem;color:#E67E22;font-weight:700;margin-top:.1rem}
        .v-colab{display:flex;align-items:center;gap:.35rem;font-size:.78rem;color:#555}
        .v-motivo{font-size:.75rem;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .v-badge{display:inline-flex;align-items:center;font-size:.68rem;font-weight:700;padding:.25rem .7rem;border-radius:10px;color:#fff}
        .lista-vazio{text-align:center;padding:3rem;color:#bbb;font-size:.9rem}
        @media(max-width:768px){
          .lista-header{display:none}
          .visita-row{grid-template-columns:1fr;gap:.25rem;padding:.9rem 1.2rem}
        }
      `}</style>

      <div className="page-header">
        <div>
          <div className="page-title">Todas as Visitas</div>
          <div className="page-sub">Visitas de todos os colaboradores</div>
        </div>
        <Link href="/admin/visitas/novo" className="btn-nova">+ Nova Visita</Link>
      </div>

      <FiltrosPainel
        value={filtros}
        onChange={setFiltros}
        showFuncionario
        clientes={clientes}
        funcionarios={colaboradores}
      />

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-dot" style={{background:'#27ae60'}}/>
          <div><div className="kpi-num">{realizadas}</div><div className="kpi-label">Realizadas</div></div>
        </div>
        <div className="kpi">
          <div className="kpi-dot" style={{background:'#E67E22'}}/>
          <div><div className="kpi-num">{agendadas}</div><div className="kpi-label">Agendadas</div></div>
        </div>
        <div className="kpi">
          <div className="kpi-dot" style={{background:'#e74c3c'}}/>
          <div><div className="kpi-num">{canceladas}</div><div className="kpi-label">Canceladas</div></div>
        </div>
        <div className="kpi">
          <div><div className="kpi-num">{visitas.length}</div><div className="kpi-label">Total</div></div>
        </div>
      </div>

      <div className="lista">
        {!carregando && visitas.length > 0 && (
          <div className="lista-header">
            <span>Data</span><span>Cliente</span><span>Consultor</span><span>Motivo</span><span>Status</span>
          </div>
        )}
        {carregando ? (
          <div className="lista-vazio">Carregando...</div>
        ) : visitas.length === 0 ? (
          <div className="lista-vazio">Nenhuma visita encontrada no período.</div>
        ) : (
          visitas.map(v => {
            const motivo = v.motivo_visita === 'Outros'
              ? `Outros — ${v.motivo_outro || ''}`
              : (v.motivo_visita || '—')
            return (
              <Link key={v.id} href={`/admin/visitas/${v.id}`} className="visita-row">
                <div>
                  <div className="v-data">{new Date(v.data_visita + 'T12:00').toLocaleDateString('pt-BR')}</div>
                  {v.hora_visita && <div className="v-hora">{v.hora_visita.slice(0, 5)}</div>}
                </div>
                <div>
                  <div className="v-cliente">{v.cliente?.nome}</div>
                  {v.cliente?.nome_fazenda && (
                    <div className="v-fazenda"><IconSprout color="#E67E22" />{v.cliente.nome_fazenda}</div>
                  )}
                </div>
                <div className="v-colab"><IconUser />{v.funcionario?.nome_completo}</div>
                <div className="v-motivo">{motivo}</div>
                <div>
                  <div className="v-badge" style={{background: statusCor[v.status] || '#aaa'}}>
                    {statusLabel[v.status] || v.status}
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </>
  )
}

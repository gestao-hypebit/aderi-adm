'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import FiltrosPainel from '@/app/components/FiltrosPainel'
import { type Filtros, defaultFiltros } from '@/lib/dateUtils'

type Visita = {
  id: string
  data_visita: string
  hora_visita: string | null
  status: string
  motivo_visita: string | null
  cliente: { id: string; nome: string; nome_fazenda: string; cidade: string; estado: string }
  funcionario: { nome_completo: string } | null
}

type Cliente = { id: string; nome: string }
type Funcionario = { id: string; nome_completo: string }

const statusCor: Record<string, string> = {
  agendada: '#E67E22',
  realizada: '#27ae60',
  cancelada: '#e74c3c',
}

function IconArrowLeft() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
}
function IconPdf({ color = '#E67E22' }: { color?: string }) {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
}
function IconSprout({ color = 'currentColor' }: { color?: string }) {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M7 20h10"/><path d="M10 20c0-4 .5-8 2-10"/><path d="M14 20c0-4-.5-8-2-10"/><path d="M5 5c1.5 0 3 1 3.5 3C7 8 5 7.5 4 6c-.5-1 0-1 1-1z"/><path d="M19 8c-1.5 0-3 .5-4 2 1.5 1 3 1 4 0 1-.5 1-1.5 0-2z"/></svg>
}
function IconUser({ color = '#aaa' }: { color?: string }) {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
}
function IconClipboard({ color = '#ccc' }: { color?: string }) {
  return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
}

type Props = { isAdmin: boolean; backUrl: string }

export default function RelatorioVisitasContent({ isAdmin, backUrl }: Props) {
  const supabase = createClient()
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [filtros, setFiltros] = useState<Filtros>(() => defaultFiltros('este-mes'))
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function init() {
      const [{ data: clis }, { data: funcs }] = await Promise.all([
        supabase.from('clientes').select('id, nome').order('nome'),
        isAdmin
          ? supabase.from('profiles').select('id, nome_completo').eq('role', 'colaborador').order('nome_completo')
          : Promise.resolve({ data: [] as Funcionario[] }),
      ])
      setClientes(clis ?? [])
      setFuncionarios(funcs ?? [])
    }
    init()
  }, [])

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      let query = supabase
        .from('visitas')
        .select('id, data_visita, hora_visita, status, motivo_visita, cliente:clientes(id, nome, nome_fazenda, cidade, estado), funcionario:profiles(nome_completo)')
        .gte('data_visita', filtros.dataInicio)
        .lte('data_visita', filtros.dataFim)
        .order('data_visita', { ascending: false })

      if (filtros.clienteId) query = query.eq('cliente_id', filtros.clienteId)
      if (isAdmin && filtros.funcionarioId) query = query.eq('funcionario_id', filtros.funcionarioId)

      const { data } = await query
      setVisitas((data as unknown as Visita[]) ?? [])
      setCarregando(false)
    }
    carregar()
  }, [filtros.dataInicio, filtros.dataFim, filtros.clienteId, filtros.funcionarioId])

  const visitasFiltradas = visitas.filter(v =>
    filtroStatus === 'todos' || v.status === filtroStatus
  )

  return (
    <>
      <style>{`
        .rvp-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.2rem;flex-wrap:wrap;gap:.8rem}
        .rvp-title-area{display:flex;align-items:center;gap:.7rem}
        .rvp-back{display:inline-flex;align-items:center;gap:.35rem;color:#E67E22;font-size:.82rem;font-weight:700;text-decoration:none;background:none;border:none;cursor:pointer;font-family:'Comfortaa',sans-serif;padding:0}
        .rvp-title{font-size:1.2rem;font-weight:700;color:#162a1e}
        .rvp-sep{color:#ccc}
        .status-filtros{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem}
        .rvp-btn{display:inline-flex;align-items:center;gap:.35rem;padding:.45rem .95rem;border-radius:20px;border:1.5px solid #eae5de;font-family:'Comfortaa',sans-serif;font-size:.75rem;font-weight:700;cursor:pointer;background:#fff;color:#888;transition:all .2s}
        .rvp-btn.ativo{color:#fff}
        .rvp-lista{display:flex;flex-direction:column;gap:.7rem}
        .rvp-card{background:#fff;border-radius:12px;padding:1rem 1.2rem;box-shadow:0 2px 6px rgba(0,0,0,.04);display:flex;align-items:center;gap:1rem;text-decoration:none;transition:box-shadow .2s;border-left:4px solid}
        .rvp-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.1)}
        .rvp-data-box{text-align:center;background:#f0ede8;border-radius:8px;padding:.4rem .7rem;min-width:44px;flex-shrink:0}
        .rvp-dia{font-size:1.2rem;font-weight:900;color:#162a1e;line-height:1}
        .rvp-mes{font-size:.62rem;font-weight:700;color:#aaa;text-transform:uppercase}
        .rvp-info{flex:1;min-width:0}
        .rvp-cliente{font-size:.92rem;font-weight:700;color:#162a1e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .rvp-fazenda{display:flex;align-items:center;gap:.3rem;font-size:.75rem;color:#E67E22;font-weight:700;margin:.15rem 0}
        .rvp-func{display:flex;align-items:center;gap:.3rem;font-size:.72rem;color:#888;margin-top:.1rem}
        .rvp-motivo{display:flex;align-items:center;gap:.3rem;font-size:.72rem;color:#888;margin-top:.1rem}
        .rvp-actions{display:flex;flex-direction:column;align-items:flex-end;gap:.4rem;flex-shrink:0}
        .rvp-status{font-size:.7rem;font-weight:700;padding:.2rem .6rem;border-radius:20px;color:#fff;white-space:nowrap}
        .rvp-pdf{display:inline-flex;align-items:center;gap:.35rem;font-size:.75rem;font-weight:700;color:#E67E22;background:#fdf3e9;border:1.5px solid #f5d9bd;border-radius:8px;padding:.35rem .8rem;white-space:nowrap;transition:background .15s}
        .rvp-pdf:hover{background:#fbe7d3}
        .rvp-vazio{text-align:center;padding:3rem 1rem;color:#aaa}
        .rvp-vazio-icon{display:flex;justify-content:center;margin-bottom:.8rem}
        .rvp-contador{font-size:.78rem;color:#aaa;margin-bottom:.8rem}
        @media(max-width:600px){.rvp-card{flex-wrap:wrap}}
      `}</style>

      <div className="rvp-header">
        <div className="rvp-title-area">
          <Link href={backUrl} className="rvp-back"><IconArrowLeft /> Relatórios</Link>
          <span className="rvp-sep">/</span>
          <div className="rvp-title">Visitas</div>
        </div>
      </div>

      <FiltrosPainel
        value={filtros}
        onChange={setFiltros}
        clientes={clientes}
        showFuncionario={isAdmin}
        funcionarios={funcionarios}
      />

      <div className="status-filtros">
        {(['todos', 'agendada', 'realizada', 'cancelada'] as const).map(s => (
          <button
            key={s}
            className={`rvp-btn ${filtroStatus === s ? 'ativo' : ''}`}
            style={filtroStatus === s ? { background: s === 'todos' ? '#162a1e' : statusCor[s], borderColor: s === 'todos' ? '#162a1e' : statusCor[s] } : {}}
            onClick={() => setFiltroStatus(s)}
          >
            {s === 'todos' ? 'Todas' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {!carregando && (
        <div className="rvp-contador">
          {visitasFiltradas.length} visita{visitasFiltradas.length !== 1 ? 's' : ''} encontrada{visitasFiltradas.length !== 1 ? 's' : ''}
        </div>
      )}

      {carregando ? (
        <div className="rvp-vazio"><div>Carregando...</div></div>
      ) : visitasFiltradas.length === 0 ? (
        <div className="rvp-vazio">
          <div className="rvp-vazio-icon"><IconClipboard /></div>
          <div>Nenhuma visita encontrada no período.</div>
        </div>
      ) : (
        <div className="rvp-lista">
          {visitasFiltradas.map(v => {
            const d = new Date(v.data_visita + 'T12:00:00')
            return (
              <div key={v.id} className="rvp-card" style={{ borderLeftColor: statusCor[v.status] || '#ccc' }}>
                <div className="rvp-data-box">
                  <div className="rvp-dia">{String(d.getDate()).padStart(2, '0')}</div>
                  <div className="rvp-mes">{d.toLocaleDateString('pt-BR', { month: 'short' })}</div>
                </div>
                <div className="rvp-info">
                  <div className="rvp-cliente">{v.cliente?.nome}</div>
                  {v.cliente?.nome_fazenda && <div className="rvp-fazenda"><IconSprout color="#E67E22" />{v.cliente.nome_fazenda}</div>}
                  {isAdmin && v.funcionario?.nome_completo && (
                    <div className="rvp-func"><IconUser />{v.funcionario.nome_completo}</div>
                  )}
                  {v.motivo_visita && <div className="rvp-motivo">{v.motivo_visita}</div>}
                </div>
                <div className="rvp-actions">
                  <div className="rvp-status" style={{ background: statusCor[v.status] || '#aaa' }}>
                    {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                  </div>
                  <Link href={`/dashboard/relatorios/visitas/${v.id}`} className="rvp-pdf">
                    <IconPdf /> Ver PDF
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

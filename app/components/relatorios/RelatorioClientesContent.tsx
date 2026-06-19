'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import FiltrosPainel from '@/app/components/FiltrosPainel'
import { type Filtros, defaultFiltros } from '@/lib/dateUtils'

type Cliente = {
  id: string
  nome: string
  cidade: string | null
  estado: string | null
  nome_fazenda: string | null
  cultura_principal: string | null
  status: string | null
}

type VisitaStat = {
  cliente_id: string
  total: number
  realizadas: number
  ultima_visita: string | null
  ultimo_status: string | null
}

type Funcionario = { id: string; nome_completo: string }

const statusCor: Record<string, string> = {
  agendada: '#E67E22',
  realizada: '#27ae60',
  cancelada: '#e74c3c',
}

function IconArrowLeft() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
}
function IconArrow() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
}
function IconPin({ color = '#aaa' }: { color?: string }) {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
}
function IconSprout({ color = '#E67E22' }: { color?: string }) {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M7 20h10"/><path d="M10 20c0-4 .5-8 2-10"/><path d="M14 20c0-4-.5-8-2-10"/><path d="M5 5c1.5 0 3 1 3.5 3C7 8 5 7.5 4 6c-.5-1 0-1 1-1z"/><path d="M19 8c-1.5 0-3 .5-4 2 1.5 1 3 1 4 0 1-.5 1-1.5 0-2z"/></svg>
}
function IconUsers({ color = '#ccc' }: { color?: string }) {
  return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}

type Props = {
  isAdmin: boolean
  backUrl: string
  clientesIniciais?: Cliente[]
  funcionariosIniciais?: Funcionario[]
}

export default function RelatorioClientesContent({ isAdmin, backUrl, clientesIniciais, funcionariosIniciais }: Props) {
  const supabase = createClient()
  const [clientes, setClientes] = useState<Cliente[]>(() => clientesIniciais ?? [])
  const [stats, setStats] = useState<Map<string, VisitaStat>>(new Map())
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>(() => funcionariosIniciais ?? [])
  const [filtros, setFiltros] = useState<Filtros>(() => defaultFiltros('este-mes'))
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (clientesIniciais !== undefined) return
    async function init() {
      const [{ data: clis }, { data: funcs }] = await Promise.all([
        supabase.from('clientes').select('id, nome, cidade, estado, nome_fazenda, cultura_principal, status').order('nome'),
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
    async function carregarStats() {
      setCarregando(true)
      let query = supabase
        .from('visitas')
        .select('cliente_id, status, data_visita')
        .gte('data_visita', filtros.dataInicio)
        .lte('data_visita', filtros.dataFim)

      if (isAdmin && filtros.funcionarioId) query = query.eq('funcionario_id', filtros.funcionarioId)

      const { data: visitas } = await query

      const map = new Map<string, VisitaStat>()
      ;(visitas ?? []).forEach((v: any) => {
        if (!map.has(v.cliente_id)) {
          map.set(v.cliente_id, { cliente_id: v.cliente_id, total: 0, realizadas: 0, ultima_visita: null, ultimo_status: null })
        }
        const s = map.get(v.cliente_id)!
        s.total++
        if (v.status === 'realizada') s.realizadas++
        if (!s.ultima_visita || v.data_visita > s.ultima_visita) {
          s.ultima_visita = v.data_visita
          s.ultimo_status = v.status
        }
      })
      setStats(map)
      setCarregando(false)
    }
    carregarStats()
  }, [filtros.dataInicio, filtros.dataFim, filtros.funcionarioId])

  const clientesFiltrados = clientes.filter(c =>
    !busca || c.nome.toLowerCase().includes(busca.toLowerCase())
  )
  const clientesComVisitas = clientesFiltrados.filter(c => stats.has(c.id))
  const clientesSemVisitas = clientesFiltrados.filter(c => !stats.has(c.id))

  return (
    <>
      <style>{`
        .rcp-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.2rem;flex-wrap:wrap;gap:.8rem}
        .rcp-title-area{display:flex;align-items:center;gap:.7rem}
        .rcp-back{display:inline-flex;align-items:center;gap:.35rem;color:#E67E22;font-size:.82rem;font-weight:700;text-decoration:none;background:none;border:none;cursor:pointer;font-family:'Comfortaa',sans-serif;padding:0}
        .rcp-title{font-size:1.2rem;font-weight:700;color:#162a1e}
        .rcp-sep{color:#ccc}
        .rcp-busca{padding:.45rem .8rem;border:1.5px solid #eae5de;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.8rem;color:#162a1e;outline:none;width:220px;transition:border-color .15s}
        .rcp-busca:focus{border-color:#E67E22}
        .rcp-section-label{font-size:.7rem;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:.05em;margin:1rem 0 .5rem}
        .rcp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:.9rem;margin-bottom:1rem}
        .rcp-card{background:#fff;border-radius:12px;padding:1.1rem 1.2rem;box-shadow:0 2px 6px rgba(0,0,0,.04);text-decoration:none;display:flex;flex-direction:column;gap:.35rem;transition:box-shadow .2s;border-left:4px solid #162a1e}
        .rcp-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.1)}
        .rcp-card-nome{font-size:.95rem;font-weight:700;color:#162a1e}
        .rcp-card-meta{display:flex;align-items:center;gap:.35rem;font-size:.72rem;color:#888}
        .rcp-card-stats{display:flex;gap:.8rem;margin-top:.2rem}
        .rcp-stat{text-align:center}
        .rcp-stat-num{font-size:1.1rem;font-weight:900;color:#162a1e;line-height:1}
        .rcp-stat-label{font-size:.62rem;color:#aaa;font-weight:700;text-transform:uppercase}
        .rcp-ultima{display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:700;padding:.2rem .6rem;border-radius:20px;color:#fff;margin-top:.15rem}
        .rcp-card-link{display:inline-flex;align-items:center;gap:.35rem;font-size:.75rem;font-weight:700;color:#E67E22;margin-top:.5rem;align-self:flex-end}
        .rcp-card-sem{border-left-color:#eae5de}
        .rcp-card-sem .rcp-card-nome{color:#aaa}
        .rcp-vazio{text-align:center;padding:2.5rem 1rem;color:#aaa}
        .rcp-vazio-icon{display:flex;justify-content:center;margin-bottom:.8rem}
        .rcp-contador{font-size:.78rem;color:#aaa;margin-bottom:.5rem}
        @media(max-width:500px){.rcp-busca{width:100%}}
      `}</style>

      <div className="rcp-header">
        <div className="rcp-title-area">
          <Link href={backUrl} className="rcp-back"><IconArrowLeft /> Relatórios</Link>
          <span className="rcp-sep">/</span>
          <div className="rcp-title">Clientes</div>
        </div>
        <input
          className="rcp-busca"
          placeholder="Buscar cliente..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      <FiltrosPainel
        value={filtros}
        onChange={setFiltros}
        clientes={[]}
        showCliente={false}
        showFuncionario={isAdmin}
        funcionarios={funcionarios}
      />

      {carregando ? (
        <div className="rcp-vazio"><div>Carregando...</div></div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="rcp-vazio">
          <div className="rcp-vazio-icon"><IconUsers /></div>
          <div>Nenhum cliente encontrado.</div>
        </div>
      ) : (
        <>
          {clientesComVisitas.length > 0 && (
            <>
              <div className="rcp-section-label">
                Com visitas no período — {clientesComVisitas.length} produtor{clientesComVisitas.length !== 1 ? 'es' : ''}
              </div>
              <div className="rcp-grid">
                {clientesComVisitas.map(c => {
                  const s = stats.get(c.id)!
                  return (
                    <Link key={c.id} href={`/dashboard/relatorios/clientes/${c.id}`} className="rcp-card">
                      <div className="rcp-card-nome">{c.nome}</div>
                      {c.nome_fazenda && <div className="rcp-card-meta"><IconSprout />{c.nome_fazenda}</div>}
                      {c.cidade && <div className="rcp-card-meta"><IconPin />{c.cidade}/{c.estado}</div>}
                      <div className="rcp-card-stats">
                        <div className="rcp-stat">
                          <div className="rcp-stat-num">{s.total}</div>
                          <div className="rcp-stat-label">visitas</div>
                        </div>
                        <div className="rcp-stat">
                          <div className="rcp-stat-num">{s.realizadas}</div>
                          <div className="rcp-stat-label">realizadas</div>
                        </div>
                        {s.ultima_visita && (
                          <div className="rcp-stat">
                            <div className="rcp-stat-num" style={{ fontSize: '.8rem' }}>
                              {new Date(s.ultima_visita + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                            </div>
                            <div className="rcp-stat-label">última</div>
                          </div>
                        )}
                      </div>
                      {s.ultimo_status && (
                        <div className="rcp-ultima" style={{ background: statusCor[s.ultimo_status] || '#aaa' }}>
                          {s.ultimo_status.charAt(0).toUpperCase() + s.ultimo_status.slice(1)}
                        </div>
                      )}
                      <div className="rcp-card-link">Ver ficha <IconArrow /></div>
                    </Link>
                  )
                })}
              </div>
            </>
          )}

          {clientesSemVisitas.length > 0 && (
            <>
              <div className="rcp-section-label">
                {filtros.funcionarioId
                  ? `Não visitados por este consultor — ${clientesSemVisitas.length} produtor${clientesSemVisitas.length !== 1 ? 'es' : ''}`
                  : `Sem visitas no período — ${clientesSemVisitas.length} produtor${clientesSemVisitas.length !== 1 ? 'es' : ''}`}
              </div>
              <div className="rcp-grid">
                {clientesSemVisitas.map(c => (
                  <Link key={c.id} href={`/dashboard/relatorios/clientes/${c.id}`} className="rcp-card rcp-card-sem">
                    <div className="rcp-card-nome">{c.nome}</div>
                    {c.nome_fazenda && <div className="rcp-card-meta"><IconSprout color="#ccc" />{c.nome_fazenda}</div>}
                    {c.cidade && <div className="rcp-card-meta"><IconPin color="#ccc" />{c.cidade}/{c.estado}</div>}
                    <div className="rcp-card-link">Ver ficha <IconArrow /></div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}

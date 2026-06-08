'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Visita = {
  id: string
  data_visita: string
  hora_visita: string | null
  status: string
  motivo_visita: string | null
  cliente: { id: string; nome: string; nome_fazenda: string; cidade: string; estado: string }
}

const statusCor: Record<string, string> = {
  agendada: '#E67E22',
  realizada: '#27ae60',
  cancelada: '#e74c3c',
}
const statusEmoji: Record<string, string> = {
  agendada: '📅',
  realizada: '✅',
  cancelada: '❌',
}

export default function VisitasPage() {
  const supabase = createClient()
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase
        .from('visitas')
        .select('id, data_visita, hora_visita, status, motivo_visita, cliente:clientes(id, nome, nome_fazenda, cidade, estado)')
        .order('data_visita', { ascending: false })
      setVisitas((data as unknown as Visita[]) || [])
      setCarregando(false)
    }
    carregar()
  }, [])

  const visitasFiltradas = visitas.filter(v => {
    const matchStatus = filtroStatus === 'todos' || v.status === filtroStatus
    const matchBusca = busca === '' ||
      v.cliente?.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      v.cliente?.nome_fazenda?.toLowerCase().includes(busca.toLowerCase())
    return matchStatus && matchBusca
  })

  return (
    <>
      <style>{`
        .page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.2rem;flex-wrap:wrap;gap:1rem}
        .page-title{font-size:1.3rem;font-weight:700;color:#162a1e}
        .btn-nova{display:inline-flex;align-items:center;gap:.5rem;background:#E67E22;color:#fff;padding:.7rem 1.4rem;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.85rem;font-weight:700;text-decoration:none;transition:background .2s}
        .btn-nova:hover{background:#d35400}
        .filtros{display:flex;gap:.6rem;margin-bottom:1rem;flex-wrap:wrap;align-items:center}
        .busca{flex:1;min-width:180px;padding:.6rem 1rem;border:1.5px solid #eae5de;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.85rem;color:#162a1e;background:#fff;outline:none;transition:border-color .2s}
        .busca:focus{border-color:#E67E22}
        .filtro-btn{padding:.5rem 1rem;border-radius:20px;border:1.5px solid #eae5de;font-family:'Comfortaa',sans-serif;font-size:.75rem;font-weight:700;cursor:pointer;background:#fff;color:#888;transition:all .2s}
        .filtro-btn.ativo{color:#fff}
        .visitas-lista{display:flex;flex-direction:column;gap:.7rem}
        .visita-card{background:#fff;border-radius:12px;padding:1rem 1.2rem;box-shadow:0 2px 6px rgba(0,0,0,.04);display:flex;align-items:center;gap:1rem;text-decoration:none;transition:box-shadow .2s;border-left:4px solid}
        .visita-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.1)}
        .visita-data-box{text-align:center;background:#f0ede8;border-radius:8px;padding:.4rem .7rem;min-width:44px;flex-shrink:0}
        .dia{font-size:1.2rem;font-weight:900;color:#162a1e;line-height:1}
        .mes{font-size:.62rem;font-weight:700;color:#aaa;text-transform:uppercase}
        .visita-info{flex:1;min-width:0}
        .visita-cliente{font-size:.92rem;font-weight:700;color:#162a1e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .visita-fazenda{font-size:.75rem;color:#E67E22;font-weight:700;margin:.1rem 0}
        .visita-loc{font-size:.72rem;color:#aaa}
        .visita-motivo{font-size:.72rem;color:#888;margin-top:.2rem}
        .status-badge{display:inline-flex;align-items:center;gap:.3rem;font-size:.72rem;font-weight:700;padding:.25rem .7rem;border-radius:20px;color:#fff;white-space:nowrap;flex-shrink:0}
        .vazio{text-align:center;padding:3rem 1rem;color:#aaa}
        .vazio-icon{font-size:2.5rem;margin-bottom:.8rem}
        .vazio-txt{font-size:.9rem}
        .contador{font-size:.78rem;color:#aaa;margin-bottom:.8rem}
        @media(max-width:600px){.visita-card{flex-wrap:wrap}}
      `}</style>

      <div className="page-header">
        <div className="page-title">📋 Visitas</div>
        <Link href="/dashboard/visitas/novo" className="btn-nova">+ Nova Visita</Link>
      </div>

      <div className="filtros">
        <input
          className="busca"
          placeholder="🔍 Buscar por cliente ou fazenda..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        {['todos','agendada','realizada','cancelada'].map(s => (
          <button
            key={s}
            className={`filtro-btn ${filtroStatus === s ? 'ativo' : ''}`}
            style={filtroStatus === s ? { background: s === 'todos' ? '#162a1e' : statusCor[s], borderColor: s === 'todos' ? '#162a1e' : statusCor[s] } : {}}
            onClick={() => setFiltroStatus(s)}
          >
            {s === 'todos' ? 'Todas' : `${statusEmoji[s]} ${s.charAt(0).toUpperCase() + s.slice(1)}`}
          </button>
        ))}
      </div>

      {!carregando && (
        <div className="contador">
          {visitasFiltradas.length} visita{visitasFiltradas.length !== 1 ? 's' : ''} encontrada{visitasFiltradas.length !== 1 ? 's' : ''}
        </div>
      )}

      {carregando ? (
        <div className="vazio"><div className="vazio-icon">⏳</div><div className="vazio-txt">Carregando...</div></div>
      ) : visitasFiltradas.length === 0 ? (
        <div className="vazio">
          <div className="vazio-icon">📋</div>
          <div className="vazio-txt">Nenhuma visita encontrada.</div>
        </div>
      ) : (
        <div className="visitas-lista">
          {visitasFiltradas.map(v => {
            const d = new Date(v.data_visita + 'T12:00:00')
            return (
              <Link
                key={v.id}
                href={`/dashboard/visitas/${v.id}`}
                className="visita-card"
                style={{ borderLeftColor: statusCor[v.status] || '#ccc' }}
              >
                <div className="visita-data-box">
                  <div className="dia">{String(d.getDate()).padStart(2,'0')}</div>
                  <div className="mes">{d.toLocaleDateString('pt-BR',{month:'short'})}</div>
                </div>
                <div className="visita-info">
                  <div className="visita-cliente">{v.cliente?.nome}</div>
                  {v.cliente?.nome_fazenda && <div className="visita-fazenda">🌾 {v.cliente.nome_fazenda}</div>}
                  {v.cliente?.cidade && <div className="visita-loc">📍 {v.cliente.cidade}/{v.cliente.estado}</div>}
                  {v.motivo_visita && <div className="visita-motivo">🎯 {v.motivo_visita}</div>}
                </div>
                <div className="status-badge" style={{ background: statusCor[v.status] || '#aaa' }}>
                  {statusEmoji[v.status]} {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
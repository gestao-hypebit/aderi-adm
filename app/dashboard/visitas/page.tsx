'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Visita = {
  id: string
  data_visita: string
  hora_visita: string
  status: string
  descricao: string
  cliente: { nome: string; nome_fazenda: string; cidade: string }
}

export default function VisitasPage() {
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [filtro, setFiltro] = useState('todas')
  const [carregando, setCarregando] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase
        .from('visitas')
        .select('*, cliente:clientes(nome, nome_fazenda, cidade)')
        .order('data_visita', { ascending: false })
      setVisitas(data || [])
      setCarregando(false)
    }
    carregar()
  }, [])

  const filtradas = visitas.filter(v => filtro === 'todas' || v.status === filtro)

  const statusCor: Record<string, string> = {
    agendada: '#E67E22',
    realizada: '#27ae60',
    cancelada: '#e74c3c'
  }

  const statusIcon: Record<string, string> = {
    agendada: '📅',
    realizada: '✅',
    cancelada: '❌'
  }

  return (
    <>
      <style>{`
        .page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:.5rem}
        .page-title{font-size:1.3rem;font-weight:700;color:#162a1e}
        .page-sub{color:#aaa;font-size:.8rem;margin-top:.2rem}
        .btn-novo{background:#E67E22;color:#fff;border:none;padding:.7rem 1.4rem;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.85rem;font-weight:700;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:.5rem}
        .btn-novo:hover{background:#d35400}
        .filtros{display:flex;gap:.5rem;margin-bottom:1.2rem;flex-wrap:wrap}
        .filtro-btn{padding:.4rem 1rem;border-radius:20px;border:1.5px solid #eae5de;background:#fff;font-family:'Comfortaa',sans-serif;font-size:.78rem;font-weight:700;cursor:pointer;color:#888;transition:all .2s}
        .filtro-btn.ativo{border-color:#162a1e;background:#162a1e;color:#fff}
        .lista{display:flex;flex-direction:column;gap:.7rem}
        .visita-card{background:#fff;border-radius:12px;padding:1.2rem 1.4rem;box-shadow:0 2px 8px rgba(0,0,0,.05);display:flex;align-items:center;gap:1.2rem;text-decoration:none;border-left:4px solid;transition:all .2s}
        .visita-card:hover{transform:translateX(4px);box-shadow:0 4px 16px rgba(0,0,0,.08)}
        .visita-data-box{text-align:center;min-width:48px}
        .visita-dia{font-size:1.4rem;font-weight:900;color:#162a1e;line-height:1}
        .visita-mes{font-size:.68rem;font-weight:700;color:#aaa;text-transform:uppercase}
        .visita-info{flex:1}
        .visita-cliente{font-weight:700;font-size:.9rem;color:#162a1e}
        .visita-fazenda{font-size:.78rem;color:#E67E22;font-weight:700;margin:.1rem 0}
        .visita-desc{font-size:.8rem;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:400px}
        .status-badge{font-size:.7rem;font-weight:700;padding:.25rem .75rem;border-radius:20px;color:#fff;white-space:nowrap}
        .vazio{text-align:center;padding:3rem;color:#aaa;background:#fff;border-radius:12px}
        .contador{font-size:.78rem;color:#aaa;margin-bottom:.8rem}
      `}</style>

      <div className="page-header">
        <div>
          <h1 className="page-title">📋 Visitas</h1>
          <p className="page-sub">Gerencie as visitas aos produtores</p>
        </div>
        <Link href="/dashboard/visitas/nova" className="btn-novo">+ Nova Visita</Link>
      </div>

      <div className="filtros">
        {['todas','agendada','realizada','cancelada'].map(f => (
          <button key={f} className={`filtro-btn ${filtro === f ? 'ativo' : ''}`} onClick={() => setFiltro(f)}>
            {f === 'todas' ? 'Todas' : `${statusIcon[f]} ${f.charAt(0).toUpperCase() + f.slice(1)}s`}
          </button>
        ))}
      </div>

      {carregando ? (
        <div className="vazio">Carregando visitas...</div>
      ) : filtradas.length === 0 ? (
        <div className="vazio">
          Nenhuma visita {filtro !== 'todas' ? filtro : ''} encontrada.<br/>
          <Link href="/dashboard/visitas/nova" className="btn-novo" style={{marginTop:'1rem',display:'inline-flex'}}>
            + Registrar visita
          </Link>
        </div>
      ) : (
        <>
          <p className="contador">{filtradas.length} visita{filtradas.length !== 1 ? 's' : ''}</p>
          <div className="lista">
            {filtradas.map(v => {
              const data = new Date(v.data_visita + 'T12:00:00')
              return (
                <Link key={v.id} href={`/dashboard/visitas/${v.id}`} className="visita-card" style={{borderLeftColor: statusCor[v.status]}}>
                  <div className="visita-data-box">
                    <div className="visita-dia">{String(data.getDate()).padStart(2,'0')}</div>
                    <div className="visita-mes">{data.toLocaleDateString('pt-BR',{month:'short'})}</div>
                  </div>
                  <div className="visita-info">
                    <div className="visita-cliente">{v.cliente?.nome}</div>
                    {v.cliente?.nome_fazenda && <div className="visita-fazenda">🌾 {v.cliente.nome_fazenda}</div>}
                    {v.descricao && <div className="visita-desc">{v.descricao}</div>}
                  </div>
                  <span className="status-badge" style={{background: statusCor[v.status]}}>
                    {statusIcon[v.status]} {v.status}
                  </span>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}
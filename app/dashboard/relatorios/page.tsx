'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Visita = {
  id: string
  data_visita: string
  descricao: string
  status: string
  cliente: { nome: string; nome_fazenda: string; cidade: string }
}

export default function RelatoriosPage() {
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase
        .from('visitas')
        .select('*, cliente:clientes(nome, nome_fazenda, cidade)')
        .eq('status', 'realizada')
        .order('data_visita', { ascending: false })
      setVisitas(data || [])
      setCarregando(false)
    }
    carregar()
  }, [])

  const filtradas = visitas.filter(v =>
    v.cliente?.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    v.cliente?.nome_fazenda?.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <>
      <style>{`
        .page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:.5rem}
        .page-title{font-size:1.3rem;font-weight:700;color:#162a1e}
        .page-sub{color:#aaa;font-size:.8rem;margin-top:.2rem}
        .busca{width:100%;max-width:400px;padding:.7rem 1rem;border:1.5px solid #eae5de;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.85rem;color:#162a1e;outline:none;background:#fff;margin-bottom:1.2rem}
        .busca:focus{border-color:#E67E22}
        .lista{display:flex;flex-direction:column;gap:.7rem}
        .rel-card{background:#fff;border-radius:12px;padding:1.2rem 1.4rem;box-shadow:0 2px 8px rgba(0,0,0,.05);display:flex;align-items:center;gap:1.2rem;text-decoration:none;border-left:4px solid #27ae60;transition:all .2s}
        .rel-card:hover{transform:translateX(4px);box-shadow:0 4px 16px rgba(0,0,0,.08)}
        .rel-data-box{text-align:center;background:#f0fdf4;border-radius:8px;padding:.5rem .8rem;min-width:52px}
        .rel-dia{font-size:1.3rem;font-weight:900;color:#162a1e;line-height:1}
        .rel-mes{font-size:.65rem;font-weight:700;color:#aaa;text-transform:uppercase}
        .rel-info{flex:1}
        .rel-cliente{font-weight:700;font-size:.9rem;color:#162a1e}
        .rel-fazenda{color:#E67E22;font-size:.78rem;font-weight:700;margin:.1rem 0}
        .rel-desc{font-size:.78rem;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:400px}
        .btn-pdf{display:inline-flex;align-items:center;gap:.4rem;background:#162a1e;color:#fff;padding:.5rem 1rem;border-radius:8px;font-size:.75rem;font-weight:700;text-decoration:none;white-space:nowrap;transition:background .2s}
        .btn-pdf:hover{background:#0d1f14}
        .vazio{text-align:center;padding:3rem;color:#aaa;background:#fff;border-radius:12px}
        .contador{font-size:.78rem;color:#aaa;margin-bottom:.8rem}
        .info-box{background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:.8rem 1rem;margin-bottom:1.2rem;font-size:.82rem;color:#15803d;display:flex;align-items:center;gap:.5rem}
      `}</style>

      <div className="page-header">
        <div>
          <h1 className="page-title">📊 Relatórios</h1>
          <p className="page-sub">Gere relatórios PDF das visitas realizadas</p>
        </div>
      </div>

      <div className="info-box">
        ✅ Apenas visitas com status <strong>Realizada</strong> aparecem aqui para gerar relatório.
      </div>

      <input
        className="busca"
        placeholder="🔍 Buscar por cliente ou fazenda..."
        value={busca}
        onChange={e => setBusca(e.target.value)}
      />

      {carregando ? (
        <div className="vazio">Carregando...</div>
      ) : filtradas.length === 0 ? (
        <div className="vazio">
          Nenhuma visita realizada encontrada.<br/>
          <Link href="/dashboard/visitas" style={{color:'#E67E22',fontWeight:700,textDecoration:'none'}}>
            → Ir para visitas
          </Link>
        </div>
      ) : (
        <>
          <p className="contador">{filtradas.length} visita{filtradas.length !== 1 ? 's' : ''} realizada{filtradas.length !== 1 ? 's' : ''}</p>
          <div className="lista">
            {filtradas.map(v => {
              const d = new Date(v.data_visita + 'T12:00:00')
              return (
                <div key={v.id} className="rel-card">
                  <div className="rel-data-box">
                    <div className="rel-dia">{String(d.getDate()).padStart(2,'0')}</div>
                    <div className="rel-mes">{d.toLocaleDateString('pt-BR',{month:'short'})}</div>
                    <div className="rel-mes">{d.getFullYear()}</div>
                  </div>
                  <div className="rel-info">
                    <div className="rel-cliente">{v.cliente?.nome}</div>
                    {v.cliente?.nome_fazenda && <div className="rel-fazenda">🌾 {v.cliente.nome_fazenda}</div>}
                    {v.descricao && <div className="rel-desc">{v.descricao}</div>}
                  </div>
                  <Link href={`/dashboard/relatorios/${v.id}`} className="btn-pdf">
                    🖨️ Gerar PDF
                  </Link>
                </div>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}
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

function IconSearch({ color = '#aaa' }: { color?: string }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
}
function IconSprout({ color = 'currentColor', size = 12 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M7 20h10"/><path d="M10 20c0-4 .5-8 2-10"/><path d="M14 20c0-4-.5-8-2-10"/><path d="M5 5c1.5 0 3 1 3.5 3C7 8 5 7.5 4 6c-.5-1 0-1 1-1z"/><path d="M19 8c-1.5 0-3 .5-4 2 1.5 1 3 1 4 0 1-.5 1-1.5 0-2z"/></svg>
}
function IconCheck({ color = 'currentColor', size = 14 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
}
function IconPrinter({ color = 'currentColor' }: { color?: string }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
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
        .busca-wrap{margin-bottom:1.2rem;position:relative;max-width:400px}
        .busca-wrap svg{position:absolute;left:1rem;top:50%;transform:translateY(-50%);pointer-events:none}
        .busca{width:100%;padding:.7rem 1rem .7rem 2.4rem;border:1.5px solid #eae5de;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.85rem;color:#162a1e;outline:none;background:#fff;box-sizing:border-box}
        .busca:focus{border-color:#E67E22}
        .lista{display:flex;flex-direction:column;gap:.7rem}
        .rel-card{background:#fff;border-radius:12px;padding:1.2rem 1.4rem;box-shadow:0 2px 8px rgba(0,0,0,.05);display:flex;align-items:center;gap:1.2rem;text-decoration:none;border-left:4px solid #27ae60;transition:all .2s}
        .rel-card:hover{transform:translateX(4px);box-shadow:0 4px 16px rgba(0,0,0,.08)}
        .rel-data-box{text-align:center;background:#f0fdf4;border-radius:8px;padding:.5rem .8rem;min-width:52px}
        .rel-dia{font-size:1.3rem;font-weight:900;color:#162a1e;line-height:1}
        .rel-mes{font-size:.65rem;font-weight:700;color:#aaa;text-transform:uppercase}
        .rel-info{flex:1}
        .rel-cliente{font-weight:700;font-size:.9rem;color:#162a1e}
        .rel-fazenda{display:flex;align-items:center;gap:.35rem;color:#E67E22;font-size:.78rem;font-weight:700;margin:.15rem 0}
        .rel-desc{font-size:.78rem;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:400px}
        .btn-pdf{display:inline-flex;align-items:center;gap:.4rem;background:#162a1e;color:#fff;padding:.5rem 1rem;border-radius:8px;font-size:.75rem;font-weight:700;text-decoration:none;white-space:nowrap;transition:background .2s}
        .btn-pdf:hover{background:#0d1f14}
        .vazio{text-align:center;padding:3rem;color:#aaa;background:#fff;border-radius:12px}
        .contador{font-size:.78rem;color:#aaa;margin-bottom:.8rem}
        .info-box{display:flex;align-items:center;gap:.5rem;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:.8rem 1rem;margin-bottom:1.2rem;font-size:.82rem;color:#15803d}
      `}</style>

      <div className="page-header">
        <div>
          <h1 className="page-title">Relatórios</h1>
          <p className="page-sub">Gere relatórios PDF das visitas realizadas</p>
        </div>
      </div>

      <div className="info-box">
        <IconCheck color="#15803d" /> Apenas visitas com status <strong>Realizada</strong> aparecem aqui para gerar relatório.
      </div>

      <div className="busca-wrap">
        <IconSearch />
        <input
          className="busca"
          placeholder="Buscar por cliente ou fazenda..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

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
                    {v.cliente?.nome_fazenda && <div className="rel-fazenda"><IconSprout color="#E67E22" />{v.cliente.nome_fazenda}</div>}
                    {v.descricao && <div className="rel-desc">{v.descricao}</div>}
                  </div>
                  <Link href={`/dashboard/relatorios/${v.id}`} className="btn-pdf">
                    <IconPrinter /> Gerar PDF
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
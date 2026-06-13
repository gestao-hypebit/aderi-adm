'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Cliente = {
  id: string
  nome: string
  cidade: string
  estado: string
  nome_fazenda: string
  cultura_principal: string
  telefone: string
  created_at: string
}

function IconSearch({ color = '#aaa' }: { color?: string }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
}
function IconSprout({ color = 'currentColor', size = 12 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M7 20h10"/><path d="M10 20c0-4 .5-8 2-10"/><path d="M14 20c0-4-.5-8-2-10"/><path d="M5 5c1.5 0 3 1 3.5 3C7 8 5 7.5 4 6c-.5-1 0-1 1-1z"/><path d="M19 8c-1.5 0-3 .5-4 2 1.5 1 3 1 4 0 1-.5 1-1.5 0-2z"/></svg>
}
function IconPin({ color = '#666', size = 12 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
}
function IconLeaf({ color = '#666', size = 12 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
}
function IconPhone({ color = '#666', size = 12 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false })
      setClientes(data || [])
      setCarregando(false)
    }
    carregar()
  }, [])

  const filtrados = clientes.filter(c =>
    c.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    c.nome_fazenda?.toLowerCase().includes(busca.toLowerCase()) ||
    c.cidade?.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <>
      <style>{`
        .page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:gap}
        .page-title{font-size:1.3rem;font-weight:700;color:#162a1e}
        .page-sub{color:#aaa;font-size:.8rem;margin-top:.2rem}
        .btn-novo{background:#E67E22;color:#fff;border:none;padding:.7rem 1.4rem;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.85rem;font-weight:700;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:.5rem;transition:background .2s}
        .btn-novo:hover{background:#d35400}
        .busca-wrap{margin-bottom:1.2rem;position:relative;max-width:400px}
        .busca-wrap svg{position:absolute;left:1rem;top:50%;transform:translateY(-50%);pointer-events:none}
        .busca{width:100%;padding:.7rem 1rem .7rem 2.4rem;border:1.5px solid #eae5de;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.85rem;color:#162a1e;outline:none;background:#fff;box-sizing:border-box}
        .busca:focus{border-color:#E67E22}
        .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem}
        .card-cliente{background:#fff;border-radius:12px;padding:1.2rem;box-shadow:0 2px 8px rgba(0,0,0,.05);border:1.5px solid #eae5de;cursor:pointer;transition:all .2s;text-decoration:none;display:block}
        .card-cliente:hover{border-color:#E67E22;transform:translateY(-2px);box-shadow:0 4px 16px rgba(0,0,0,.08)}
        .card-avatar{width:42px;height:42px;border-radius:10px;background:#162a1e;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1.1rem;margin-bottom:.8rem}
        .card-nome{font-weight:700;font-size:.95rem;color:#162a1e;margin-bottom:.2rem}
        .card-fazenda{display:flex;align-items:center;gap:.35rem;color:#E67E22;font-size:.78rem;font-weight:700;margin-bottom:.6rem}
        .card-info{display:flex;flex-wrap:wrap;gap:.4rem}
        .tag{display:inline-flex;align-items:center;gap:.3rem;background:#f0ede8;color:#666;font-size:.72rem;padding:.2rem .6rem;border-radius:20px;font-weight:700}
        .vazio{text-align:center;padding:3rem;color:#aaa;font-size:.9rem}
        .loading{text-align:center;padding:3rem;color:#aaa}
        .contador{font-size:.78rem;color:#aaa;margin-bottom:1rem}
      `}</style>

      <div className="page-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-sub">Gerencie seus produtores e fazendas</p>
        </div>
        <Link href="/dashboard/clientes/novo" className="btn-novo">
          + Novo Cliente
        </Link>
      </div>

      <div className="busca-wrap">
        <IconSearch />
        <input
          className="busca"
          placeholder="Buscar por nome, fazenda ou cidade..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {carregando ? (
        <div className="loading">Carregando clientes...</div>
      ) : filtrados.length === 0 ? (
        <div className="vazio">
          {busca ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}<br/>
          <Link href="/dashboard/clientes/novo" className="btn-novo" style={{marginTop:'1rem',display:'inline-flex'}}>
            + Cadastrar primeiro cliente
          </Link>
        </div>
      ) : (
        <>
          <p className="contador">{filtrados.length} cliente{filtrados.length !== 1 ? 's' : ''} encontrado{filtrados.length !== 1 ? 's' : ''}</p>
          <div className="grid">
            {filtrados.map(c => (
              <Link key={c.id} href={`/dashboard/clientes/${c.id}`} className="card-cliente">
                <div className="card-avatar">{c.nome?.charAt(0).toUpperCase()}</div>
                <div className="card-nome">{c.nome}</div>
                {c.nome_fazenda && <div className="card-fazenda"><IconSprout color="#E67E22" />{c.nome_fazenda}</div>}
                <div className="card-info">
                  {c.cidade && <span className="tag"><IconPin />{c.cidade}/{c.estado}</span>}
                  {c.cultura_principal && <span className="tag"><IconLeaf />{c.cultura_principal}</span>}
                  {c.telefone && <span className="tag"><IconPhone />{c.telefone}</span>}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  )
}
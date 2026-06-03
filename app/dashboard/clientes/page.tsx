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
        .busca-wrap{margin-bottom:1.2rem}
        .busca{width:100%;max-width:400px;padding:.7rem 1rem;border:1.5px solid #eae5de;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.85rem;color:#162a1e;outline:none;background:#fff}
        .busca:focus{border-color:#E67E22}
        .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem}
        .card-cliente{background:#fff;border-radius:12px;padding:1.2rem;box-shadow:0 2px 8px rgba(0,0,0,.05);border:1.5px solid #eae5de;cursor:pointer;transition:all .2s;text-decoration:none;display:block}
        .card-cliente:hover{border-color:#E67E22;transform:translateY(-2px);box-shadow:0 4px 16px rgba(0,0,0,.08)}
        .card-avatar{width:42px;height:42px;border-radius:10px;background:#162a1e;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1.1rem;margin-bottom:.8rem}
        .card-nome{font-weight:700;font-size:.95rem;color:#162a1e;margin-bottom:.2rem}
        .card-fazenda{color:#E67E22;font-size:.78rem;font-weight:700;margin-bottom:.6rem}
        .card-info{display:flex;flex-wrap:wrap;gap:.4rem}
        .tag{background:#f0ede8;color:#666;font-size:.72rem;padding:.2rem .6rem;border-radius:20px;font-weight:700}
        .vazio{text-align:center;padding:3rem;color:#aaa;font-size:.9rem}
        .loading{text-align:center;padding:3rem;color:#aaa}
        .contador{font-size:.78rem;color:#aaa;margin-bottom:1rem}
      `}</style>

      <div className="page-header">
        <div>
          <h1 className="page-title">👥 Clientes</h1>
          <p className="page-sub">Gerencie seus produtores e fazendas</p>
        </div>
        <Link href="/dashboard/clientes/novo" className="btn-novo">
          + Novo Cliente
        </Link>
      </div>

      <div className="busca-wrap">
        <input
          className="busca"
          placeholder="🔍 Buscar por nome, fazenda ou cidade..."
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
                {c.nome_fazenda && <div className="card-fazenda">🌾 {c.nome_fazenda}</div>}
                <div className="card-info">
                  {c.cidade && <span className="tag">📍 {c.cidade}/{c.estado}</span>}
                  {c.cultura_principal && <span className="tag">🌱 {c.cultura_principal}</span>}
                  {c.telefone && <span className="tag">📞 {c.telefone}</span>}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  )
}
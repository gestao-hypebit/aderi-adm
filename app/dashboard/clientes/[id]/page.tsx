'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type Cliente = {
  id: string
  nome: string
  cpf_cnpj: string
  telefone: string
  email: string
  cidade: string
  estado: string
  nome_fazenda: string
  hectares: number
  cultura_principal: string
  observacoes: string
  created_at: string
}

type Visita = {
  id: string
  data_visita: string
  status: string
  descricao: string
  created_at: string
}

export default function ClientePerfilPage() {
  const { id } = useParams()
  const router = useRouter()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [carregando, setCarregando] = useState(true)
  const [deletando, setDeletando] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function carregar() {
      const { data: c } = await supabase.from('clientes').select('*').eq('id', id).single()
      const { data: v } = await supabase.from('visitas').select('*').eq('cliente_id', id).order('data_visita', { ascending: false })
      setCliente(c)
      setVisitas(v || [])
      setCarregando(false)
    }
    carregar()
  }, [id])

  async function deletarCliente() {
    if (!confirm('Tem certeza que deseja excluir este cliente? Todas as visitas serão apagadas.')) return
    setDeletando(true)
    await supabase.from('clientes').delete().eq('id', id)
    router.push('/dashboard/clientes')
  }

  const statusCor: Record<string, string> = {
    agendada: '#E67E22',
    realizada: '#27ae60',
    cancelada: '#e74c3c'
  }

  if (carregando) return <div style={{textAlign:'center',padding:'3rem',color:'#aaa'}}>Carregando...</div>
  if (!cliente) return <div style={{textAlign:'center',padding:'3rem',color:'#aaa'}}>Cliente não encontrado.</div>

  return (
    <>
      <style>{`
        .voltar{display:inline-flex;align-items:center;gap:.4rem;color:#E67E22;font-size:.82rem;font-weight:700;text-decoration:none;margin-bottom:1.2rem}
        .perfil-header{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:1.5rem}
        .perfil-info{display:flex;align-items:center;gap:1rem}
        .perfil-avatar{width:56px;height:56px;border-radius:14px;background:#162a1e;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1.5rem;flex-shrink:0}
        .perfil-nome{font-size:1.3rem;font-weight:700;color:#162a1e}
        .perfil-fazenda{color:#E67E22;font-size:.85rem;font-weight:700;margin-top:.2rem}
        .perfil-acoes{display:flex;gap:.6rem;flex-wrap:wrap}
        .btn-editar{background:#162a1e;color:#fff;border:none;padding:.65rem 1.2rem;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.82rem;font-weight:700;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:.4rem}
        .btn-visita{background:#E67E22;color:#fff;border:none;padding:.65rem 1.2rem;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.82rem;font-weight:700;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:.4rem}
        .btn-deletar{background:transparent;color:#e74c3c;border:1.5px solid #e74c3c;padding:.65rem 1.2rem;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.82rem;font-weight:700;cursor:pointer}
        .grid-info{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem;margin-bottom:1.5rem}
        .info-card{background:#fff;border-radius:12px;padding:1.2rem;box-shadow:0 2px 8px rgba(0,0,0,.05);overflow:hidden}
        .info-label{font-size:.68rem;font-weight:700;color:#aaa;letter-spacing:.06em;text-transform:uppercase;margin-bottom:.3rem}
        .info-valor{font-size:.85rem;font-weight:700;color:#162a1e;word-break:break-all}
        .secao-titulo{font-size:1rem;font-weight:700;color:#162a1e;margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between}
        .visita-item{background:#fff;border-radius:10px;padding:1rem 1.2rem;margin-bottom:.7rem;box-shadow:0 2px 6px rgba(0,0,0,.04);display:flex;align-items:flex-start;gap:1rem;border-left:4px solid}
        .visita-data{font-size:.78rem;font-weight:700;color:#aaa;min-width:80px}
        .visita-desc{font-size:.85rem;color:#444;line-height:1.5;flex:1}
        .status-badge{font-size:.68rem;font-weight:700;padding:.2rem .6rem;border-radius:20px;color:#fff;white-space:nowrap}
        .obs-card{background:#fff;border-radius:12px;padding:1.2rem;box-shadow:0 2px 8px rgba(0,0,0,.05);margin-bottom:1.5rem;font-size:.85rem;color:#555;line-height:1.7}
        .vazio-visitas{text-align:center;padding:2rem;color:#aaa;font-size:.85rem;background:#fff;border-radius:12px}
      `}</style>

      <Link href="/dashboard/clientes" className="voltar">← Voltar</Link>

      <div className="perfil-header">
        <div className="perfil-info">
          <div className="perfil-avatar">{cliente.nome?.charAt(0).toUpperCase()}</div>
          <div>
            <div className="perfil-nome">{cliente.nome}</div>
            {cliente.nome_fazenda && <div className="perfil-fazenda">🌾 {cliente.nome_fazenda}</div>}
          </div>
        </div>
        <div className="perfil-acoes">
          <Link href={`/dashboard/visitas/novo?cliente=${cliente.id}`} className="btn-visita">
            + Nova Visita
          </Link>
          <Link href={`/dashboard/clientes/${cliente.id}/editar`} className="btn-editar">
            ✏️ Editar
          </Link>
          <button className="btn-deletar" onClick={deletarCliente} disabled={deletando}>
            🗑️ Excluir
          </button>
        </div>
      </div>

      <div className="grid-info">
        {cliente.telefone && <div className="info-card"><div className="info-label">Telefone</div><div className="info-valor">📞 {cliente.telefone}</div></div>}
        {cliente.email && <div className="info-card"><div className="info-label">E-mail</div><div className="info-valor">✉️ {cliente.email}</div></div>}
        {cliente.cidade && <div className="info-card"><div className="info-label">Localização</div><div className="info-valor">📍 {cliente.cidade}/{cliente.estado}</div></div>}
        {cliente.cultura_principal && <div className="info-card"><div className="info-label">Cultura</div><div className="info-valor">🌱 {cliente.cultura_principal}</div></div>}
        {cliente.hectares && <div className="info-card"><div className="info-label">Área</div><div className="info-valor">📐 {cliente.hectares} ha</div></div>}
        {cliente.cpf_cnpj && <div className="info-card"><div className="info-label">CPF/CNPJ</div><div className="info-valor">{cliente.cpf_cnpj}</div></div>}
      </div>

      {cliente.observacoes && (
        <>
          <div className="secao-titulo">📝 Observações</div>
          <div className="obs-card">{cliente.observacoes}</div>
        </>
      )}

      <div className="secao-titulo">
        📋 Histórico de Visitas
        <span style={{fontSize:'.78rem',color:'#aaa',fontWeight:400}}>{visitas.length} visita{visitas.length !== 1 ? 's' : ''}</span>
      </div>

      {visitas.length === 0 ? (
        <div className="vazio-visitas">
          Nenhuma visita registrada ainda.<br/>
          <Link href={`/dashboard/visitas/novo?cliente=${cliente.id}`} className="btn-visita" style={{marginTop:'1rem',display:'inline-flex'}}>
            + Registrar primeira visita
          </Link>
        </div>
      ) : (
        visitas.map(v => (
          <Link href={`/dashboard/visitas/${v.id}`} key={v.id} style={{textDecoration:'none'}}>
            <div className="visita-item" style={{borderLeftColor: statusCor[v.status] || '#ccc'}}>
              <div className="visita-data">{new Date(v.data_visita).toLocaleDateString('pt-BR')}</div>
              <div className="visita-desc">{v.descricao || 'Sem descrição'}</div>
              <span className="status-badge" style={{background: statusCor[v.status] || '#ccc'}}>
                {v.status}
              </span>
            </div>
          </Link>
        ))
      )}
    </>
  )
}
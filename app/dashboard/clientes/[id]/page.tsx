'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Tabela from '@/app/components/Tabela'

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

function IconSprout({ color = 'currentColor', size = 14 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M7 20h10"/><path d="M10 20c0-4 .5-8 2-10"/><path d="M14 20c0-4-.5-8-2-10"/><path d="M5 5c1.5 0 3 1 3.5 3C7 8 5 7.5 4 6c-.5-1 0-1 1-1z"/><path d="M19 8c-1.5 0-3 .5-4 2 1.5 1 3 1 4 0 1-.5 1-1.5 0-2z"/></svg>
}
function IconPin({ color = 'currentColor', size = 14 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
}
function IconLeaf({ color = 'currentColor', size = 14 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
}
function IconPhone({ color = 'currentColor', size = 14 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
}
function IconMail({ color = 'currentColor', size = 14 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>
}
function IconRuler({ color = 'currentColor', size = 14 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M21.3 8.7 8.7 21.3a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4L15.3 2.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4Z"/><path d="m7.5 10.5 2 2"/><path d="m10.5 7.5 2 2"/><path d="m13.5 4.5 2 2"/><path d="m4.5 13.5 2 2"/></svg>
}
function IconNote({ color = 'currentColor', size = 16 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
}
function IconClipboard({ color = 'currentColor', size = 16 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6"/><path d="M9 16h4"/></svg>
}
function IconEdit({ color = 'currentColor', size = 14 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
}
function IconTrash({ color = 'currentColor', size = 14 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
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

  if (carregando) return <div style={{textAlign:'center',padding:'3rem',color:'#aaa'}}>Carregando...</div>
  if (!cliente) return <div style={{textAlign:'center',padding:'3rem',color:'#aaa'}}>Cliente não encontrado.</div>

  return (
    <>
      <style>{`
        .voltar{display:inline-flex;align-items:center;gap:.4rem;color:#E67E22;font-size:.82rem;font-weight:600;text-decoration:none;margin-bottom:1.2rem}
        .perfil-header{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:1.5rem}
        .perfil-info{display:flex;align-items:center;gap:1rem}
        .perfil-avatar{width:56px;height:56px;border-radius:14px;background:#162a1e;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:1.5rem;flex-shrink:0}
        .perfil-nome{font-size:1.3rem;font-weight:600;color:#162a1e}
        .perfil-fazenda{color:#E67E22;font-size:.85rem;font-weight:600;margin-top:.2rem;display:flex;align-items:center;gap:.35rem}
        .perfil-acoes{display:flex;gap:.6rem;flex-wrap:wrap}
        .btn-editar{background:#162a1e;color:#fff;border:none;padding:.65rem 1.2rem;border-radius:8px;font-family:'Poppins',sans-serif;font-size:.82rem;font-weight:600;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:.4rem}
        .btn-visita{background:#E67E22;color:#fff;border:none;padding:.65rem 1.2rem;border-radius:8px;font-family:'Poppins',sans-serif;font-size:.82rem;font-weight:600;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:.4rem}
        .btn-deletar{background:transparent;color:#e74c3c;border:1.5px solid #e74c3c;padding:.65rem 1.2rem;border-radius:8px;font-family:'Poppins',sans-serif;font-size:.82rem;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:.4rem}
        .grid-info{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem;margin-bottom:1.5rem}
        .info-card{background:#fff;border-radius:12px;padding:1.2rem;box-shadow:0 2px 8px rgba(0,0,0,.05);overflow:hidden}
        .info-label{font-size:.68rem;font-weight:600;color:#aaa;letter-spacing:.06em;text-transform:uppercase;margin-bottom:.3rem}
        .info-valor{font-size:.85rem;font-weight:600;color:#162a1e;word-break:break-all;display:flex;align-items:center;gap:.4rem}
        .secao-titulo{font-size:1rem;font-weight:600;color:#162a1e;margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between}
        .visita-item{background:#fff;border-radius:10px;padding:1rem 1.2rem;margin-bottom:.7rem;box-shadow:0 2px 6px rgba(0,0,0,.04);display:flex;align-items:flex-start;gap:1rem;border-left:4px solid}
        .visita-data{font-size:.78rem;font-weight:600;color:#aaa;min-width:80px}
        .visita-desc{font-size:.85rem;color:#444;line-height:1.5;flex:1}
        .status-badge{font-size:.68rem;font-weight:600;padding:.2rem .6rem;border-radius:20px;color:#fff;white-space:nowrap}
        .obs-card{background:#fff;border-radius:12px;padding:1.2rem;box-shadow:0 2px 8px rgba(0,0,0,.05);margin-bottom:1.5rem;font-size:.85rem;color:#555;line-height:1.7}
        .vazio-visitas{text-align:center;padding:2rem;color:#aaa;font-size:.85rem;background:#fff;border-radius:12px}
      `}</style>

      <Link href="/dashboard/clientes" className="voltar">← Voltar</Link>

      <div className="perfil-header">
        <div className="perfil-info">
          <div className="perfil-avatar">{cliente.nome?.charAt(0).toUpperCase()}</div>
          <div>
            <div className="perfil-nome">{cliente.nome}</div>
            {cliente.nome_fazenda && <div className="perfil-fazenda"><IconSprout color="#E67E22" /> {cliente.nome_fazenda}</div>}
          </div>
        </div>
        <div className="perfil-acoes">
          <Link href={`/dashboard/visitas/novo?cliente=${cliente.id}`} className="btn-visita">
            + Nova Visita
          </Link>
          <Link href={`/dashboard/clientes/${cliente.id}/editar`} className="btn-editar">
            <IconEdit /> Editar
          </Link>
          <button className="btn-deletar" onClick={deletarCliente} disabled={deletando}>
            <IconTrash /> Excluir
          </button>
        </div>
      </div>

      <div className="grid-info">
        {cliente.telefone && <div className="info-card"><div className="info-label">Telefone</div><div className="info-valor"><IconPhone color="#E67E22" /> {cliente.telefone}</div></div>}
        {cliente.email && <div className="info-card"><div className="info-label">E-mail</div><div className="info-valor"><IconMail color="#E67E22" /> {cliente.email}</div></div>}
        {cliente.cidade && <div className="info-card"><div className="info-label">Localização</div><div className="info-valor"><IconPin color="#E67E22" /> {cliente.cidade}/{cliente.estado}</div></div>}
        {cliente.cultura_principal && <div className="info-card"><div className="info-label">Cultura</div><div className="info-valor"><IconLeaf color="#E67E22" /> {cliente.cultura_principal}</div></div>}
        {cliente.hectares && <div className="info-card"><div className="info-label">Área</div><div className="info-valor"><IconRuler color="#E67E22" /> {cliente.hectares} ha</div></div>}
        {cliente.cpf_cnpj && <div className="info-card"><div className="info-label">CPF/CNPJ</div><div className="info-valor">{cliente.cpf_cnpj}</div></div>}
      </div>

      {cliente.observacoes && (
        <>
          <div className="secao-titulo"><span style={{display:'inline-flex',alignItems:'center',gap:'.45rem'}}><IconNote color="#162a1e" /> Observações</span></div>
          <div className="obs-card">{cliente.observacoes}</div>
        </>
      )}

      <div className="secao-titulo">
        <span style={{display:'inline-flex',alignItems:'center',gap:'.45rem'}}><IconClipboard color="#162a1e" /> Histórico de Visitas</span>
        <span style={{fontSize:'.78rem',color:'#aaa',fontWeight:400}}>{visitas.length} visita{visitas.length !== 1 ? 's' : ''}</span>
      </div>

      <Tabela
        linhas={visitas}
        chave={v => v.id}
        href={v => `/dashboard/visitas/${v.id}`}
        porPagina={10}
        rotulo="visitas"
        vazio={
          <div className="ui-empty">
            <div className="ui-empty-title">Nenhuma visita registrada ainda</div>
            <Link href={`/dashboard/visitas/novo?cliente=${cliente.id}`} className="ui-btn ui-btn-secondary ui-btn-sm">+ Registrar primeira visita</Link>
          </div>
        }
        colunas={[
          { id: 'data', titulo: 'Data', largura: '110px', ordenar: (a, b) => a.data_visita.localeCompare(b.data_visita),
            celula: v => <span className="ui-cel-num ui-cel-forte">{v.data_visita.split('-').reverse().join('/')}</span> },
          { id: 'desc', titulo: 'Descrição', celula: v => <span className="ui-cel-titulo" style={{ fontWeight: 500, display: 'block' }}>{v.descricao || 'Sem descrição'}</span> },
          { id: 'status', titulo: 'Status', largura: '110px', ordenar: (a, b) => a.status.localeCompare(b.status),
            celula: v => <span className={`ui-badge ui-badge-${v.status}`}>{v.status.charAt(0).toUpperCase() + v.status.slice(1)}</span> },
        ]}
      />
    </>
  )
}
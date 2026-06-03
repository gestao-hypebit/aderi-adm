'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type Visita = {
  id: string
  data_visita: string
  hora_visita: string
  status: string
  descricao: string
  recomendacoes: string
  proximo_contato: string
  cliente: { id: string; nome: string; nome_fazenda: string; cidade: string; estado: string }
  funcionario: { nome_completo: string }
}

export default function VisitaDetalhe() {
  const { id } = useParams()
  const router = useRouter()
  const [visita, setVisita] = useState<Visita | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase
        .from('visitas')
        .select('*, cliente:clientes(id, nome, nome_fazenda, cidade, estado), funcionario:profiles(nome_completo)')
        .eq('id', id)
        .single()
      setVisita(data)
      setCarregando(false)
    }
    carregar()
  }, [id])

  async function mudarStatus(novoStatus: string) {
    setAtualizando(true)
    await supabase.from('visitas').update({ status: novoStatus }).eq('id', id)
    setVisita(v => v ? { ...v, status: novoStatus } : v)
    setAtualizando(false)
  }

  async function deletar() {
    if (!confirm('Excluir esta visita?')) return
    await supabase.from('visitas').delete().eq('id', id)
    router.push('/dashboard/visitas')
  }

  const statusCor: Record<string, string> = {
    agendada: '#E67E22',
    realizada: '#27ae60',
    cancelada: '#e74c3c'
  }

  if (carregando) return <div style={{textAlign:'center',padding:'3rem',color:'#aaa'}}>Carregando...</div>
  if (!visita) return <div style={{textAlign:'center',padding:'3rem',color:'#aaa'}}>Visita não encontrada.</div>

  const data = new Date(visita.data_visita + 'T12:00:00')

  return (
    <>
      <style>{`
        .voltar{display:inline-flex;align-items:center;gap:.4rem;color:#E67E22;font-size:.82rem;font-weight:700;text-decoration:none;margin-bottom:1.2rem}
        .visita-header{background:#fff;border-radius:14px;padding:1.5rem;box-shadow:0 2px 8px rgba(0,0,0,.05);margin-bottom:1.2rem;display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem}
        .visita-data-grande{text-align:center;background:#f0ede8;border-radius:10px;padding:.8rem 1.2rem;min-width:70px}
        .dia-num{font-size:2rem;font-weight:900;color:#162a1e;line-height:1}
        .mes-txt{font-size:.72rem;font-weight:700;color:#aaa;text-transform:uppercase}
        .visita-titulo{flex:1}
        .cliente-nome{font-size:1.2rem;font-weight:700;color:#162a1e}
        .cliente-fazenda{color:#E67E22;font-size:.85rem;font-weight:700;margin:.2rem 0}
        .cliente-loc{color:#aaa;font-size:.78rem}
        .status-atual{display:inline-flex;align-items:center;gap:.4rem;font-size:.82rem;font-weight:700;padding:.35rem 1rem;border-radius:20px;color:#fff;margin-top:.5rem}
        .acoes{display:flex;gap:.6rem;flex-wrap:wrap}
        .btn-acao{padding:.55rem 1rem;border-radius:8px;border:none;font-family:'Comfortaa',sans-serif;font-size:.78rem;font-weight:700;cursor:pointer;transition:all .2s}
        .secao{background:#fff;border-radius:12px;padding:1.2rem 1.5rem;box-shadow:0 2px 6px rgba(0,0,0,.04);margin-bottom:1rem}
        .secao-label{font-size:.68rem;font-weight:700;color:#E67E22;letter-spacing:.08em;text-transform:uppercase;margin-bottom:.6rem}
        .secao-texto{font-size:.88rem;color:#444;line-height:1.8}
        .status-btns{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.5rem}
        .status-btn{padding:.45rem 1rem;border-radius:20px;border:1.5px solid;font-family:'Comfortaa',sans-serif;font-size:.75rem;font-weight:700;cursor:pointer;transition:all .2s;background:transparent}
        .info-row{display:flex;gap:.5rem;align-items:center;font-size:.85rem;color:#444;margin-bottom:.4rem}
        .info-row span{font-weight:700;color:#162a1e}
        .link-cliente{display:inline-flex;align-items:center;gap:.4rem;color:#E67E22;font-size:.82rem;font-weight:700;text-decoration:none;margin-top:.5rem}
      `}</style>

      <Link href="/dashboard/visitas" className="voltar">← Voltar</Link>

      <div className="visita-header">
        <div style={{display:'flex',gap:'1rem',alignItems:'flex-start',flex:1}}>
          <div className="visita-data-grande">
            <div className="dia-num">{String(data.getDate()).padStart(2,'0')}</div>
            <div className="mes-txt">{data.toLocaleDateString('pt-BR',{month:'short'})}</div>
            <div className="mes-txt">{data.getFullYear()}</div>
          </div>
          <div className="visita-titulo">
            <div className="cliente-nome">{visita.cliente?.nome}</div>
            {visita.cliente?.nome_fazenda && <div className="cliente-fazenda">🌾 {visita.cliente.nome_fazenda}</div>}
            <div className="cliente-loc">📍 {visita.cliente?.cidade}/{visita.cliente?.estado}</div>
            <div className="status-atual" style={{background: statusCor[visita.status]}}>
              {visita.status === 'agendada' ? '📅' : visita.status === 'realizada' ? '✅' : '❌'} {visita.status}
            </div>
          </div>
        </div>
        <div className="acoes">
          <button className="btn-acao" style={{background:'#fef2f2',color:'#e74c3c'}} onClick={deletar}>🗑️ Excluir</button>
        </div>
      </div>

      <div className="secao">
        <div className="secao-label">Alterar Status</div>
        <div className="status-btns">
          {['agendada','realizada','cancelada'].map(s => (
            <button
              key={s}
              className="status-btn"
              style={{
                borderColor: statusCor[s],
                color: visita.status === s ? '#fff' : statusCor[s],
                background: visita.status === s ? statusCor[s] : 'transparent',
                opacity: atualizando ? 0.6 : 1
              }}
              onClick={() => mudarStatus(s)}
              disabled={atualizando || visita.status === s}
            >
              {s === 'agendada' ? '📅' : s === 'realizada' ? '✅' : '❌'} {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {visita.hora_visita && (
        <div className="secao">
          <div className="secao-label">Horário</div>
          <div className="info-row">⏰ <span>{visita.hora_visita.slice(0,5)}</span></div>
        </div>
      )}

      {visita.descricao && (
        <div className="secao">
          <div className="secao-label">Descrição da Visita</div>
          <div className="secao-texto">{visita.descricao}</div>
        </div>
      )}

      {visita.recomendacoes && (
        <div className="secao">
          <div className="secao-label">Recomendações</div>
          <div className="secao-texto">{visita.recomendacoes}</div>
        </div>
      )}

      {visita.proximo_contato && (
        <div className="secao">
          <div className="secao-label">Próximo Contato</div>
          <div className="info-row">📅 <span>{new Date(visita.proximo_contato + 'T12:00:00').toLocaleDateString('pt-BR')}</span></div>
        </div>
      )}

      <div className="secao">
        <div className="secao-label">Cliente</div>
        <div className="info-row">👤 <span>{visita.cliente?.nome}</span></div>
        {visita.cliente?.nome_fazenda && <div className="info-row">🌾 <span>{visita.cliente.nome_fazenda}</span></div>}
        <Link href={`/dashboard/clientes/${visita.cliente?.id}`} className="link-cliente">
          Ver perfil completo do cliente →
        </Link>
      </div>
    </>
  )
}
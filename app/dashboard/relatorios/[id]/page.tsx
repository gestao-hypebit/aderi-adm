'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'

type Visita = {
  id: string
  data_visita: string
  hora_visita: string
  status: string
  descricao: string
  recomendacoes: string
  proximo_contato: string
  created_at: string
  km_rodado: number | null
  motivo_visita: string | null
  motivo_outro: string | null
  observacao_finalizacao: string | null
  cliente: {
    nome: string
    cpf_cnpj: string
    telefone: string
    email: string
    cidade: string
    estado: string
    nome_fazenda: string
    hectares: number
    cultura_principal: string
  }
  funcionario: { nome_completo: string }
}

type Foto = {
  id: string
  url: string
  legenda: string | null
}

export default function RelatorioVisitaPage() {
  const { id } = useParams()
  const router = useRouter()
  const [visita, setVisita] = useState<Visita | null>(null)
  const [fotos, setFotos] = useState<Foto[]>([])
  const [carregando, setCarregando] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase
        .from('visitas')
        .select('*, cliente:clientes(*), funcionario:profiles(nome_completo)')
        .eq('id', id)
        .single()
      setVisita(data)

      const { data: fotosData } = await supabase
        .from('visita_fotos')
        .select('id, url, legenda')
        .eq('visita_id', id)
        .order('created_at')
      setFotos(fotosData || [])

      setCarregando(false)
    }
    carregar()
  }, [id])

  if (carregando) return <div style={{textAlign:'center',padding:'3rem',color:'#aaa'}}>Carregando relatório...</div>
  if (!visita) return <div style={{textAlign:'center',padding:'3rem',color:'#aaa'}}>Relatório não encontrado.</div>

  const dataVisita = new Date(visita.data_visita + 'T12:00:00')
  const dataGeracao = new Date()

  const statusCores: Record<string, string> = {
    agendada: '#E67E22', realizada: '#27ae60', cancelada: '#e74c3c',
  }
  const statusEmoji: Record<string, string> = {
    agendada: '📅', realizada: '✅', cancelada: '❌',
  }
  const statusLabel: Record<string, string> = {
    agendada: 'Visita Agendada', realizada: 'Visita Realizada', cancelada: 'Visita Cancelada',
  }

  const motivoExibido = visita.motivo_visita === 'Outros'
    ? `Outros — ${visita.motivo_outro || ''}`
    : visita.motivo_visita

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@400;700;900&display=swap');

        .acoes-tela{display:flex;gap:.7rem;margin-bottom:1.5rem;flex-wrap:wrap}
        .btn-voltar{display:inline-flex;align-items:center;gap:.4rem;color:#E67E22;font-size:.82rem;font-weight:700;text-decoration:none;background:none;border:none;cursor:pointer;font-family:'Comfortaa',sans-serif}
        .btn-imprimir{display:inline-flex;align-items:center;gap:.5rem;background:#162a1e;color:#fff;padding:.7rem 1.4rem;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.85rem;font-weight:700;border:none;cursor:pointer;transition:background .2s}
        .btn-imprimir:hover{background:#0d1f14}

        .relatorio{background:#fff;border-radius:16px;padding:2.5rem;box-shadow:0 4px 20px rgba(0,0,0,.08);max-width:800px;margin:0 auto;font-family:'Comfortaa',sans-serif}

        .rel-header{display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:1.5rem;border-bottom:2px solid #162a1e;margin-bottom:1.5rem}
        .rel-logo-area{display:flex;align-items:center;gap:.7rem}
        .rel-logo-img{width:40px;height:40px;object-fit:contain}
        .rel-logo-texto{font-weight:900;font-size:1.1rem;color:#162a1e}
        .rel-logo-texto span{color:#E67E22}
        .rel-titulo-doc{text-align:right}
        .rel-titulo-doc h2{font-size:1rem;font-weight:700;color:#162a1e;margin-bottom:.2rem}
        .rel-titulo-doc p{font-size:.72rem;color:#aaa}
        .rel-num{background:#162a1e;color:#fff;font-size:.7rem;font-weight:700;padding:.2rem .6rem;border-radius:4px;display:inline-block;margin-top:.3rem}

        .rel-secao{margin-bottom:1.5rem}
        .rel-secao-titulo{font-size:.7rem;font-weight:700;color:#E67E22;letter-spacing:.1em;text-transform:uppercase;margin-bottom:.8rem;padding-bottom:.4rem;border-bottom:1px solid #f0ede8}
        .rel-grid{display:grid;grid-template-columns:1fr 1fr;gap:.6rem}
        .rel-campo{background:#f7f5f0;border-radius:8px;padding:.6rem .8rem}
        .rel-campo-label{font-size:.62rem;font-weight:700;color:#aaa;letter-spacing:.06em;text-transform:uppercase;margin-bottom:.2rem}
        .rel-campo-valor{font-size:.82rem;font-weight:700;color:#162a1e}
        .rel-campo-full{grid-column:1/-1}
        .rel-texto{background:#f7f5f0;border-radius:8px;padding:.8rem 1rem;font-size:.82rem;color:#444;line-height:1.8}
        .rel-status{display:inline-flex;align-items:center;gap:.4rem;color:#fff;font-size:.75rem;font-weight:700;padding:.3rem .8rem;border-radius:20px}

        /* FOTOS */
        .rel-fotos-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:.4rem}
        .rel-foto-item{border-radius:8px;overflow:hidden;border:1px solid #eae5de;break-inside:avoid;page-break-inside:avoid}
        .rel-foto-img{width:100%;height:160px;object-fit:cover;display:block}
        .rel-foto-legenda{padding:.5rem .7rem;font-size:.72rem;color:#555;background:#f7f5f0;border-top:1px solid #eae5de;text-align:center;font-style:italic;line-height:1.4}

        .rel-footer{margin-top:2rem;padding-top:1rem;border-top:1px solid #eae5de;display:flex;align-items:center;justify-content:space-between;font-size:.68rem;color:#aaa}
        .rel-assinatura{border-top:1px solid #162a1e;padding-top:.3rem;min-width:200px;text-align:center;font-size:.7rem;color:#555;margin-top:2rem}

        @media print {
          *{overflow:visible !important;scrollbar-width:none !important}
          ::-webkit-scrollbar{display:none !important}
          .acoes-tela{display:none !important}
          .sidebar{display:none !important}
          .topbar{display:none !important}
          .main{margin-left:0 !important;width:100% !important}
          .content{padding:0 !important}
          .content > *:not(.relatorio){display:none !important}
          .relatorio{box-shadow:none !important;border-radius:0 !important;padding:1.5rem !important;max-width:100% !important}
          body{background:#fff !important}
          .rel-foto-item{break-inside:avoid;page-break-inside:avoid}
          .rel-fotos-grid{break-inside:avoid;page-break-inside:avoid}
          .rel-secao{break-inside:avoid;page-break-inside:avoid}
        }
      `}</style>

      <div className="acoes-tela">
        <button className="btn-voltar" onClick={() => router.back()}>← Voltar</button>
        <button className="btn-imprimir" onClick={() => window.print()}>
          🖨️ Imprimir / Salvar PDF
        </button>
      </div>

      <div className="relatorio">

        <div className="rel-header">
          <div className="rel-logo-area">
            <img src="/logo-aderi.png" alt="Aderi" className="rel-logo-img"/>
            <div>
              <div className="rel-logo-texto">aderi <span>agronegócios</span></div>
              <div style={{fontSize:'.68rem',color:'#aaa',marginTop:'.1rem'}}>Relatório de Visita Técnica</div>
            </div>
          </div>
          <div className="rel-titulo-doc">
            <h2>Relatório de Visita</h2>
            <p>{dataVisita.toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric'})}</p>
            <div className="rel-num">Nº {visita.id.slice(0,8).toUpperCase()}</div>
          </div>
        </div>

        <div style={{marginBottom:'1.2rem'}}>
          <span className="rel-status" style={{background: statusCores[visita.status] || '#888'}}>
            {statusEmoji[visita.status]} {statusLabel[visita.status] || visita.status}
          </span>
        </div>

        <div className="rel-secao">
          <div className="rel-secao-titulo">Dados do Produtor</div>
          <div className="rel-grid">
            <div className="rel-campo rel-campo-full">
              <div className="rel-campo-label">Nome completo</div>
              <div className="rel-campo-valor">{visita.cliente?.nome || '—'}</div>
            </div>
            {visita.cliente?.cpf_cnpj && (
              <div className="rel-campo">
                <div className="rel-campo-label">CPF / CNPJ</div>
                <div className="rel-campo-valor">{visita.cliente.cpf_cnpj}</div>
              </div>
            )}
            {visita.cliente?.telefone && (
              <div className="rel-campo">
                <div className="rel-campo-label">Telefone</div>
                <div className="rel-campo-valor">{visita.cliente.telefone}</div>
              </div>
            )}
            {visita.cliente?.email && (
              <div className="rel-campo rel-campo-full">
                <div className="rel-campo-label">E-mail</div>
                <div className="rel-campo-valor">{visita.cliente.email}</div>
              </div>
            )}
          </div>
        </div>

        <div className="rel-secao">
          <div className="rel-secao-titulo">Dados da Propriedade</div>
          <div className="rel-grid">
            {visita.cliente?.nome_fazenda && (
              <div className="rel-campo">
                <div className="rel-campo-label">Nome da fazenda</div>
                <div className="rel-campo-valor">🌾 {visita.cliente.nome_fazenda}</div>
              </div>
            )}
            {visita.cliente?.cidade && (
              <div className="rel-campo">
                <div className="rel-campo-label">Localização</div>
                <div className="rel-campo-valor">📍 {visita.cliente.cidade}/{visita.cliente.estado}</div>
              </div>
            )}
            {visita.cliente?.cultura_principal && (
              <div className="rel-campo">
                <div className="rel-campo-label">Cultura principal</div>
                <div className="rel-campo-valor">🌱 {visita.cliente.cultura_principal}</div>
              </div>
            )}
            {visita.cliente?.hectares && (
              <div className="rel-campo">
                <div className="rel-campo-label">Área total</div>
                <div className="rel-campo-valor">📐 {visita.cliente.hectares} hectares</div>
              </div>
            )}
          </div>
        </div>

        <div className="rel-secao">
          <div className="rel-secao-titulo">Dados da Visita</div>
          <div className="rel-grid">
            <div className="rel-campo">
              <div className="rel-campo-label">Data</div>
              <div className="rel-campo-valor">{dataVisita.toLocaleDateString('pt-BR')}</div>
            </div>
            {visita.hora_visita && (
              <div className="rel-campo">
                <div className="rel-campo-label">Horário</div>
                <div className="rel-campo-valor">{visita.hora_visita.slice(0,5)}</div>
              </div>
            )}
            {motivoExibido && (
              <div className="rel-campo rel-campo-full">
                <div className="rel-campo-label">Motivo da visita</div>
                <div className="rel-campo-valor">🎯 {motivoExibido}</div>
              </div>
            )}
            {visita.km_rodado != null && (
              <div className="rel-campo">
                <div className="rel-campo-label">KM rodado</div>
                <div className="rel-campo-valor">🛣️ {visita.km_rodado} km</div>
              </div>
            )}
            {visita.funcionario?.nome_completo && (
              <div className="rel-campo rel-campo-full">
                <div className="rel-campo-label">Técnico responsável</div>
                <div className="rel-campo-valor">👤 {visita.funcionario.nome_completo}</div>
              </div>
            )}
            {visita.proximo_contato && (
              <div className="rel-campo rel-campo-full">
                <div className="rel-campo-label">Próximo contato previsto</div>
                <div className="rel-campo-valor">📅 {new Date(visita.proximo_contato + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
              </div>
            )}
          </div>
        </div>

        {visita.descricao && (
          <div className="rel-secao">
            <div className="rel-secao-titulo">Descrição da Visita</div>
            <div className="rel-texto">{visita.descricao}</div>
          </div>
        )}

        {visita.recomendacoes && (
          <div className="rel-secao">
            <div className="rel-secao-titulo">Recomendações Técnicas</div>
            <div className="rel-texto">{visita.recomendacoes}</div>
          </div>
        )}

        {visita.observacao_finalizacao && (
          <div className="rel-secao">
            <div className="rel-secao-titulo">Observações de Finalização</div>
            <div className="rel-texto">{visita.observacao_finalizacao}</div>
          </div>
        )}

        {fotos.length > 0 && (
          <div className="rel-secao">
            <div className="rel-secao-titulo">Registro Fotográfico</div>
            <div className="rel-fotos-grid">
              {fotos.map(foto => (
                <div key={foto.id} className="rel-foto-item">
                  <img src={foto.url} alt={foto.legenda || ''} className="rel-foto-img"/>
                  {foto.legenda && (
                    <div className="rel-foto-legenda">{foto.legenda}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{display:'flex',justifyContent:'flex-end',marginTop:'2.5rem'}}>
          <div className="rel-assinatura">
            <div>{visita.funcionario?.nome_completo || 'Técnico Responsável'}</div>
            <div style={{fontSize:'.65rem',color:'#aaa'}}>Aderi Agronegócios</div>
          </div>
        </div>

        <div className="rel-footer">
          <span>Aderi Agronegócios — Piumhi, MG</span>
          <span>Gerado em {dataGeracao.toLocaleDateString('pt-BR')} às {dataGeracao.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span>
        </div>

      </div>
    </>
  )
}
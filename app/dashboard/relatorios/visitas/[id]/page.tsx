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

function IconArrowLeft() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
}
function IconPrinter() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
}
function IconCalendar({ color = 'currentColor', size = 13 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function IconCheck({ color = 'currentColor', size = 13 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
}
function IconX({ color = 'currentColor', size = 13 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
}
function IconSprout({ color = 'currentColor', size = 13 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M7 20h10"/><path d="M10 20c0-4 .5-8 2-10"/><path d="M14 20c0-4-.5-8-2-10"/><path d="M5 5c1.5 0 3 1 3.5 3C7 8 5 7.5 4 6c-.5-1 0-1 1-1z"/><path d="M19 8c-1.5 0-3 .5-4 2 1.5 1 3 1 4 0 1-.5 1-1.5 0-2z"/></svg>
}
function IconPin({ color = 'currentColor', size = 13 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
}
function IconLeaf({ color = 'currentColor', size = 13 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
}
function IconRuler({ color = 'currentColor', size = 13 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/></svg>
}
function IconRoute({ color = 'currentColor', size = 13 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/></svg>
}
function IconTarget({ color = 'currentColor', size = 13 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
}
function IconUser({ color = 'currentColor', size = 13 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
}

function statusIcon(status: string, color: string, size = 13) {
  if (status === 'agendada') return <IconCalendar color={color} size={size} />
  if (status === 'realizada') return <IconCheck color={color} size={size} />
  return <IconX color={color} size={size} />
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

  if (carregando) return <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>Carregando relatório...</div>
  if (!visita) return <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>Relatório não encontrado.</div>

  const dataVisita = new Date(visita.data_visita + 'T12:00:00')
  const dataGeracao = new Date()

  const statusCores: Record<string, string> = {
    agendada: '#E67E22', realizada: '#27ae60', cancelada: '#e74c3c',
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
        .rel-campo-valor{display:flex;align-items:center;gap:.4rem;font-size:.82rem;font-weight:700;color:#162a1e}
        .rel-campo-full{grid-column:1/-1}
        .rel-texto{background:#f7f5f0;border-radius:8px;padding:.8rem 1rem;font-size:.82rem;color:#444;line-height:1.8}
        .rel-status{display:inline-flex;align-items:center;gap:.4rem;color:#fff;font-size:.75rem;font-weight:700;padding:.3rem .8rem;border-radius:20px}

        .rel-fotos-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:.4rem}
        .rel-foto-item{border-radius:8px;overflow:hidden;border:1px solid #eae5de}
        .rel-foto-img{width:100%;height:200px;object-fit:cover;display:block}
        .rel-foto-legenda{padding:.5rem .7rem;font-size:.72rem;color:#555;background:#f7f5f0;border-top:1px solid #eae5de;text-align:center;font-style:italic;line-height:1.4}

        .rel-footer{margin-top:2rem;padding-top:1rem;border-top:1px solid #eae5de;display:flex;align-items:center;justify-content:space-between;font-size:.68rem;color:#aaa}
        .rel-assinatura{border-top:1px solid #162a1e;padding-top:.3rem;min-width:200px;text-align:center;font-size:.7rem;color:#555;margin-top:2rem}

        @media print {
          .acoes-tela{display:none !important}
          .sidebar{display:none !important}
          .topbar{display:none !important}
          .main{margin-left:0 !important;width:100% !important}
          .content{padding:0 !important}
          .content > *:not(.relatorio){display:none !important}
          .relatorio{box-shadow:none !important;border-radius:0 !important;padding:1.5rem !important;max-width:100% !important}
          body{background:#fff !important}
        }
      `}</style>

      <div className="acoes-tela">
        <button className="btn-voltar" onClick={() => router.back()}><IconArrowLeft /> Voltar</button>
        <button className="btn-imprimir" onClick={() => window.print()}>
          <IconPrinter /> Imprimir / Salvar PDF
        </button>
      </div>

      <div className="relatorio">

        <div className="rel-header">
          <div className="rel-logo-area">
            <img src="/logo-aderi.png" alt="Aderi" className="rel-logo-img" />
            <div>
              <div className="rel-logo-texto">aderi <span>agronegócios</span></div>
              <div style={{ fontSize: '.68rem', color: '#aaa', marginTop: '.1rem' }}>Relatório de Visita Técnica</div>
            </div>
          </div>
          <div className="rel-titulo-doc">
            <h2>Relatório de Visita</h2>
            <p>{dataVisita.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <div className="rel-num">Nº {visita.id.slice(0, 8).toUpperCase()}</div>
          </div>
        </div>

        <div style={{ marginBottom: '1.2rem' }}>
          <span className="rel-status" style={{ background: statusCores[visita.status] || '#888' }}>
            {statusIcon(visita.status, '#fff')} {statusLabel[visita.status] || visita.status}
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
                <div className="rel-campo-valor"><IconSprout color="#162a1e" />{visita.cliente.nome_fazenda}</div>
              </div>
            )}
            {visita.cliente?.cidade && (
              <div className="rel-campo">
                <div className="rel-campo-label">Localização</div>
                <div className="rel-campo-valor"><IconPin color="#162a1e" />{visita.cliente.cidade}/{visita.cliente.estado}</div>
              </div>
            )}
            {visita.cliente?.cultura_principal && (
              <div className="rel-campo">
                <div className="rel-campo-label">Cultura principal</div>
                <div className="rel-campo-valor"><IconLeaf color="#162a1e" />{visita.cliente.cultura_principal}</div>
              </div>
            )}
            {visita.cliente?.hectares && (
              <div className="rel-campo">
                <div className="rel-campo-label">Área total</div>
                <div className="rel-campo-valor"><IconRuler color="#162a1e" />{visita.cliente.hectares} hectares</div>
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
                <div className="rel-campo-valor">{visita.hora_visita.slice(0, 5)}</div>
              </div>
            )}
            {motivoExibido && (
              <div className="rel-campo rel-campo-full">
                <div className="rel-campo-label">Motivo da visita</div>
                <div className="rel-campo-valor"><IconTarget color="#162a1e" />{motivoExibido}</div>
              </div>
            )}
            {visita.km_rodado != null && (
              <div className="rel-campo">
                <div className="rel-campo-label">KM rodado</div>
                <div className="rel-campo-valor"><IconRoute color="#162a1e" />{visita.km_rodado} km</div>
              </div>
            )}
            {visita.funcionario?.nome_completo && (
              <div className="rel-campo rel-campo-full">
                <div className="rel-campo-label">Técnico responsável</div>
                <div className="rel-campo-valor"><IconUser color="#162a1e" />{visita.funcionario.nome_completo}</div>
              </div>
            )}
            {visita.proximo_contato && (
              <div className="rel-campo rel-campo-full">
                <div className="rel-campo-label">Próximo contato previsto</div>
                <div className="rel-campo-valor"><IconCalendar color="#162a1e" />{new Date(visita.proximo_contato + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
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
                  <img src={foto.url} alt={foto.legenda || ''} className="rel-foto-img" />
                  {foto.legenda && (
                    <div className="rel-foto-legenda">{foto.legenda}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2.5rem' }}>
          <div className="rel-assinatura">
            <div>{visita.funcionario?.nome_completo || 'Técnico Responsável'}</div>
            <div style={{ fontSize: '.65rem', color: '#aaa' }}>Aderi Agronegócios</div>
          </div>
        </div>

        <div className="rel-footer">
          <span>Aderi Agronegócios — Piumhi, MG</span>
          <span>Gerado em {dataGeracao.toLocaleDateString('pt-BR')} às {dataGeracao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>

      </div>
    </>
  )
}

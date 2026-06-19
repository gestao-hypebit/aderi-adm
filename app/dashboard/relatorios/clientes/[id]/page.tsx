'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'

type Cliente = {
  id: string
  nome: string
  cpf_cnpj: string | null
  telefone: string | null
  email: string | null
  cidade: string | null
  estado: string | null
  nome_fazenda: string | null
  hectares: number | null
  cultura_principal: string | null
  status: string | null
  created_at: string
}

type Visita = {
  id: string
  data_visita: string
  status: string
  motivo_visita: string | null
  funcionario: { nome_completo: string } | null
}

function IconArrowLeft() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
}
function IconPrinter() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
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
function IconCheck({ color = 'currentColor', size = 13 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
}
function IconCalendar({ color = 'currentColor', size = 13 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}

const statusCor: Record<string, string> = {
  agendada: '#E67E22', realizada: '#27ae60', cancelada: '#e74c3c',
}

export default function RelatorioClientePage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      const [{ data: cli }, { data: vis }] = await Promise.all([
        supabase.from('clientes').select('*').eq('id', id).single(),
        supabase
          .from('visitas')
          .select('id, data_visita, status, motivo_visita, funcionario:profiles(nome_completo)')
          .eq('cliente_id', id)
          .order('data_visita', { ascending: false })
          .limit(50),
      ])
      setCliente(cli)
      setVisitas((vis as unknown as Visita[]) ?? [])
      setCarregando(false)
    }
    carregar()
  }, [id])

  if (carregando) return <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>Carregando...</div>
  if (!cliente) return <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>Cliente não encontrado.</div>

  const dataGeracao = new Date()
  const totalVisitas = visitas.length
  const realizadas = visitas.filter(v => v.status === 'realizada').length
  const agendadas = visitas.filter(v => v.status === 'agendada').length
  const canceladas = visitas.filter(v => v.status === 'cancelada').length
  const ultimaVisita = visitas[0]
  const recentVisitas = visitas.slice(0, 10)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@400;700;900&display=swap');

        .acoes-tela{display:flex;gap:.7rem;margin-bottom:1.5rem;flex-wrap:wrap}
        .btn-voltar{display:inline-flex;align-items:center;gap:.4rem;color:#E67E22;font-size:.82rem;font-weight:700;background:none;border:none;cursor:pointer;font-family:'Comfortaa',sans-serif}
        .btn-imprimir{display:inline-flex;align-items:center;gap:.5rem;background:#162a1e;color:#fff;padding:.7rem 1.4rem;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.85rem;font-weight:700;border:none;cursor:pointer}

        .relatorio{background:#fff;border-radius:16px;padding:2.5rem;box-shadow:0 4px 20px rgba(0,0,0,.08);max-width:800px;margin:0 auto;font-family:'Comfortaa',sans-serif}
        .rel-header{display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:1.5rem;border-bottom:2px solid #162a1e;margin-bottom:1.5rem}
        .rel-logo-area{display:flex;align-items:center;gap:.7rem}
        .rel-logo-img{width:40px;height:40px;object-fit:contain}
        .rel-logo-texto{font-weight:900;font-size:1.1rem;color:#162a1e}
        .rel-logo-texto span{color:#E67E22}
        .rel-titulo-doc{text-align:right}
        .rel-titulo-doc h2{font-size:1rem;font-weight:700;color:#162a1e;margin-bottom:.2rem}
        .rel-titulo-doc p{font-size:.72rem;color:#aaa}

        .rel-secao{margin-bottom:1.5rem}
        .rel-secao-titulo{font-size:.7rem;font-weight:700;color:#E67E22;letter-spacing:.1em;text-transform:uppercase;margin-bottom:.8rem;padding-bottom:.4rem;border-bottom:1px solid #f0ede8}
        .rel-grid{display:grid;grid-template-columns:1fr 1fr;gap:.6rem}
        .rel-campo{background:#f7f5f0;border-radius:8px;padding:.6rem .8rem}
        .rel-campo-label{font-size:.62rem;font-weight:700;color:#aaa;letter-spacing:.06em;text-transform:uppercase;margin-bottom:.2rem}
        .rel-campo-valor{display:flex;align-items:center;gap:.4rem;font-size:.82rem;font-weight:700;color:#162a1e}
        .rel-campo-full{grid-column:1/-1}

        .kpi-row{display:flex;gap:1rem;margin-bottom:.5rem;flex-wrap:wrap}
        .kpi-box{background:#f7f5f0;border-radius:10px;padding:.8rem 1.1rem;text-align:center;flex:1;min-width:70px}
        .kpi-num{font-size:1.6rem;font-weight:900;color:#162a1e;line-height:1}
        .kpi-label{font-size:.62rem;font-weight:700;color:#aaa;text-transform:uppercase;margin-top:.2rem}

        .rel-visitas-table{width:100%;border-collapse:collapse;font-size:.78rem}
        .rel-visitas-table th{text-align:left;font-size:.62rem;color:#aaa;font-weight:700;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #f0ede8;padding:.4rem .5rem}
        .rel-visitas-table td{padding:.45rem .5rem;border-bottom:1px solid #f7f5f0;vertical-align:middle}
        .rel-visitas-table tr:last-child td{border-bottom:none}
        .rel-status-badge{display:inline-block;font-size:.65rem;font-weight:700;padding:.15rem .55rem;border-radius:20px;color:#fff}

        .rel-footer{margin-top:2rem;padding-top:1rem;border-top:1px solid #eae5de;display:flex;align-items:center;justify-content:space-between;font-size:.68rem;color:#aaa}

        @media print {
          .acoes-tela{display:none !important}
          .sidebar,.topbar{display:none !important}
          .main{margin-left:0 !important;width:100% !important}
          .content{padding:0 !important}
          .content > *:not(.relatorio){display:none !important}
          .relatorio{box-shadow:none !important;border-radius:0 !important;padding:1.5rem !important;max-width:100% !important}
          body{background:#fff !important}
        }
      `}</style>

      <div className="acoes-tela">
        <button className="btn-voltar" onClick={() => router.back()}><IconArrowLeft /> Voltar</button>
        <button className="btn-imprimir" onClick={() => window.print()}><IconPrinter /> Imprimir / Salvar PDF</button>
      </div>

      <div className="relatorio">
        <div className="rel-header">
          <div className="rel-logo-area">
            <img src="/logo-aderi.png" alt="Aderi" className="rel-logo-img" />
            <div>
              <div className="rel-logo-texto">aderi <span>agronegócios</span></div>
              <div style={{ fontSize: '.68rem', color: '#aaa', marginTop: '.1rem' }}>Ficha do Produtor</div>
            </div>
          </div>
          <div className="rel-titulo-doc">
            <h2>Relatório de Cliente</h2>
            <p>Gerado em {dataGeracao.toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        <div className="rel-secao">
          <div className="rel-secao-titulo">Dados do Produtor</div>
          <div className="rel-grid">
            <div className="rel-campo rel-campo-full">
              <div className="rel-campo-label">Nome completo</div>
              <div className="rel-campo-valor" style={{ fontSize: '1rem' }}>{cliente.nome}</div>
            </div>
            {cliente.cpf_cnpj && (
              <div className="rel-campo">
                <div className="rel-campo-label">CPF / CNPJ</div>
                <div className="rel-campo-valor">{cliente.cpf_cnpj}</div>
              </div>
            )}
            {cliente.telefone && (
              <div className="rel-campo">
                <div className="rel-campo-label">Telefone</div>
                <div className="rel-campo-valor">{cliente.telefone}</div>
              </div>
            )}
            {cliente.email && (
              <div className="rel-campo rel-campo-full">
                <div className="rel-campo-label">E-mail</div>
                <div className="rel-campo-valor">{cliente.email}</div>
              </div>
            )}
          </div>
        </div>

        {(cliente.nome_fazenda || cliente.cidade || cliente.cultura_principal || cliente.hectares) && (
          <div className="rel-secao">
            <div className="rel-secao-titulo">Dados da Propriedade</div>
            <div className="rel-grid">
              {cliente.nome_fazenda && (
                <div className="rel-campo">
                  <div className="rel-campo-label">Nome da fazenda</div>
                  <div className="rel-campo-valor"><IconSprout color="#162a1e" />{cliente.nome_fazenda}</div>
                </div>
              )}
              {cliente.cidade && (
                <div className="rel-campo">
                  <div className="rel-campo-label">Localização</div>
                  <div className="rel-campo-valor"><IconPin color="#162a1e" />{cliente.cidade}/{cliente.estado}</div>
                </div>
              )}
              {cliente.cultura_principal && (
                <div className="rel-campo">
                  <div className="rel-campo-label">Cultura principal</div>
                  <div className="rel-campo-valor"><IconLeaf color="#162a1e" />{cliente.cultura_principal}</div>
                </div>
              )}
              {cliente.hectares && (
                <div className="rel-campo">
                  <div className="rel-campo-label">Área total</div>
                  <div className="rel-campo-valor"><IconRuler color="#162a1e" />{cliente.hectares} hectares</div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="rel-secao">
          <div className="rel-secao-titulo">Resumo de Atendimentos</div>
          <div className="kpi-row">
            <div className="kpi-box">
              <div className="kpi-num">{totalVisitas}</div>
              <div className="kpi-label">Total</div>
            </div>
            <div className="kpi-box" style={{ background: '#edf7f0' }}>
              <div className="kpi-num" style={{ color: '#27ae60' }}>{realizadas}</div>
              <div className="kpi-label">Realizadas</div>
            </div>
            <div className="kpi-box" style={{ background: '#fdf3e9' }}>
              <div className="kpi-num" style={{ color: '#E67E22' }}>{agendadas}</div>
              <div className="kpi-label">Agendadas</div>
            </div>
            <div className="kpi-box" style={{ background: '#fef0ef' }}>
              <div className="kpi-num" style={{ color: '#e74c3c' }}>{canceladas}</div>
              <div className="kpi-label">Canceladas</div>
            </div>
          </div>

          {ultimaVisita && (
            <div style={{ marginTop: '.8rem', display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.8rem', color: '#555' }}>
              <IconCalendar color="#162a1e" />
              Última visita: <strong>{new Date(ultimaVisita.data_visita + 'T12:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
              <span className="rel-status-badge" style={{ background: statusCor[ultimaVisita.status] || '#aaa' }}>
                {ultimaVisita.status}
              </span>
            </div>
          )}
        </div>

        {recentVisitas.length > 0 && (
          <div className="rel-secao">
            <div className="rel-secao-titulo">Histórico de Visitas</div>
            <table className="rel-visitas-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Motivo</th>
                  <th>Técnico</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentVisitas.map(v => (
                  <tr key={v.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(v.data_visita + 'T12:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ color: '#555' }}>{v.motivo_visita || '—'}</td>
                    <td style={{ color: '#555', whiteSpace: 'nowrap' }}>{v.funcionario?.nome_completo || '—'}</td>
                    <td>
                      <span className="rel-status-badge" style={{ background: statusCor[v.status] || '#aaa' }}>
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visitas.length > 10 && (
              <div style={{ fontSize: '.72rem', color: '#aaa', marginTop: '.5rem', textAlign: 'right' }}>
                Exibindo 10 de {visitas.length} visitas
              </div>
            )}
          </div>
        )}

        <div className="rel-footer">
          <span>Aderi Agronegócios — Piumhi, MG</span>
          <span>Gerado em {dataGeracao.toLocaleDateString('pt-BR')} às {dataGeracao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    </>
  )
}

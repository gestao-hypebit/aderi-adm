'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { SeletorVisao, useVisao } from '@/app/components/AlternarVisao'
import Tabela, { Paginacao, usePaginacao } from '@/app/components/Tabela'
import { linkWhatsApp } from '@/lib/contato'

type Cliente = {
  id: string
  nome: string
  cidade: string | null
  estado: string | null
  nome_fazenda: string | null
  cultura_principal: string | null
  hectares: number | null
  telefone: string | null
  criado_por: string | null
  created_at: string
}

function IconPlus() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function IconPin() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
}
function IconPhone() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
}
function IconUsers() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}

const local = (c: Cliente) => [c.cidade, c.estado].filter(Boolean).join('/')
const area = (c: Cliente) => (c.hectares ? `${Number(c.hectares).toLocaleString('pt-BR')} ha` : '')

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [uid, setUid] = useState('')
  const [erro, setErro] = useState('')
  const [visao, setVisao] = useVisao('dashboard-clientes')
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? ''))
    supabase.from('clientes').select('id, nome, cidade, estado, nome_fazenda, cultura_principal, hectares, telefone, criado_por, created_at').order('nome').then(({ data }) => {
      setClientes(data || [])
      setCarregando(false)
    })
  }, [])

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return t
      ? clientes.filter(c => c.nome.toLowerCase().includes(t) || (c.nome_fazenda ?? '').toLowerCase().includes(t) || (c.cidade ?? '').toLowerCase().includes(t))
      : clientes
  }, [clientes, busca])

  const cards = usePaginacao(filtrados, 24, busca)

  async function excluirCliente(id: string) {
    setErro('')
    const { error } = await supabase.from('clientes').delete().eq('id', id)
    if (error) { setErro('Não foi possível excluir o cliente.'); return }
    setClientes(l => l.filter(c => c.id !== id))
  }
  const totalHa = clientes.reduce((s, c) => s + (Number(c.hectares) || 0), 0)

  const vazio = (
    <div className="ui-empty">
      <div className="ui-empty-icon"><IconUsers /></div>
      <div className="ui-empty-title">{busca ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado ainda'}</div>
      <div className="ui-empty-text">{busca ? 'Tente outro termo de busca.' : 'Cadastre o primeiro produtor da sua carteira.'}</div>
      {!busca && <Link href="/dashboard/clientes/novo" className="ui-btn ui-btn-secondary ui-btn-sm"><IconPlus /> Cadastrar cliente</Link>}
    </div>
  )

  return (
    <>
      <style>{`
        .dc-toolbar{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;margin-bottom:1rem}
        .dc-busca{width:320px !important;padding-left:2.2rem !important;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238f978f' stroke-width='2.2'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'/%3E%3C/svg%3E") no-repeat .8rem center !important}
        .dc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:1rem}
        .dc-card{padding:1.15rem 1.2rem;display:flex;flex-direction:column;gap:.75rem;text-decoration:none;color:#5b6660;font-size:.76rem}
        .dc-tags{display:flex;flex-direction:column;gap:.3rem}
        @media(max-width:700px){.dc-busca{width:100% !important}}
      `}</style>

      <div className="ui-page-header">
        <div>
          <div className="ui-title">Clientes</div>
          <div className="ui-sub">{carregando ? 'Carregando...' : `${clientes.length} produtor${clientes.length !== 1 ? 'es' : ''} na sua carteira${totalHa ? ` · ${totalHa.toLocaleString('pt-BR')} hectares` : ''}`}</div>
        </div>
        <div className="ui-header-actions">
          <Link href="/dashboard/clientes/novo" className="ui-btn ui-btn-primary"><IconPlus /> Novo cliente</Link>
        </div>
      </div>

      {erro && <div className="ui-alert ui-alert-erro">{erro}</div>}
      <div className="dc-toolbar">
        <input className="ui-input dc-busca" placeholder="Buscar por nome, fazenda ou cidade..." value={busca} onChange={e => setBusca(e.target.value)} />
        <div style={{ marginLeft: 'auto' }}><SeletorVisao visao={visao} onChange={setVisao} /></div>
      </div>

      {visao === 'cards' && !carregando ? (
        filtrados.length === 0 ? <div className="ui-card">{vazio}</div> : (
          <>
            <div className="dc-grid">
              {cards.visiveis.map(c => (
                <Link key={c.id} href={`/dashboard/clientes/${c.id}`} className="ui-card ui-card-hover dc-card">
                  <div className="ui-cel">
                    <div className="ui-cel-ini">{c.nome.charAt(0).toUpperCase()}</div>
                    <div className="ui-cel-txt">
                      <div className="ui-cel-titulo">{c.nome}</div>
                      {c.nome_fazenda && <div className="ui-cel-sub laranja">{c.nome_fazenda}</div>}
                    </div>
                  </div>
                  <div className="dc-tags">
                    {local(c) && <span className="ui-cel" style={{ gap: '.35rem' }}><IconPin />{local(c)}</span>}
                    {c.telefone && <span className="ui-cel" style={{ gap: '.35rem' }}><IconPhone />{c.telefone}</span>}
                    {(c.cultura_principal || area(c)) && <span className="ui-cel-sub">{[c.cultura_principal, area(c)].filter(Boolean).join(' · ')}</span>}
                  </div>
                </Link>
              ))}
            </div>
            <Paginacao controle={cards.controle} rotulo="clientes" solta />
          </>
        )
      ) : (
        <Tabela
          linhas={filtrados}
          chave={c => c.id}
          href={c => `/dashboard/clientes/${c.id}`}
          carregando={carregando}
          reiniciar={busca}
          rotulo="clientes"
          vazio={vazio}
          acoes={c => [
            { rotulo: 'Abrir ficha', icone: 'ver', href: `/dashboard/clientes/${c.id}` },
            { rotulo: 'Editar', icone: 'editar', href: `/dashboard/clientes/${c.id}/editar` },
            { rotulo: 'Agendar visita', icone: 'visita', href: `/dashboard/visitas/novo?cliente=${c.id}` },
            { rotulo: 'Nova cotação', icone: 'cotacao', href: `/dashboard/cotacoes/nova?cliente=${c.id}` },
            !!linkWhatsApp(c.telefone) && { rotulo: 'WhatsApp', icone: 'whatsapp', href: linkWhatsApp(c.telefone)!, novaAba: true },
            c.criado_por === uid && { rotulo: 'Excluir', icone: 'excluir', perigo: true, onClick: () => excluirCliente(c.id),
              confirmar: { titulo: `Excluir ${c.nome}?`, botao: 'Excluir cliente', texto: 'O cadastro será apagado junto com as visitas dele. Cotações ficam guardadas sem o vínculo.' } },
          ]}
          colunas={[
            { id: 'cliente', titulo: 'Cliente', ordenar: (a, b) => a.nome.localeCompare(b.nome),
              celula: c => (
                <div className="ui-cel">
                  <div className="ui-cel-ini">{c.nome.charAt(0).toUpperCase()}</div>
                  <div className="ui-cel-txt">
                    <div className="ui-cel-titulo">{c.nome}</div>
                    {c.nome_fazenda && <div className="ui-cel-sub laranja">{c.nome_fazenda}</div>}
                  </div>
                </div>
              ) },
            { id: 'local', titulo: 'Localização', ocultar: 'celular', ordenar: (a, b) => local(a).localeCompare(local(b)),
              celula: c => local(c) || <span className="ui-cel-mudo">—</span> },
            { id: 'cultura', titulo: 'Cultura', ocultar: 'tablet', ordenar: (a, b) => (a.cultura_principal ?? '').localeCompare(b.cultura_principal ?? ''),
              celula: c => c.cultura_principal || <span className="ui-cel-mudo">—</span> },
            { id: 'area', titulo: 'Área', alinhar: 'dir', ordenar: (a, b) => (Number(a.hectares) || 0) - (Number(b.hectares) || 0),
              celula: c => area(c) ? <span className="ui-cel-num">{area(c)}</span> : <span className="ui-cel-mudo">—</span> },
            { id: 'tel', titulo: 'Telefone', ocultar: 'tablet', celula: c => <span className="ui-cel-num">{c.telefone || <span className="ui-cel-mudo">—</span>}</span> },
          ]}
        />
      )}
    </>
  )
}

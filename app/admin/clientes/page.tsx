'use client'

import { hojeISO } from '@/lib/dateUtils'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { baixarCsv, dataBR } from '@/lib/csv'
import { SeletorVisao, useVisao } from '@/app/components/AlternarVisao'
import Tabela, { Paginacao, usePaginacao } from '@/app/components/Tabela'

type Cliente = {
  id: string
  nome: string
  nome_fazenda: string | null
  cidade: string | null
  estado: string | null
  telefone: string | null
  cultura_principal: string | null
  hectares: number | null
  created_at: string | null
  criado_por: string | null
  responsavel_id: string | null
  email: string | null
  cpf_cnpj: string | null
}

type VisitaResumo = {
  cliente_id: string
  funcionario_id: string
  data_visita: string
  status: string
  funcionario: { nome_completo: string } | { nome_completo: string }[] | null
}

type Stat = {
  total: number
  realizadas: number
  ultima: string | null
  ultimoStatus: string | null
  ultimoConsultor: string | null
  proxima: string | null
  consultores: Set<string>
}

type Ordem = 'nome' | 'recentes' | 'sem-visita'

const STATUS_LABEL: Record<string, string> = { agendada: 'Agendada', realizada: 'Realizada', cancelada: 'Cancelada' }

function IconPlus() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function IconPin() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
}
function IconUsers() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}
function IconDownload() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
}

function fmtData(d: string) {
  return new Date(d + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ de /g, ' ').replace('.', '')
}

function diasDesde(d: string) {
  const hoje = new Date()
  hoje.setHours(12, 0, 0, 0)
  return Math.round((hoje.getTime() - new Date(d + 'T12:00').getTime()) / 86400000)
}

function UltimaVisita({ s }: { s?: Stat }) {
  if (s?.ultima) {
    const dias = diasDesde(s.ultima)
    return (
      <div className="ui-cel-txt">
        <div className="ui-cel-forte" style={{ fontSize: '.78rem' }}>
          {fmtData(s.ultima)}
          {dias > 60 && <span className="ui-badge ui-badge-agendada" style={{ marginLeft: '.45rem' }}>{dias} dias</span>}
        </div>
        <div className="ui-cel-sub">{s.ultimoConsultor ?? '—'}{s.ultimoStatus ? ` · ${STATUS_LABEL[s.ultimoStatus] ?? s.ultimoStatus}` : ''}</div>
      </div>
    )
  }
  if (s?.proxima) return <div className="ui-cel-sub">Primeira visita em {fmtData(s.proxima)}</div>
  return <span className="ui-cel-mudo" style={{ fontStyle: 'italic', fontSize: '.76rem' }}>Nunca visitado</span>
}

function AdminClientesConteudo() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const [consultores, setConsultores] = useState<{ id: string; nome_completo: string | null }[]>([])
  const [filtroConsultor, setFiltroConsultor] = useState(() => searchParams.get('func') ?? '')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [stats, setStats] = useState<Map<string, Stat>>(new Map())
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState<Ordem>('nome')
  const [visao, setVisao] = useVisao('admin-clientes')

  useEffect(() => {
    async function carregar() {
      const hoje = hojeISO()
      const [{ data: clis }, { data: visitas }, { data: colabs }] = await Promise.all([
        supabase
          .from('clientes')
          .select('id, nome, nome_fazenda, cidade, estado, telefone, cultura_principal, hectares, created_at, criado_por, responsavel_id, email, cpf_cnpj')
          .order('nome'),
        supabase
          .from('visitas')
          .select('cliente_id, funcionario_id, data_visita, status, funcionario:profiles(nome_completo)')
          .order('data_visita', { ascending: false }),
        supabase.from('profiles').select('id, nome_completo').order('nome_completo'),
      ])
      setConsultores(colabs ?? [])

      const map = new Map<string, Stat>()
      ;((visitas ?? []) as VisitaResumo[]).forEach(v => {
        if (!v.cliente_id) return
        if (!map.has(v.cliente_id)) {
          map.set(v.cliente_id, { total: 0, realizadas: 0, ultima: null, ultimoStatus: null, ultimoConsultor: null, proxima: null, consultores: new Set() })
        }
        const s = map.get(v.cliente_id)!
        s.total++
        s.consultores.add(v.funcionario_id)
        if (v.status === 'realizada') s.realizadas++
        if (v.status === 'agendada' && v.data_visita >= hoje && (!s.proxima || v.data_visita < s.proxima)) s.proxima = v.data_visita
        // a lista vem ordenada por data desc: a primeira visita até hoje é a última realizada/registrada
        if (!s.ultima && v.data_visita <= hoje) {
          const f = Array.isArray(v.funcionario) ? v.funcionario[0] : v.funcionario
          s.ultima = v.data_visita
          s.ultimoStatus = v.status
          s.ultimoConsultor = f?.nome_completo ?? null
        }
      })

      setClientes(clis ?? [])
      setStats(map)
      setCarregando(false)
    }
    carregar()
  }, [])

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const filtrados = clientes.filter(c =>
      (!termo ||
        c.nome.toLowerCase().includes(termo) ||
        (c.nome_fazenda ?? '').toLowerCase().includes(termo) ||
        (c.cidade ?? '').toLowerCase().includes(termo)) &&
      (!filtroConsultor || c.responsavel_id === filtroConsultor || c.criado_por === filtroConsultor || stats.get(c.id)?.consultores.has(filtroConsultor))
    )
    if (ordem === 'recentes') {
      return [...filtrados].sort((a, b) => (stats.get(b.id)?.ultima ?? '').localeCompare(stats.get(a.id)?.ultima ?? ''))
    }
    if (ordem === 'sem-visita') {
      return filtrados
        .filter(c => !stats.get(c.id)?.ultima || diasDesde(stats.get(c.id)!.ultima!) > 60)
        .sort((a, b) => (stats.get(a.id)?.ultima ?? '').localeCompare(stats.get(b.id)?.ultima ?? ''))
    }
    return filtrados
  }, [clientes, stats, busca, ordem, filtroConsultor])

  const nomeConsultor = useMemo(() => new Map(consultores.map(c => [c.id, c.nome_completo ?? ''])), [consultores])
  const cardsPag = usePaginacao(lista, 24, `${busca}|${filtroConsultor}|${ordem}`)

  function exportar() {
    baixarCsv(
      `clientes-aderi-${hojeISO()}`,
      ['Nome', 'Fazenda', 'Responsável', 'CPF/CNPJ', 'Telefone', 'E-mail', 'Cidade', 'UF', 'Cultura', 'Hectares', 'Visitas', 'Realizadas', 'Última visita', 'Último consultor', 'Próxima visita'],
      lista.map(c => {
        const st = stats.get(c.id)
        return [c.nome, c.nome_fazenda, nomeConsultor.get(c.responsavel_id ?? '') ?? '', c.cpf_cnpj, c.telefone, c.email, c.cidade, c.estado, c.cultura_principal,
          c.hectares, st?.total ?? 0, st?.realizadas ?? 0, dataBR(st?.ultima), st?.ultimoConsultor, dataBR(st?.proxima)]
      })
    )
  }

  const totalSemVisita = clientes.filter(c => !stats.get(c.id)?.ultima || diasDesde(stats.get(c.id)!.ultima!) > 60).length
  const totalComAgendada = clientes.filter(c => stats.get(c.id)?.proxima).length

  return (
    <>
      <style>{`
        .cl-toolbar{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;margin-bottom:1rem}
        .cl-consultor{min-width:190px;padding-top:.62rem !important;padding-bottom:.62rem !important}
        .cl-busca{width:300px !important;padding-left:2.2rem !important;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238f978f' stroke-width='2.2'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'/%3E%3C/svg%3E") no-repeat .8rem center !important}
        .cl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:1rem}
        .cl-card{padding:1.15rem 1.2rem;display:flex;flex-direction:column;gap:.85rem;text-decoration:none;min-width:0;color:#5b6660}
        .cl-card-rodape{display:flex;justify-content:space-between;align-items:flex-end;gap:.6rem;padding-top:.75rem;border-top:1px solid #f2efea;margin-top:auto}
        @media(max-width:700px){.cl-busca,.cl-consultor{width:100% !important}.cl-toolbar .ui-segmented{width:100%;margin-left:0 !important}.cl-toolbar .ui-segmented button{flex:1;justify-content:center}}
      `}</style>

      <div className="ui-page-header">
        <div>
          <div className="ui-title">Clientes</div>
          <div className="ui-sub">
            {carregando
              ? 'Carregando carteira...'
              : `${clientes.length} produtor${clientes.length !== 1 ? 'es' : ''} na carteira · ${totalComAgendada} com visita agendada`}
          </div>
        </div>
        <div className="ui-header-actions">
          <button className="ui-btn ui-btn-secondary" onClick={exportar} disabled={carregando || lista.length === 0}><IconDownload /> Exportar</button>
          <Link href="/admin/clientes/novo" className="ui-btn ui-btn-primary"><IconPlus /> Novo cliente</Link>
        </div>
      </div>

      <div className="cl-toolbar">
        <input
          className="ui-input cl-busca"
          placeholder="Buscar por nome, fazenda ou cidade..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        <select className="ui-select ui-select-sm cl-consultor" value={filtroConsultor} onChange={e => setFiltroConsultor(e.target.value)} aria-label="Filtrar por consultor">
          <option value="">Todos os consultores</option>
          {consultores.map(c => <option key={c.id} value={c.id}>{c.nome_completo}</option>)}
        </select>
        <div className="ui-segmented" role="tablist" aria-label="Ordenar clientes" style={{ marginLeft: 'auto' }}>
          <button role="tab" aria-selected={ordem === 'nome'} className={ordem === 'nome' ? 'ativo' : ''} onClick={() => setOrdem('nome')}>A–Z</button>
          <button role="tab" aria-selected={ordem === 'recentes'} className={ordem === 'recentes' ? 'ativo' : ''} onClick={() => setOrdem('recentes')}>Visitados recentemente</button>
          <button role="tab" aria-selected={ordem === 'sem-visita'} className={ordem === 'sem-visita' ? 'ativo' : ''} onClick={() => setOrdem('sem-visita')}>
            Sem visita há 60+ dias <span className="ui-count">{carregando ? '·' : totalSemVisita}</span>
          </button>
        </div>
        <SeletorVisao visao={visao} onChange={setVisao} />
      </div>

      {visao === 'cards' && !carregando && lista.length > 0 ? (
        <>
          <div className="cl-grid">
            {cardsPag.visiveis.map(c => {
              const s = stats.get(c.id)
              const local = [c.cidade, c.estado].filter(Boolean).join('/')
              return (
                <Link key={c.id} href={`/admin/clientes/${c.id}`} className="ui-card ui-card-hover cl-card">
                  <div className="ui-cel">
                    <div className="ui-cel-ini">{c.nome.charAt(0).toUpperCase()}</div>
                    <div className="ui-cel-txt">
                      <div className="ui-cel-titulo">{c.nome}</div>
                      {c.nome_fazenda && <div className="ui-cel-sub laranja">{c.nome_fazenda}</div>}
                    </div>
                  </div>
                  <div>
                    <div className="ui-cel" style={{ gap: '.35rem', fontSize: '.76rem' }}><IconPin />{local || '—'}</div>
                    {c.cultura_principal && <div className="ui-cel-sub">{c.cultura_principal}{c.hectares ? ` · ${c.hectares.toLocaleString('pt-BR')} ha` : ''}</div>}
                  </div>
                  <div className="cl-card-rodape">
                    <UltimaVisita s={s} />
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="ui-cel-forte">{s?.total ?? 0}</div>
                      <div className="ui-cel-sub">{s?.realizadas ?? 0} realizada{(s?.realizadas ?? 0) !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
          <Paginacao controle={cardsPag.controle} rotulo="clientes" solta />
        </>
      ) : (
        <Tabela
          linhas={lista}
          chave={c => c.id}
          href={c => `/admin/clientes/${c.id}`}
          carregando={carregando}
          reiniciar={`${busca}|${filtroConsultor}|${ordem}`}
          rotulo="clientes"
          vazio={
            <div className="ui-empty">
              <div className="ui-empty-icon"><IconUsers /></div>
              <div className="ui-empty-title">{clientes.length === 0 ? 'Nenhum cliente cadastrado' : 'Nenhum cliente encontrado'}</div>
              <div className="ui-empty-text">
                {clientes.length === 0
                  ? 'Cadastre o primeiro produtor para começar a agendar visitas.'
                  : ordem === 'sem-visita' ? 'Todos os clientes foram visitados nos últimos 60 dias.' : 'Tente outro termo de busca.'}
              </div>
              {clientes.length === 0 && <Link href="/admin/clientes/novo" className="ui-btn ui-btn-secondary ui-btn-sm"><IconPlus /> Novo cliente</Link>}
            </div>
          }
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
            { id: 'local', titulo: 'Localização', ocultar: 'tablet', ordenar: (a, b) => (a.cidade ?? '').localeCompare(b.cidade ?? ''),
              celula: c => (
                <div className="ui-cel-txt">
                  <div className="ui-cel" style={{ gap: '.35rem' }}><IconPin />{[c.cidade, c.estado].filter(Boolean).join('/') || '—'}</div>
                  {c.cultura_principal && <div className="ui-cel-sub">{c.cultura_principal}{c.hectares ? ` · ${c.hectares.toLocaleString('pt-BR')} ha` : ''}</div>}
                </div>
              ) },
            { id: 'resp', titulo: 'Responsável', ocultar: 'tablet', ordenar: (a, b) => (nomeConsultor.get(a.responsavel_id ?? '') ?? '').localeCompare(nomeConsultor.get(b.responsavel_id ?? '') ?? ''),
              celula: c => c.responsavel_id && nomeConsultor.get(c.responsavel_id) ? <span>{nomeConsultor.get(c.responsavel_id)}</span> : <span className="ui-cel-mudo">Sem responsável</span> },
            { id: 'contato', titulo: 'Telefone', ocultar: 'tablet', celula: c => <span className="ui-cel-num">{c.telefone || <span className="ui-cel-mudo">—</span>}</span> },
            { id: 'ultima', titulo: 'Última visita', ocultar: 'celular', ordenar: (a, b) => (stats.get(a.id)?.ultima ?? '').localeCompare(stats.get(b.id)?.ultima ?? ''),
              celula: c => <UltimaVisita s={stats.get(c.id)} /> },
            { id: 'visitas', titulo: 'Visitas', alinhar: 'dir', largura: '110px', ordenar: (a, b) => (stats.get(a.id)?.total ?? 0) - (stats.get(b.id)?.total ?? 0),
              celula: c => <><div className="ui-cel-forte ui-cel-num">{stats.get(c.id)?.total ?? 0}</div><div className="ui-cel-sub">{stats.get(c.id)?.realizadas ?? 0} realizada{(stats.get(c.id)?.realizadas ?? 0) !== 1 ? 's' : ''}</div></> },
          ]}
        />
      )}
    </>
  )
}

export default function AdminClientesPage() {
  return (
    <Suspense fallback={null}>
      <AdminClientesConteudo />
    </Suspense>
  )
}

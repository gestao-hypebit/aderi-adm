'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { baixarCsv, dataBR } from '@/lib/csv'

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
function IconSprout({ color = 'currentColor' }: { color?: string }) {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M7 20h10"/><path d="M10 20c0-4 .5-8 2-10"/><path d="M14 20c0-4-.5-8-2-10"/><path d="M5 5c1.5 0 3 1 3.5 3C7 8 5 7.5 4 6c-.5-1 0-1 1-1z"/><path d="M19 8c-1.5 0-3 .5-4 2 1.5 1 3 1 4 0 1-.5 1-1.5 0-2z"/></svg>
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
function IconChevron() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="9 18 15 12 9 6"/></svg>
}

function fmtData(d: string) {
  return new Date(d + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ de /g, ' ').replace('.', '')
}

function diasDesde(d: string) {
  const hoje = new Date()
  hoje.setHours(12, 0, 0, 0)
  return Math.round((hoje.getTime() - new Date(d + 'T12:00').getTime()) / 86400000)
}

function AdminClientesConteudo() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const [consultores, setConsultores] = useState<{ id: string; nome_completo: string | null }[]>([])
  const [filtroConsultor, setFiltroConsultor] = useState(() => searchParams.get('func') ?? '')
  const [mostrar, setMostrar] = useState(50)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [stats, setStats] = useState<Map<string, Stat>>(new Map())
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState<Ordem>('nome')

  useEffect(() => {
    async function carregar() {
      const hoje = new Date().toISOString().slice(0, 10)
      const [{ data: clis }, { data: visitas }, { data: colabs }] = await Promise.all([
        supabase
          .from('clientes')
          .select('id, nome, nome_fazenda, cidade, estado, telefone, cultura_principal, hectares, created_at, criado_por, email, cpf_cnpj')
          .order('nome'),
        supabase
          .from('visitas')
          .select('cliente_id, funcionario_id, data_visita, status, funcionario:profiles(nome_completo)')
          .order('data_visita', { ascending: false }),
        supabase.from('profiles').select('id, nome_completo').eq('role', 'colaborador').order('nome_completo'),
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
      (!filtroConsultor || c.criado_por === filtroConsultor || stats.get(c.id)?.consultores.has(filtroConsultor))
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

  function exportar() {
    baixarCsv(
      `clientes-aderi-${new Date().toISOString().slice(0, 10)}`,
      ['Nome', 'Fazenda', 'CPF/CNPJ', 'Telefone', 'E-mail', 'Cidade', 'UF', 'Cultura', 'Hectares', 'Visitas', 'Realizadas', 'Última visita', 'Último consultor', 'Próxima visita'],
      lista.map(c => {
        const st = stats.get(c.id)
        return [c.nome, c.nome_fazenda, c.cpf_cnpj, c.telefone, c.email, c.cidade, c.estado, c.cultura_principal,
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
        .cl-mais{display:block;width:100%;padding:.85rem;border:none;border-top:1px solid #f2efea;background:#faf8f5;font-family:'Comfortaa',sans-serif;font-size:.76rem;font-weight:700;color:#E67E22;cursor:pointer}
        .cl-mais:hover{background:#fdf3e9}
        .cl-busca{width:300px !important;padding-left:2.2rem !important;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238f978f' stroke-width='2.2'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'/%3E%3C/svg%3E") no-repeat .8rem center !important}
        .cl-lista{overflow:hidden}
        .cl-header,.cl-row{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr) minmax(0,1.1fr) 120px 18px;gap:1rem;align-items:center;padding:0 1.4rem}
        .cl-header{padding-top:.7rem;padding-bottom:.7rem;background:#faf8f5;font-size:.62rem;font-weight:700;color:#8f978f;letter-spacing:.08em;text-transform:uppercase;border-bottom:1px solid #f2efea}
        .cl-row{padding-top:.85rem;padding-bottom:.85rem;border-bottom:1px solid #f2efea;text-decoration:none;transition:background .15s}
        .cl-row:last-child{border-bottom:none}
        .cl-row:hover{background:#fcfaf7}
        .cl-row:hover .cl-chevron{color:#E67E22;transform:translateX(2px)}
        .cl-cliente{display:flex;align-items:center;gap:.75rem;min-width:0}
        .cl-inicial{width:36px;height:36px;border-radius:10px;background:#fdf3e9;color:#E67E22;font-weight:700;font-size:.85rem;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .cl-nome{font-size:.84rem;font-weight:700;color:#162a1e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .cl-sub{display:flex;align-items:center;gap:.3rem;font-size:.7rem;color:#E67E22;font-weight:700;margin-top:.15rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .cl-local{display:flex;align-items:center;gap:.35rem;font-size:.76rem;color:#5b6660;min-width:0}
        .cl-local span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .cl-cultura{font-size:.68rem;color:#8f978f;margin-top:.15rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .cl-ultima{font-size:.76rem;color:#162a1e;font-weight:700}
        .cl-ultima-sub{font-size:.68rem;color:#8f978f;margin-top:.15rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .cl-nunca{font-size:.74rem;color:#b8bdb6;font-style:italic}
        .cl-visitas{font-size:.84rem;font-weight:700;color:#162a1e}
        .cl-visitas small{display:block;font-size:.66rem;color:#8f978f;font-weight:700;margin-top:.1rem}
        .cl-chevron{color:#d4d0c9;transition:all .15s;display:flex}
        @media(max-width:900px){
          .cl-header{display:none}
          .cl-row{grid-template-columns:1fr auto;gap:.5rem .8rem;padding:.9rem 1.1rem}
          .cl-c-local,.cl-chevron{display:none}
          .cl-c-ultima{grid-column:1/-1;padding-left:calc(36px + .75rem)}
        }
        @media(max-width:700px){.cl-busca,.cl-consultor{width:100% !important}.cl-toolbar .ui-segmented{width:100%;margin-left:0 !important}}
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
          onChange={e => { setBusca(e.target.value); setMostrar(50) }}
        />
        <select className="ui-select ui-select-sm cl-consultor" value={filtroConsultor} onChange={e => { setFiltroConsultor(e.target.value); setMostrar(50) }} aria-label="Filtrar por consultor">
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
      </div>

      <div className="ui-card cl-lista">
        <div className="cl-header">
          <span>Cliente</span><span>Localização</span><span>Última visita</span><span>Visitas</span><span />
        </div>

        {carregando ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="cl-row" style={{ pointerEvents: 'none' }}>
              <div className="cl-cliente"><div className="ui-skeleton" style={{ width: 36, height: 36, borderRadius: 10 }} /><div className="ui-skeleton" style={{ height: 14, width: '60%' }} /></div>
              <div className="ui-skeleton" style={{ height: 14, width: '70%' }} />
              <div className="ui-skeleton" style={{ height: 14, width: '60%' }} />
              <div className="ui-skeleton" style={{ height: 14, width: 40 }} />
              <span />
            </div>
          ))
        ) : lista.length === 0 ? (
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
        ) : (
          lista.slice(0, mostrar).map(c => {
            const s = stats.get(c.id)
            const local = [c.cidade, c.estado].filter(Boolean).join('/')
            const dias = s?.ultima ? diasDesde(s.ultima) : null
            return (
              <Link key={c.id} href={`/admin/clientes/${c.id}`} className="cl-row">
                <div className="cl-cliente">
                  <div className="cl-inicial">{c.nome.charAt(0).toUpperCase()}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="cl-nome">{c.nome}</div>
                    {c.nome_fazenda && <div className="cl-sub"><IconSprout color="#E67E22" />{c.nome_fazenda}</div>}
                  </div>
                </div>
                <div className="cl-c-local" style={{ minWidth: 0 }}>
                  <div className="cl-local"><IconPin /><span>{local || '—'}</span></div>
                  {c.cultura_principal && <div className="cl-cultura">{c.cultura_principal}{c.hectares ? ` · ${c.hectares.toLocaleString('pt-BR')} ha` : ''}</div>}
                </div>
                <div className="cl-c-ultima" style={{ minWidth: 0 }}>
                  {s?.ultima ? (
                    <>
                      <div className="cl-ultima">
                        {fmtData(s.ultima)}
                        {dias != null && dias > 60 && <span className="ui-badge ui-badge-agendada" style={{ marginLeft: '.45rem' }}>{dias} dias</span>}
                      </div>
                      <div className="cl-ultima-sub">
                        {s.ultimoConsultor ?? '—'}{s.ultimoStatus ? ` · ${STATUS_LABEL[s.ultimoStatus] ?? s.ultimoStatus}` : ''}
                      </div>
                    </>
                  ) : s?.proxima ? (
                    <div className="cl-ultima-sub">Primeira visita em {fmtData(s.proxima)}</div>
                  ) : (
                    <div className="cl-nunca">Nunca visitado</div>
                  )}
                </div>
                <div className="cl-visitas">
                  {s?.total ?? 0}
                  <small>{s?.realizadas ?? 0} realizada{(s?.realizadas ?? 0) !== 1 ? 's' : ''}</small>
                </div>
                <span className="cl-chevron"><IconChevron /></span>
              </Link>
            )
          })
        )}
        {!carregando && lista.length > mostrar && (
          <button className="cl-mais" onClick={() => setMostrar(m => m + 50)}>
            Mostrar mais ({lista.length - mostrar} restantes)
          </button>
        )}
      </div>
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

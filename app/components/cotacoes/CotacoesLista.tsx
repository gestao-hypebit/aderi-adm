'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { SeletorVisao, useVisao } from '@/app/components/AlternarVisao'
import Tabela, { Paginacao, usePaginacao } from '@/app/components/Tabela'
import { STATUS_COTACAO, calcularTotais, itemDoBanco, parametrosDoBanco, brl, pct } from '@/lib/cotacao'

type Linha = {
  id: string
  numero: string
  status: string
  cliente_nome: string | null
  empresa_rural: string | null
  cidade: string | null
  created_at: string
  criado_por: string
  autor: string
  qtdItens: number
  venda: number
  resultado: number
  pctResultado: number
}

function IconPlus() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function IconDoc() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>
}
function IconBox() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
}

const fmtData = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ de /g, ' ').replace('.', '')

export default function CotacoesLista({ base }: { base: string }) {
  const supabase = createClient()
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [admin, setAdmin] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState('')
  const [consultor, setConsultor] = useState('')
  const [visao, setVisao] = useVisao(`cotacoes-${base}`)

  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      const [{ data: perfil }, { data: cots }] = await Promise.all([
        supabase.from('profiles').select('role').eq('id', user?.id ?? '').single(),
        supabase
          .from('cotacoes')
          .select('id, numero, status, cliente_nome, empresa_rural, cidade, created_at, criado_por, ptax, juros_mes, aliquota_icms, aliquota_ir, autor:profiles(nome_completo), itens:cotacao_itens(*)')
          .order('created_at', { ascending: false }),
      ])
      setAdmin(perfil?.role === 'admin')
      setLinhas((cots ?? []).map(c => {
        const a = Array.isArray(c.autor) ? c.autor[0] : c.autor
        const itens = ((c.itens ?? []) as Record<string, unknown>[]).map(itemDoBanco)
        const t = calcularTotais(itens, parametrosDoBanco(c))
        return {
          id: c.id, numero: c.numero, status: c.status, cliente_nome: c.cliente_nome, empresa_rural: c.empresa_rural, cidade: c.cidade,
          created_at: c.created_at, criado_por: c.criado_por, autor: a?.nome_completo ?? '—', qtdItens: itens.length,
          venda: t.venda, resultado: t.resultado, pctResultado: t.pctResultado,
        }
      }))
      setCarregando(false)
    }
    carregar()
  }, [])

  const consultores = useMemo(() => {
    const m = new Map<string, string>()
    linhas.forEach(l => m.set(l.criado_por, l.autor))
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [linhas])

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return linhas.filter(l =>
      (!status || l.status === status) &&
      (!consultor || l.criado_por === consultor) &&
      (!t || l.numero.includes(t) || (l.cliente_nome ?? '').toLowerCase().includes(t) || (l.empresa_rural ?? '').toLowerCase().includes(t) || (l.cidade ?? '').toLowerCase().includes(t))
    )
  }, [linhas, busca, status, consultor])

  const cards = usePaginacao(lista, 24, `${busca}|${status}|${consultor}`)
  const contagem = (s: string) => linhas.filter(l => l.status === s).length
  const totalAprovado = linhas.filter(l => l.status === 'aprovada').reduce((s, l) => s + l.venda, 0)

  return (
    <>
      <style>{`
        .cq-toolbar{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;margin-bottom:1rem}
        .cq-busca{width:280px !important}
        .cq-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:1rem}
        .cq-card{padding:1.1rem 1.2rem;display:flex;flex-direction:column;gap:.75rem;text-decoration:none;color:#162a1e}
        .cq-card-top{display:flex;justify-content:space-between;align-items:center;gap:.5rem}
        .cq-card-valor{font-size:1.15rem;font-weight:600}
        @media(max-width:700px){.cq-busca{width:100% !important}}
      `}</style>

      <div className="ui-page-header">
        <div>
          <div className="ui-title">Cotações</div>
          <div className="ui-sub">
            {carregando ? 'Carregando...' : `${linhas.length} cotaç${linhas.length !== 1 ? 'ões' : 'ão'} · ${contagem('aprovada')} aprovada${contagem('aprovada') !== 1 ? 's' : ''} (${brl(totalAprovado)})`}
          </div>
        </div>
        <div className="ui-header-actions">
          {admin && base.startsWith('/admin') && <Link href="/admin/produtos" className="ui-btn ui-btn-secondary"><IconBox /> Produtos</Link>}
          <Link href={`${base}/nova`} className="ui-btn ui-btn-primary"><IconPlus /> Nova cotação</Link>
        </div>
      </div>

      <div className="cq-toolbar">
        <input className="ui-input cq-busca" placeholder="Buscar nº, cliente, fazenda ou cidade..." value={busca} onChange={e => setBusca(e.target.value)} />
        {admin && consultores.length > 1 && (
          <select className="ui-select ui-select-sm" value={consultor} onChange={e => setConsultor(e.target.value)} aria-label="Filtrar por consultor">
            <option value="">Todos os consultores</option>
            {consultores.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </select>
        )}
        <div className="ui-segmented" role="tablist" aria-label="Filtrar por status" style={{ marginLeft: 'auto' }}>
          <button className={!status ? 'ativo' : ''} onClick={() => setStatus('')}>Todas</button>
          {Object.entries(STATUS_COTACAO).map(([k, v]) => (
            <button key={k} className={status === k ? 'ativo' : ''} onClick={() => setStatus(k)}>{v.label} <span className="ui-count">{contagem(k)}</span></button>
          ))}
        </div>
        <SeletorVisao visao={visao} onChange={setVisao} />
      </div>

      {visao === 'cards' && !carregando && lista.length > 0 ? (
        <>
          <div className="cq-grid">
            {cards.visiveis.map(l => {
              const st = STATUS_COTACAO[l.status] ?? STATUS_COTACAO.rascunho
              return (
                <Link key={l.id} href={`${base}/${l.id}`} className="ui-card ui-card-hover cq-card">
                  <div className="cq-card-top"><span className="ui-cel-forte">Nº {l.numero}</span><span className={`ui-badge ${st.badge}`}>{st.label}</span></div>
                  <div className="ui-cel-txt">
                    <div className="ui-cel-titulo">{l.cliente_nome || 'Sem cliente'}</div>
                    <div className="ui-cel-sub">{[l.empresa_rural, l.cidade].filter(Boolean).join(' · ') || '—'}</div>
                  </div>
                  <div className="cq-card-top" style={{ alignItems: 'flex-end' }}>
                    <div>
                      <div className="cq-card-valor">{brl(l.venda)}</div>
                      <div className="ui-cel-sub">{l.qtdItens} produto{l.qtdItens !== 1 ? 's' : ''} · {fmtData(l.created_at)}</div>
                    </div>
                    {admin && <div className="ui-cel-forte" style={{ color: l.resultado < 0 ? '#c0392b' : '#1e8a4c', fontSize: '.78rem' }}>{pct(l.pctResultado, 2)}</div>}
                  </div>
                  {admin && <div className="ui-cel-sub" style={{ marginTop: 0 }}>{l.autor}</div>}
                </Link>
              )
            })}
          </div>
          <Paginacao controle={cards.controle} rotulo="cotações" solta />
        </>
      ) : (
        <Tabela
          linhas={lista}
          chave={l => l.id}
          href={l => `${base}/${l.id}`}
          carregando={carregando}
          reiniciar={`${busca}|${status}|${consultor}`}
          rotulo="cotações"
          vazio={
            <div className="ui-empty">
              <div className="ui-empty-icon"><IconDoc /></div>
              <div className="ui-empty-title">{linhas.length === 0 ? 'Nenhuma cotação ainda' : 'Nenhuma cotação encontrada'}</div>
              <div className="ui-empty-text">{linhas.length === 0 ? 'Crie a primeira cotação para gerar orçamento e pedido do cliente.' : 'Ajuste a busca ou os filtros.'}</div>
              {linhas.length === 0 && <Link href={`${base}/nova`} className="ui-btn ui-btn-secondary ui-btn-sm"><IconPlus /> Nova cotação</Link>}
            </div>
          }
          colunas={[
            { id: 'num', titulo: 'Número', largura: '120px', ordenar: (a, b) => a.numero.localeCompare(b.numero),
              celula: l => <><div className="ui-cel-forte ui-cel-num">{l.numero}</div><div className="ui-cel-sub">{l.qtdItens} produto{l.qtdItens !== 1 ? 's' : ''}</div></> },
            { id: 'cli', titulo: 'Cliente', ordenar: (a, b) => (a.cliente_nome ?? '').localeCompare(b.cliente_nome ?? ''),
              celula: l => <div className="ui-cel-txt"><div className="ui-cel-titulo">{l.cliente_nome || 'Sem cliente'}</div><div className="ui-cel-sub">{[l.empresa_rural, l.cidade].filter(Boolean).join(' · ') || '—'}</div></div> },
            ...(admin ? [{ id: 'autor', titulo: 'Consultor', ocultar: 'tablet' as const, ordenar: (a: Linha, b: Linha) => a.autor.localeCompare(b.autor),
              celula: (l: Linha) => <span>{l.autor}</span> }] : []),
            { id: 'data', titulo: 'Data', ocultar: 'celular', ordenar: (a, b) => a.created_at.localeCompare(b.created_at), celula: l => <span className="ui-cel-num">{fmtData(l.created_at)}</span> },
            { id: 'total', titulo: 'Total', alinhar: 'dir', ordenar: (a, b) => a.venda - b.venda, celula: l => <span className="ui-cel-num ui-cel-forte">{brl(l.venda)}</span> },
            ...(admin ? [{ id: 'res', titulo: 'Resultado', alinhar: 'dir' as const, ocultar: 'tablet' as const, ordenar: (a: Linha, b: Linha) => a.resultado - b.resultado,
              celula: (l: Linha) => <><div className="ui-cel-num ui-cel-forte" style={{ color: l.resultado < 0 ? '#c0392b' : '#1e8a4c' }}>{brl(l.resultado)}</div><div className="ui-cel-sub">{pct(l.pctResultado, 2)}</div></> }] : []),
            { id: 'status', titulo: 'Status', largura: '110px', ordenar: (a, b) => a.status.localeCompare(b.status),
              celula: l => { const st = STATUS_COTACAO[l.status] ?? STATUS_COTACAO.rascunho; return <span className={`ui-badge ${st.badge}`}>{st.label}</span> } },
          ]}
        />
      )}
    </>
  )
}

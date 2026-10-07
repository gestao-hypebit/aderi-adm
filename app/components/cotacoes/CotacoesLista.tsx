'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { SeletorVisao, useVisao } from '@/app/components/AlternarVisao'
import Tabela, { Paginacao, usePaginacao } from '@/app/components/Tabela'
import { STATUS_COTACAO, PEDIDO_STATUS, calcularTotais, itemDoBanco, parametrosDoBanco, brl, pct } from '@/lib/cotacao'
import { hojeISO } from '@/lib/dateUtils'
import NumInput from './NumInput'

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
  aprovacao_status: string | null
  enviada_em: string | null
  validade: string | null
  pedido_status: string | null
  pagamento_status: string | null
}

type Alerta = { txt: string; cls: string }
type Config = { margem_minima: number; validade_cotacao_dias: number; dias_followup: number }
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(ate.slice(0, 10)) - Date.parse(de.slice(0, 10))) / 86400000)

// Situações que pedem ação: aprovação de preço, follow-up, validade e pedidos em andamento
function alertasDe(l: Linha, cfg: Config): { alertas: Alerta[]; aprovacao: boolean; followup: boolean; pedido: boolean } {
  const hoje = hojeISO()
  const alertas: Alerta[] = []
  const aprovacao = l.aprovacao_status === 'pendente'
  if (aprovacao) alertas.push({ txt: 'Aguardando aprovação de preço', cls: 'ui-badge-agendada' })
  if (l.aprovacao_status === 'reprovada' && l.status === 'rascunho') alertas.push({ txt: 'Preço reprovado', cls: 'ui-badge-cancelada' })
  let followup = false
  if (l.status === 'enviada' && l.enviada_em) {
    const d = diasEntre(l.enviada_em, hoje)
    if (d >= cfg.dias_followup) { followup = true; alertas.push({ txt: `Enviada há ${d} dias`, cls: 'ui-badge-agendada' }) }
  }
  if (l.validade && (l.status === 'rascunho' || l.status === 'enviada')) {
    const d = diasEntre(hoje, l.validade)
    if (d < 0) { followup = true; alertas.push({ txt: 'Validade vencida', cls: 'ui-badge-cancelada' }) }
    else if (d <= 2) { followup = true; alertas.push({ txt: d === 0 ? 'Vence hoje' : `Vence em ${d} dia${d > 1 ? 's' : ''}`, cls: 'ui-badge-agendada' }) }
  }
  const pedido = l.status === 'aprovada' && (l.pedido_status !== 'entregue' && l.pedido_status !== 'cancelado' || l.pagamento_status !== 'pago')
  if (l.status === 'aprovada' && l.pedido_status) alertas.push({ txt: `Pedido: ${PEDIDO_STATUS[l.pedido_status]}${l.pagamento_status === 'pago' ? ' · pago' : ''}`, cls: l.pedido_status === 'entregue' && l.pagamento_status === 'pago' ? 'ui-badge-realizada' : 'ui-badge-neutro' })
  return { alertas, aprovacao, followup, pedido }
}

function IconPlus() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function IconDoc() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>
}
function IconGear() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
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
  const [config, setConfig] = useState<Config>({ margem_minima: 0, validade_cotacao_dias: 7, dias_followup: 3 })
  const [configAberta, setConfigAberta] = useState(false)
  const [configForm, setConfigForm] = useState<Config>(config)
  const [salvandoConfig, setSalvandoConfig] = useState(false)

  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      const [{ data: perfil }, { data: cots }, { data: cfg }] = await Promise.all([
        supabase.from('profiles').select('role').eq('id', user?.id ?? '').single(),
        supabase
          .from('cotacoes')
          .select('id, numero, status, cliente_nome, empresa_rural, cidade, created_at, criado_por, ptax, juros_mes, aliquota_icms, aliquota_ir, aprovacao_status, enviada_em, validade, pedido_status, pagamento_status, autor:profiles!cotacoes_criado_por_fkey(nome_completo), itens:cotacao_itens(*)')
          .order('created_at', { ascending: false }),
        supabase.from('configuracoes').select('margem_minima, validade_cotacao_dias, dias_followup').eq('id', 1).maybeSingle(),
      ])
      if (cfg) setConfig({ margem_minima: Number(cfg.margem_minima), validade_cotacao_dias: cfg.validade_cotacao_dias, dias_followup: cfg.dias_followup })
      setAdmin(perfil?.role === 'admin')
      setLinhas((cots ?? []).map(c => {
        const a = Array.isArray(c.autor) ? c.autor[0] : c.autor
        const itens = ((c.itens ?? []) as Record<string, unknown>[]).map(itemDoBanco)
        const t = calcularTotais(itens, parametrosDoBanco(c))
        return {
          id: c.id, numero: c.numero, status: c.status, cliente_nome: c.cliente_nome, empresa_rural: c.empresa_rural, cidade: c.cidade,
          created_at: c.created_at, criado_por: c.criado_por, autor: a?.nome_completo ?? '—', qtdItens: itens.length,
          venda: t.venda, resultado: t.resultado, pctResultado: t.pctResultado,
          aprovacao_status: c.aprovacao_status, enviada_em: c.enviada_em, validade: c.validade,
          pedido_status: c.pedido_status, pagamento_status: c.pagamento_status,
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

  const situacao = useMemo(() => new Map(linhas.map(l => [l.id, alertasDe(l, config)])), [linhas, config])
  const naFila = (l: Linha, f: string) => {
    const x = situacao.get(l.id)!
    return f === 'x-aprovacao' ? x.aprovacao : f === 'x-followup' ? x.followup : f === 'x-pedidos' ? x.pedido : l.status === f
  }
  const contarFila = (f: string) => linhas.filter(l => naFila(l, f)).length

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return linhas.filter(l =>
      (!status || naFila(l, status)) &&
      (!consultor || l.criado_por === consultor) &&
      (!t || l.numero.includes(t) || (l.cliente_nome ?? '').toLowerCase().includes(t) || (l.empresa_rural ?? '').toLowerCase().includes(t) || (l.cidade ?? '').toLowerCase().includes(t))
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, busca, status, consultor, situacao])

  const cards = usePaginacao(lista, 24, `${busca}|${status}|${consultor}`)
  const contagem = (s: string) => linhas.filter(l => l.status === s).length
  const totalAprovado = linhas.filter(l => l.status === 'aprovada').reduce((s, l) => s + l.venda, 0)
  const filas: [string, string][] = [['x-aprovacao', admin ? 'Aprovar preço' : 'Aguardando aprovação'], ['x-followup', 'Follow-up / validade'], ['x-pedidos', 'Pedidos em andamento']]

  async function salvarConfig() {
    setSalvandoConfig(true)
    const { error } = await supabase.from('configuracoes').update({ ...configForm, updated_at: new Date().toISOString() }).eq('id', 1)
    setSalvandoConfig(false)
    if (!error) { setConfig(configForm); setConfigAberta(false) }
  }

  return (
    <>
      <style>{`
        .cq-toolbar{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;margin-bottom:1rem}
        .cq-busca{width:280px !important}
        .cq-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:1rem}
        .cq-card{padding:1.1rem 1.2rem;display:flex;flex-direction:column;gap:.75rem;text-decoration:none;color:#162a1e}
        .cq-card-top{display:flex;justify-content:space-between;align-items:center;gap:.5rem}
        .cq-card-valor{font-size:1.15rem;font-weight:600}
        .cq-filas{display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;margin:-.3rem 0 1rem}
        .cq-filas-l{font-size:.7rem;color:#8f978f;font-weight:600;margin-right:.2rem}
        .cq-fila{display:inline-flex;align-items:center;gap:.4rem;border:1px solid #eae5de;background:#fff;border-radius:999px;padding:.3rem .5rem .3rem .75rem;font-family:inherit;font-size:.72rem;font-weight:600;color:#5b6660;cursor:pointer}
        .cq-fila:hover{border-color:#E67E22;color:#E67E22}
        .cq-fila.ativo{background:#162a1e;border-color:#162a1e;color:#fff}
        .cq-fila .ui-count{background:#f2efea;color:#5b6660;border-radius:999px;padding:.05rem .4rem;font-size:.64rem}
        .cq-alertas{display:flex;flex-wrap:wrap;gap:.25rem;margin-top:.3rem}
        .cq-alertas .ui-badge{font-size:.6rem;padding:.15rem .45rem}
        @media(max-width:700px){.cq-busca{width:100% !important}}
      `}</style>

      <div className="ui-page-header">
        <div>
          <div className="ui-title">Cotações</div>
          <div className="ui-sub">
            {carregando ? 'Carregando...' : `${linhas.length} cotaç${linhas.length !== 1 ? 'ões' : 'ão'} · ${contagem('aprovada')} aprovada${contagem('aprovada') !== 1 ? 's' : ''} (${brl(totalAprovado)}). Cada cotação gera o orçamento, o pedido e o resultado.`}
          </div>
        </div>
        <div className="ui-header-actions">
          {admin && base.startsWith('/admin') && <button className="ui-btn ui-btn-ghost" onClick={() => { setConfigForm(config); setConfigAberta(true) }}><IconGear /> Configurações</button>}
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
      <div className="cq-filas">
        <span className="cq-filas-l">Precisa de ação:</span>
        {filas.map(([k, label]) => (
          <button key={k} className={`cq-fila ${status === k ? 'ativo' : ''}`} onClick={() => setStatus(status === k ? '' : k)}>
            {label} <span className="ui-count">{carregando ? '·' : contarFila(k)}</span>
          </button>
        ))}
      </div>

      {configAberta && (
        <div className="ui-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setConfigAberta(false) }}>
          <div className="ui-modal" style={{ maxWidth: 480 }}>
            <div className="ui-title" style={{ fontSize: '1.1rem', marginBottom: '.3rem' }}>Configurações de cotação</div>
            <div className="ui-sub" style={{ marginBottom: '1.1rem' }}>Valem para todos os consultores.</div>
            <div className="ui-field">
              <label className="ui-label">Margem líquida mínima (%)</label>
              <NumInput pct valor={configForm.margem_minima} onChange={v => setConfigForm(f => ({ ...f, margem_minima: v }))} />
              <div className="ui-hint">Abaixo disso o consultor precisa da sua aprovação para enviar o orçamento. Ele vê o preço mínimo, mas não a margem.</div>
            </div>
            <div className="ui-grid-2">
              <div className="ui-field"><label className="ui-label">Validade padrão (dias)</label><input className="ui-input" type="number" min={1} value={configForm.validade_cotacao_dias} onChange={e => setConfigForm(f => ({ ...f, validade_cotacao_dias: Math.max(1, Number(e.target.value) || 1) }))} /></div>
              <div className="ui-field"><label className="ui-label">Follow-up após (dias)</label><input className="ui-input" type="number" min={1} value={configForm.dias_followup} onChange={e => setConfigForm(f => ({ ...f, dias_followup: Math.max(1, Number(e.target.value) || 1) }))} /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.6rem', marginTop: '.4rem' }}>
              <button className="ui-btn ui-btn-ghost" onClick={() => setConfigAberta(false)}>Cancelar</button>
              <button className="ui-btn ui-btn-primary" onClick={salvarConfig} disabled={salvandoConfig}>{salvandoConfig ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

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
                  {(situacao.get(l.id)?.alertas.length ?? 0) > 0 && <div className="cq-alertas">{situacao.get(l.id)!.alertas.map(a => <span key={a.txt} className={`ui-badge ${a.cls}`}>{a.txt}</span>)}</div>}
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
              <div className="ui-empty-text">{linhas.length === 0 ? 'Crie a primeira cotação: o orçamento, o pedido e o resultado saem dela automaticamente.' : 'Ajuste a busca ou os filtros.'}</div>
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
            { id: 'status', titulo: 'Status', largura: '170px', ordenar: (a, b) => a.status.localeCompare(b.status),
              celula: l => {
                const st = STATUS_COTACAO[l.status] ?? STATUS_COTACAO.rascunho
                const al = situacao.get(l.id)?.alertas ?? []
                return <><span className={`ui-badge ${st.badge}`}>{st.label}</span>{al.length > 0 && <div className="cq-alertas">{al.map(a => <span key={a.txt} className={`ui-badge ${a.cls}`}>{a.txt}</span>)}</div>}</>
              } },
          ]}
        />
      )}
    </>
  )
}

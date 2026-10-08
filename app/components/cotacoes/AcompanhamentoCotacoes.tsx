'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Tabela from '@/app/components/Tabela'
import PeriodoSeletor from '@/app/components/PeriodoSeletor'
import FunilCotacoes from './FunilCotacoes'
import { baixarCsv } from '@/lib/csv'
import { ATALHO_PADRAO, calcRange, descreverPeriodo } from '@/lib/dateUtils'
import { ETAPAS, etapaDe, calcularTotais, itemDoBanco, parametrosDoBanco, brl, pct, type Etapa } from '@/lib/cotacao'

// Acompanhamento das cotações por etapa: quantas há em cada uma, há quanto tempo estão paradas,
// quanto tempo cada passagem leva e como cada consultor está. Admin vê a equipe; consultor vê as dele.

type Cot = {
  id: string; numero: string; status: string; aprovacao_status: string | null; criado_por: string; autor: string
  cliente_nome: string | null; created_at: string; updated_at: string | null; enviada_em: string | null
  aprovado_em: string | null; aprovacao_pedida_em: string | null; efetivada_em: string | null; perdida_em: string | null
  motivo_perda: string | null; venda: number; etapa: Etapa; desde: string; dias: number; parada: boolean
}

const ORDEM: Etapa[] = ['elaboracao', 'aguardando', 'aprovada', 'enviada', 'efetivada', 'perdida']
const ABERTAS: Etapa[] = ['elaboracao', 'aguardando', 'aprovada', 'enviada']
// Depois de quantos dias na mesma etapa a cotação conta como parada
const LIMITE: Partial<Record<Etapa, number>> = { elaboracao: 7, aguardando: 2, aprovada: 2 }
const DICA: Record<Etapa, string> = {
  elaboracao: 'Consultor ainda montando',
  aguardando: 'Esperando a gestão aprovar',
  aprovada: 'Liberada, falta enviar ao cliente',
  enviada: 'Esperando resposta do cliente',
  efetivada: 'Cliente aprovou: virou pedido',
  perdida: 'Cliente não fechou',
}

const DIA = 86400000
const diasDesde = (d: string) => Math.max(0, Math.floor((Date.now() - Date.parse(d)) / DIA))
const intervalo = (de: string | null, ate: string | null) => (de && ate ? Math.max(0, (Date.parse(ate) - Date.parse(de)) / DIA) : null)
const media = (l: (number | null)[]) => { const v = l.filter((x): x is number => x != null); return v.length ? { dias: v.reduce((s, x) => s + x, 0) / v.length, n: v.length } : null }
const txtDias = (d: number) => (d < 1 ? `${Math.max(1, Math.round(d * 24))} h` : `${d.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dia${d >= 2 ? 's' : ''}`)
const dataBR = (d: string) => new Date(d).toLocaleDateString('pt-BR')

// Data em que a cotação entrou na etapa em que está
function entradaNaEtapa(c: Omit<Cot, 'etapa' | 'desde' | 'dias' | 'parada'>, etapa: Etapa) {
  const alt = c.updated_at ?? c.created_at
  if (etapa === 'aguardando') return c.aprovacao_pedida_em ?? alt
  if (etapa === 'aprovada') return c.aprovado_em ?? alt
  if (etapa === 'enviada') return c.enviada_em ?? alt
  if (etapa === 'efetivada') return c.efetivada_em ?? alt
  if (etapa === 'perdida') return c.perdida_em ?? alt
  return c.aprovacao_status === 'reprovada' ? alt : c.created_at
}

function IconRefresh() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
}
function IconDownload() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
}
function IconBack() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
}

type Props = { base: string; voltar: { href: string; rotulo: string } }

export default function AcompanhamentoCotacoes({ base, voltar }: Props) {
  const [cots, setCots] = useState<Cot[]>([])
  const [admin, setAdmin] = useState(false)
  const [diasFollow, setDiasFollow] = useState(3)
  const [carregando, setCarregando] = useState(true)
  const [atualizado, setAtualizado] = useState<Date | null>(null)
  const [periodo, setPeriodo] = useState(() => calcRange(ATALHO_PADRAO))
  const [consultor, setConsultor] = useState('')
  const [etapa, setEtapa] = useState<Etapa | ''>('')
  const [soParadas, setSoParadas] = useState(false)
  const [busca, setBusca] = useState('')

  const carregar = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const [{ data: perfil }, { data }, { data: cfg }] = await Promise.all([
      supabase.from('profiles').select('role').eq('id', user?.id ?? '').single(),
      supabase.from('cotacoes')
        .select('id, numero, status, aprovacao_status, criado_por, cliente_nome, created_at, updated_at, enviada_em, aprovado_em, aprovacao_pedida_em, efetivada_em, perdida_em, motivo_perda, ptax, juros_mes, aliquota_icms, aliquota_ir, autor:profiles!cotacoes_criado_por_fkey(nome_completo), itens:cotacao_itens(*)')
        .gte('created_at', periodo.inicio).lte('created_at', periodo.fim + 'T23:59:59')
        .order('created_at', { ascending: false }),
      supabase.from('configuracoes').select('dias_followup').eq('id', 1).maybeSingle(),
    ])
    const follow = cfg?.dias_followup ?? 3
    setDiasFollow(follow)
    setAdmin(perfil?.role === 'admin')
    setCots((data ?? []).map(c => {
      const a = Array.isArray(c.autor) ? c.autor[0] : c.autor
      const dados = {
        id: c.id, numero: c.numero, status: c.status, aprovacao_status: c.aprovacao_status, criado_por: c.criado_por, autor: a?.nome_completo ?? '—',
        cliente_nome: c.cliente_nome, created_at: c.created_at, updated_at: c.updated_at, enviada_em: c.enviada_em, aprovado_em: c.aprovado_em,
        aprovacao_pedida_em: c.aprovacao_pedida_em, efetivada_em: c.efetivada_em, perdida_em: c.perdida_em, motivo_perda: c.motivo_perda,
        venda: calcularTotais(((c.itens ?? []) as Record<string, unknown>[]).map(itemDoBanco), parametrosDoBanco(c)).venda,
      }
      const et = etapaDe(dados)
      const desde = entradaNaEtapa(dados, et)
      const dias = diasDesde(desde)
      const limite = et === 'enviada' ? follow : LIMITE[et]
      return { ...dados, etapa: et, desde, dias, parada: limite != null && dias >= limite }
    }))
    setAtualizado(new Date())
    setCarregando(false)
  }, [periodo])

  // dados sempre frescos: recarrega ao voltar para a aba e a cada minuto
  useEffect(() => {
    const inicial = setTimeout(carregar, 0)
    const t = setInterval(carregar, 60000)
    const foco = () => { if (document.visibilityState === 'visible') carregar() }
    document.addEventListener('visibilitychange', foco)
    return () => { clearTimeout(inicial); clearInterval(t); document.removeEventListener('visibilitychange', foco) }
  }, [carregar])

  const consultores = useMemo(() => {
    const m = new Map<string, string>()
    cots.forEach(c => m.set(c.criado_por, c.autor))
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [cots])

  const doFiltro = useMemo(() => cots.filter(c => !consultor || c.criado_por === consultor), [cots, consultor])

  const porEtapa = useMemo(() => ORDEM.map(e => {
    const l = doFiltro.filter(c => c.etapa === e)
    return { etapa: e, qtd: l.length, valor: l.reduce((s, c) => s + c.venda, 0), paradas: l.filter(c => c.parada).length }
  }), [doFiltro])

  // tempo médio de cada passagem (só cotações que já passaram por ela)
  const tempos = useMemo(() => [
    { rotulo: 'Gestão aprovar', sub: 'pedido de aprovação → aprovada', m: media(doFiltro.map(c => intervalo(c.aprovacao_pedida_em, c.aprovado_em))) },
    { rotulo: 'Enviar ao cliente', sub: 'aprovada → orçamento enviado', m: media(doFiltro.map(c => intervalo(c.aprovado_em, c.enviada_em))) },
    { rotulo: 'Cliente responder', sub: 'orçamento enviado → aprovou ou perdeu', m: media(doFiltro.map(c => intervalo(c.enviada_em, c.efetivada_em ?? c.perdida_em))) },
    { rotulo: 'Ciclo completo', sub: 'cotação criada → pedido', m: media(doFiltro.map(c => intervalo(c.created_at, c.efetivada_em))) },
  ], [doFiltro])

  const equipe = useMemo(() => consultores.map(([id, nome]) => {
    const l = cots.filter(c => c.criado_por === id)
    const n = (e: Etapa) => l.filter(c => c.etapa === e).length
    const ef = n('efetivada')
    const pe = n('perdida')
    return {
      id, nome, total: l.length, elaboracao: n('elaboracao'), aguardando: n('aguardando'), aprovada: n('aprovada'), enviada: n('enviada'),
      efetivada: ef, perdida: pe, paradas: l.filter(c => c.parada).length,
      vendido: l.filter(c => c.etapa === 'efetivada').reduce((s, c) => s + c.venda, 0),
      conversao: ef + pe ? ef / (ef + pe) : null,
      resposta: media(l.map(c => intervalo(c.enviada_em, c.efetivada_em ?? c.perdida_em))),
    }
  }), [cots, consultores])

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return doFiltro.filter(c =>
      (!etapa || c.etapa === etapa) && (!soParadas || c.parada) &&
      (!t || c.numero.includes(t) || (c.cliente_nome ?? '').toLowerCase().includes(t) || c.autor.toLowerCase().includes(t)))
  }, [doFiltro, etapa, soParadas, busca])

  const totalParadas = porEtapa.reduce((s, e) => s + e.paradas, 0)
  const abertas = porEtapa.filter(e => ABERTAS.includes(e.etapa))
  const emAberto = abertas.reduce((s, e) => s + e.valor, 0)
  const textoPeriodo = descreverPeriodo(periodo.inicio, periodo.fim)

  function exportar() {
    baixarCsv(`acompanhamento-cotacoes-${new Date().toISOString().slice(0, 10)}`,
      ['Número', 'Cliente', 'Consultor', 'Etapa', 'Na etapa desde', 'Dias na etapa', 'Parada', 'Valor (R$)', 'Criada em', 'Pedido de aprovação', 'Aprovada em', 'Enviada em', 'Cliente aprovou em', 'Perdida em', 'Motivo da perda'],
      lista.map(c => [c.numero, c.cliente_nome, c.autor, ETAPAS[c.etapa].label, dataBR(c.desde), c.dias, c.parada ? 'sim' : '', c.venda.toFixed(2).replace('.', ','),
        dataBR(c.created_at), c.aprovacao_pedida_em ? dataBR(c.aprovacao_pedida_em) : '', c.aprovado_em ? dataBR(c.aprovado_em) : '', c.enviada_em ? dataBR(c.enviada_em) : '',
        c.efetivada_em ? dataBR(c.efetivada_em) : '', c.perdida_em ? dataBR(c.perdida_em) : '', c.motivo_perda]))
  }

  function escolherEtapa(e: Etapa, paradas = false) {
    const mesma = etapa === e && soParadas === paradas
    setEtapa(mesma ? '' : e)
    setSoParadas(mesma ? false : paradas)
    document.getElementById('ac-lista')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <style>{`
        .ac-top{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;margin-bottom:1rem}
        .ac-atual{font-size:.7rem;color:#8f978f;display:inline-flex;align-items:center;gap:.4rem}
        .ac-atual i{width:7px;height:7px;border-radius:50%;background:#27ae60;display:inline-block;animation:ac-pulso 2s infinite}
        @keyframes ac-pulso{50%{opacity:.35}}
        .ac-resumo{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem;margin-bottom:1rem}
        .ac-res{padding:1rem 1.15rem}
        .ac-res-l{font-size:.72rem;font-weight:500;color:#5b6660}
        .ac-res-n{font-size:1.5rem;font-weight:600;color:#162a1e;margin-top:.3rem;letter-spacing:-.02em}
        .ac-res-s{font-size:.7rem;color:#8f978f;margin-top:.2rem}
        .ac-etapas{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:.7rem;margin-bottom:1rem}
        .ac-et{padding:.9rem 1rem;text-align:left;border:1.5px solid transparent;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;gap:.2rem;position:relative;background:#fff}
        .ac-et:hover{border-color:#eae5de}
        .ac-et.on{border-color:#162a1e}
        .ac-et-faixa{position:absolute;left:0;top:0;bottom:0;width:4px;border-radius:12px 0 0 12px}
        .ac-et-l{font-size:.7rem;font-weight:600;color:#5b6660}
        .ac-et-n{font-size:1.6rem;font-weight:600;color:#162a1e;line-height:1.1}
        .ac-et-v{font-size:.72rem;font-weight:600;color:#162a1e}
        .ac-et-d{font-size:.64rem;color:#8f978f}
        .ac-et-par{margin-top:.3rem;align-self:flex-start;font-size:.64rem;font-weight:600;color:#c0392b;background:#fdeeec;border:none;border-radius:999px;padding:.15rem .5rem;cursor:pointer;font-family:inherit}
        .ac-et-par:hover{background:#f9d9d5}
        .ac-et-ok{margin-top:.3rem;font-size:.64rem;color:#1e8a4c}
        .ac-tempos{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.7rem;margin-bottom:1.2rem}
        .ac-tempo{padding:.85rem 1rem}
        .ac-tempo-l{font-size:.7rem;font-weight:600;color:#5b6660}
        .ac-tempo-n{font-size:1.15rem;font-weight:600;color:#162a1e;margin-top:.25rem}
        .ac-tempo-s{font-size:.64rem;color:#8f978f;margin-top:.1rem}
        .ac-sec{font-size:.95rem;font-weight:600;color:#162a1e;margin:1.4rem 0 .7rem;display:flex;align-items:center;gap:.6rem;flex-wrap:wrap}
        .ac-sec small{font-size:.72rem;font-weight:400;color:#8f978f}
        .ac-filtro-ativo{display:inline-flex;align-items:center;gap:.4rem;font-size:.72rem;background:#162a1e;color:#fff;border-radius:999px;padding:.25rem .4rem .25rem .7rem}
        .ac-filtro-ativo button{border:none;background:rgba(255,255,255,.18);color:#fff;border-radius:50%;width:18px;height:18px;cursor:pointer;font-size:.7rem;line-height:1}
        .ac-n{font-variant-numeric:tabular-nums;font-weight:600}
        .ac-zero{color:#cfc8bd}
        .ac-busca{width:260px !important}
        @media(max-width:1200px){.ac-etapas{grid-template-columns:repeat(3,minmax(0,1fr))}}
        @media(max-width:800px){.ac-resumo,.ac-tempos{grid-template-columns:1fr 1fr}.ac-busca{width:100% !important}}
        @media(max-width:520px){.ac-etapas{grid-template-columns:1fr 1fr}}
      `}</style>

      <div className="ui-breadcrumb">
        <Link href={voltar.href}><IconBack /> {voltar.rotulo}</Link>
        <span className="ui-breadcrumb-sep">/</span>
        <span className="ui-breadcrumb-atual">Acompanhamento</span>
      </div>
      <div className="ui-page-header">
        <div>
          <div className="ui-title">Acompanhamento de cotações</div>
          <div className="ui-sub">{admin ? 'Toda a equipe' : 'Suas cotações'}, etapa por etapa: cotação → aprovação da gestão → orçamento ao cliente → resposta → pedido.</div>
        </div>
        <div className="ui-header-actions">
          <span className="ac-atual"><i />{atualizado ? `Atualizado às ${atualizado.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Carregando...'}</span>
          <button className="ui-btn ui-btn-ghost" onClick={carregar}><IconRefresh /> Atualizar</button>
          <button className="ui-btn ui-btn-secondary" onClick={exportar} disabled={!lista.length}><IconDownload /> Exportar</button>
        </div>
      </div>

      <PeriodoSeletor inicio={periodo.inicio} fim={periodo.fim} onChange={(inicio, fim) => { setCarregando(true); setPeriodo({ inicio, fim }) }} />
      {admin && consultores.length > 1 && (
        <div className="ac-top">
          <select className="ui-select ui-select-sm" style={{ width: 'auto' }} value={consultor} onChange={e => setConsultor(e.target.value)} aria-label="Consultor">
            <option value="">Toda a equipe</option>
            {consultores.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </select>
        </div>
      )}

      {/* ── resumo ── */}
      <div className="ac-resumo">
        <div className="ui-card ac-res"><div className="ac-res-l">Cotações em andamento</div><div className="ac-res-n">{abertas.reduce((s, e) => s + e.qtd, 0)}</div><div className="ac-res-s">{brl(emAberto)} ainda em negociação</div></div>
        <button className="ui-card ac-res" style={{ textAlign: 'left', border: 'none', cursor: totalParadas ? 'pointer' : 'default', fontFamily: 'inherit' }}
          onClick={() => { if (totalParadas) { setEtapa(''); setSoParadas(s => !s); document.getElementById('ac-lista')?.scrollIntoView({ behavior: 'smooth' }) } }}>
          <div className="ac-res-l">Paradas além do prazo</div>
          <div className="ac-res-n" style={{ color: totalParadas ? '#c0392b' : '#1e8a4c' }}>{totalParadas}</div>
          <div className="ac-res-s">{totalParadas ? 'Clique para ver quais são' : 'Nada atrasado'}</div>
        </button>
        <div className="ui-card ac-res"><div className="ac-res-l">Viraram pedido</div><div className="ac-res-n" style={{ color: '#1a7f4b' }}>{porEtapa[4].qtd}</div><div className="ac-res-s">{brl(porEtapa[4].valor)} · {textoPeriodo}</div></div>
      </div>

      {/* ── uma caixa por etapa: clica para filtrar a lista ── */}
      <div className="ac-etapas">
        {porEtapa.map(e => {
          const info = ETAPAS[e.etapa]
          const limite = e.etapa === 'enviada' ? diasFollow : LIMITE[e.etapa]
          return (
            <div key={e.etapa} role="button" tabIndex={0} className={`ui-card ac-et ${etapa === e.etapa && !soParadas ? 'on' : ''}`}
              onClick={() => escolherEtapa(e.etapa)} onKeyDown={k => { if (k.key === 'Enter') escolherEtapa(e.etapa) }}>
              <span className="ac-et-faixa" style={{ background: info.cor }} />
              <span className="ac-et-l">{info.label}</span>
              <span className="ac-et-n">{carregando ? '·' : e.qtd}</span>
              <span className="ac-et-v">{brl(e.valor)}</span>
              <span className="ac-et-d">{DICA[e.etapa]}</span>
              {limite != null && (e.paradas > 0
                ? <button type="button" className="ac-et-par" onClick={ev => { ev.stopPropagation(); escolherEtapa(e.etapa, true) }}>{e.paradas} parada{e.paradas > 1 ? 's' : ''} há {limite}+ dias</button>
                : e.qtd > 0 && <span className="ac-et-ok">Tudo em dia</span>)}
            </div>
          )
        })}
      </div>

      {/* ── tempos ── */}
      <div className="ac-sec">Quanto tempo leva cada passo <small>média das cotações do período que já passaram pelo passo</small></div>
      <div className="ac-tempos">
        {tempos.map(t => (
          <div key={t.rotulo} className="ui-card ac-tempo">
            <div className="ac-tempo-l">{t.rotulo}</div>
            <div className="ac-tempo-n">{t.m ? txtDias(t.m.dias) : '—'}</div>
            <div className="ac-tempo-s">{t.sub}{t.m ? ` · ${t.m.n} cotaç${t.m.n > 1 ? 'ões' : 'ão'}` : ''}</div>
          </div>
        ))}
      </div>

      {!carregando && <FunilCotacoes cotacoes={doFiltro} periodo={textoPeriodo} onStatus={e => escolherEtapa(e)} />}

      {/* ── equipe ── */}
      {admin && !consultor && equipe.length > 0 && (
        <>
          <div className="ac-sec">Por consultor <small>clique no nome para ver só as cotações dele</small></div>
          <Tabela
            linhas={equipe}
            chave={l => l.id}
            rotulo="consultores"
            porPagina={20}
            colunas={[
              { id: 'nome', titulo: 'Consultor', ordenar: (a, b) => a.nome.localeCompare(b.nome),
                celula: l => <button className="ce-link" style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, color: '#162a1e' }} onClick={() => setConsultor(l.id)}>{l.nome}</button> },
              { id: 'total', titulo: 'Total', alinhar: 'dir', ordenar: (a, b) => a.total - b.total, celula: l => <span className="ac-n">{l.total}</span> },
              ...ORDEM.map(e => ({
                id: e, titulo: ETAPAS[e].label.replace(' · pedido', ''), alinhar: 'dir' as const, ocultar: (e === 'elaboracao' || e === 'perdida' ? 'tablet' : undefined) as 'tablet' | undefined,
                ordenar: (a: (typeof equipe)[number], b: (typeof equipe)[number]) => a[e] - b[e],
                celula: (l: (typeof equipe)[number]) => <span className={`ac-n ${l[e] ? '' : 'ac-zero'}`} style={l[e] ? { color: ETAPAS[e].cor } : undefined}>{l[e]}</span>,
              })),
              { id: 'paradas', titulo: 'Paradas', alinhar: 'dir', ordenar: (a, b) => a.paradas - b.paradas,
                celula: l => l.paradas ? <span className="ui-badge ui-badge-cancelada">{l.paradas}</span> : <span className="ac-zero">0</span> },
              { id: 'conv', titulo: 'Conversão', alinhar: 'dir', ocultar: 'celular', ordenar: (a, b) => (a.conversao ?? -1) - (b.conversao ?? -1),
                celula: l => <span className="ac-n">{l.conversao == null ? '—' : pct(l.conversao, 0)}</span> },
              { id: 'resp', titulo: 'Resposta do cliente', alinhar: 'dir', ocultar: 'tablet', ordenar: (a, b) => (a.resposta?.dias ?? 999) - (b.resposta?.dias ?? 999),
                celula: l => <span className="ac-n">{l.resposta ? txtDias(l.resposta.dias) : '—'}</span> },
              { id: 'vend', titulo: 'Pedidos (R$)', alinhar: 'dir', ordenar: (a, b) => a.vendido - b.vendido, celula: l => <span className="ac-n">{brl(l.vendido)}</span> },
            ]}
          />
        </>
      )}

      {/* ── lista ── */}
      <div className="ac-sec" id="ac-lista">
        Cotações
        {consultor && <span className="ac-filtro-ativo">{consultores.find(c => c[0] === consultor)?.[1]}<button onClick={() => setConsultor('')} aria-label="Limpar consultor">×</button></span>}
        {etapa && <span className="ac-filtro-ativo">{ETAPAS[etapa].label}<button onClick={() => setEtapa('')} aria-label="Limpar etapa">×</button></span>}
        {soParadas && <span className="ac-filtro-ativo">Só paradas<button onClick={() => setSoParadas(false)} aria-label="Mostrar todas">×</button></span>}
        <input className="ui-input ac-busca" style={{ marginLeft: 'auto' }} placeholder="Buscar nº, cliente ou consultor..." value={busca} onChange={e => setBusca(e.target.value)} />
      </div>
      <Tabela
        linhas={lista}
        chave={c => c.id}
        href={c => `${base}/${c.id}`}
        carregando={carregando}
        reiniciar={`${etapa}|${soParadas}|${consultor}|${busca}|${periodo.inicio}|${periodo.fim}`}
        rotulo="cotações"
        destaque={c => c.parada}
        vazio={<div className="ui-empty"><div className="ui-empty-title">Nenhuma cotação aqui</div><div className="ui-empty-text">Troque a etapa, o período ou limpe os filtros.</div></div>}
        colunas={[
          { id: 'num', titulo: 'Número', largura: '110px', ordenar: (a, b) => a.numero.localeCompare(b.numero), celula: c => <span className="ui-cel-forte ui-cel-num">{c.numero}</span> },
          { id: 'cli', titulo: 'Cliente', ordenar: (a, b) => (a.cliente_nome ?? '').localeCompare(b.cliente_nome ?? ''),
            celula: c => <div className="ui-cel-txt"><div className="ui-cel-titulo">{c.cliente_nome || 'Sem cliente'}</div>{admin && <div className="ui-cel-sub">{c.autor}</div>}</div> },
          { id: 'etapa', titulo: 'Etapa', largura: '190px', ordenar: (a, b) => ORDEM.indexOf(a.etapa) - ORDEM.indexOf(b.etapa),
            celula: c => <span className={`ui-badge ${ETAPAS[c.etapa].badge}`}>{ETAPAS[c.etapa].label}</span> },
          { id: 'dias', titulo: 'Na etapa há', alinhar: 'dir', ordenar: (a, b) => a.dias - b.dias,
            celula: c => <><div className="ac-n" style={c.parada ? { color: '#c0392b' } : undefined}>{c.dias === 0 ? 'hoje' : `${c.dias} dia${c.dias > 1 ? 's' : ''}`}</div><div className="ui-cel-sub">desde {dataBR(c.desde)}</div></> },
          { id: 'valor', titulo: 'Valor', alinhar: 'dir', ordenar: (a, b) => a.venda - b.venda, celula: c => <span className="ui-cel-num ui-cel-forte">{brl(c.venda)}</span> },
          { id: 'criada', titulo: 'Criada em', ocultar: 'celular', ordenar: (a, b) => a.created_at.localeCompare(b.created_at), celula: c => <span className="ui-cel-num">{dataBR(c.created_at)}</span> },
        ]}
      />
    </>
  )
}

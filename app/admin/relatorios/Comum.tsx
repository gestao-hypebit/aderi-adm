'use client'

import { ReactNode, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import FiltrosPainel from '@/app/components/FiltrosPainel'
import { type Filtros, defaultFiltros, descreverPeriodo } from '@/lib/dateUtils'

// Peças compartilhadas pelos relatórios do admin.

export const brl = (n: number, casas = 0) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: casas, maximumFractionDigits: casas })
export const num = (n: number, casas = 0) => n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
export const pctTxt = (n: number | null, casas = 0) => (n == null || !isFinite(n) ? '—' : `${(n * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`)
export const dataBR = (d: string | null | undefined) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '—')
export const div = (a: number, b: number) => (b ? a / b : null)
export const um = <T,>(r: T | T[] | null | undefined): T | null => (Array.isArray(r) ? r[0] ?? null : r ?? null)

export type Consultor = { id: string; nome_completo: string }

// Filtros de período + consultor (padrão: desde o início, equipe toda)
export function useFiltrosRelatorio(inicial?: Partial<Filtros>) {
  const [filtros, setFiltros] = useState<Filtros>(() => ({ ...defaultFiltros(), ...inicial }))
  const [consultores, setConsultores] = useState<Consultor[]>([])
  const [consultoresProntos, setConsultoresProntos] = useState(false)
  useEffect(() => {
    createClient().from('profiles').select('id, nome_completo').eq('role', 'colaborador').order('nome_completo')
      .then(({ data }) => { setConsultores((data ?? []).map(c => ({ id: c.id, nome_completo: c.nome_completo ?? 'Sem nome' }))); setConsultoresProntos(true) })
  }, [])
  return { filtros, setFiltros, consultores, consultoresProntos, periodo: descreverPeriodo(filtros.dataInicio, filtros.dataFim) }
}

function IconArrowLeft() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
}
function IconDownload() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
}
function IconPrinter() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
}

type CabecalhoProps = {
  titulo: string
  descricao: string
  periodo: string
  onExportar?: () => void
  exportarDesabilitado?: boolean
}

export function CabecalhoRelatorio({ titulo, descricao, periodo, onExportar, exportarDesabilitado }: CabecalhoProps) {
  return (
    <>
      <style>{RELATORIO_CSS}</style>
      <div className="ui-breadcrumb rl-no-print">
        <Link href="/admin/relatorios"><IconArrowLeft /> Relatórios</Link>
        <span className="ui-breadcrumb-sep">/</span>
        <span className="ui-breadcrumb-atual">{titulo}</span>
      </div>
      <div className="ui-page-header">
        <div>
          <div className="ui-title">{titulo}</div>
          <div className="ui-sub">{descricao} · <b style={{ color: '#5b6660', fontWeight: 600 }}>{periodo}</b></div>
        </div>
        <div className="ui-header-actions rl-no-print">
          <button className="ui-btn ui-btn-ghost" onClick={() => window.print()}><IconPrinter /> Imprimir</button>
          {onExportar && <button className="ui-btn ui-btn-secondary" onClick={onExportar} disabled={exportarDesabilitado}><IconDownload /> Exportar CSV</button>}
        </div>
      </div>
    </>
  )
}

export function FiltrosRelatorio({ filtros, setFiltros, consultores, comConsultor = true }: { filtros: Filtros; setFiltros: (f: Filtros) => void; consultores: Consultor[]; comConsultor?: boolean }) {
  return (
    <div className="rl-no-print">
      <FiltrosPainel value={filtros} onChange={setFiltros} showFuncionario={comConsultor} showCliente={false} clientes={[]} funcionarios={consultores} />
    </div>
  )
}

export function Indicadores({ itens, carregando }: { itens: { rotulo: string; valor: ReactNode; sub?: ReactNode; cor?: string }[]; carregando?: boolean }) {
  return (
    <div className="rl-kpis">
      {itens.map(i => (
        <div key={i.rotulo} className="ui-card rl-kpi">
          <div className="rl-kpi-l">{i.rotulo}</div>
          {carregando
            ? <div className="ui-skeleton" style={{ height: 26, width: '60%', marginTop: '.45rem' }} />
            : <div className="rl-kpi-n" style={i.cor ? { color: i.cor } : undefined}>{i.valor}</div>}
          {i.sub && !carregando && <div className="rl-kpi-s">{i.sub}</div>}
        </div>
      ))}
    </div>
  )
}

// Barra de proporção dentro de uma célula (um único tom: magnitude, não identidade)
export function Barra({ valor, max, cor = '#1a7f4b', texto }: { valor: number; max: number; cor?: string; texto?: ReactNode }) {
  const p = max > 0 ? Math.max(0, Math.min(1, valor / max)) : 0
  return (
    <div className="rl-barra">
      <div className="rl-barra-trilho"><span style={{ width: `${p * 100}%`, background: cor }} /></div>
      {texto != null && <span className="rl-barra-txt">{texto}</span>}
    </div>
  )
}

export function Secao({ titulo, sub, children, acao }: { titulo: string; sub?: string; children: ReactNode; acao?: ReactNode }) {
  return (
    <section className="rl-secao">
      <div className="rl-secao-h">
        <div><div className="rl-secao-t">{titulo}</div>{sub && <div className="rl-secao-s">{sub}</div>}</div>
        {acao}
      </div>
      {children}
    </section>
  )
}

const RELATORIO_CSS = `
  .rl-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:1rem;margin-bottom:1.4rem}
  .rl-kpi{padding:1rem 1.1rem}
  .rl-kpi-l{font-size:.72rem;font-weight:500;color:#5b6660}
  .rl-kpi-n{font-size:1.45rem;font-weight:600;color:#162a1e;margin-top:.35rem;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .rl-kpi-n small{font-size:.78rem;font-weight:500;color:#8f978f;margin-left:.25rem;letter-spacing:0}
  .rl-kpi-s{font-size:.7rem;color:#8f978f;margin-top:.25rem}
  .rl-secao{margin-bottom:1.6rem}
  .rl-secao-h{display:flex;align-items:flex-end;justify-content:space-between;gap:1rem;margin-bottom:.75rem;flex-wrap:wrap}
  .rl-secao-t{font-size:.95rem;font-weight:600;color:#162a1e}
  .rl-secao-s{font-size:.72rem;color:#8f978f;margin-top:.15rem}
  .rl-duas{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.2rem}
  .rl-duas .rl-secao{margin-bottom:0}
  .rl-barra{display:flex;align-items:center;gap:.55rem;min-width:120px}
  .rl-barra-trilho{flex:1;height:7px;border-radius:999px;background:#f2efea;overflow:hidden}
  .rl-barra-trilho span{display:block;height:100%;border-radius:999px}
  .rl-barra-txt{font-size:.74rem;color:#162a1e;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;min-width:3.2rem;text-align:right}
  @media(max-width:1000px){.rl-duas{grid-template-columns:1fr}.rl-duas .rl-secao{margin-bottom:1.6rem}}
  @media print{
    .rl-no-print,.ui-pag{display:none !important}
    .rl-kpi,.ui-tb{box-shadow:none !important;border:1px solid #ddd !important;break-inside:avoid}
    .rl-secao{break-inside:avoid}
    body{background:#fff !important}
  }
`

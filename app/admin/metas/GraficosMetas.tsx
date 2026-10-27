'use client'

import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { MESES_CURTOS } from '@/lib/metas/vendas'

// Mesma paleta validada de app/admin/AdminCharts.tsx (validate_palette.js: CVD ΔE 9,9).
// O laranja fica abaixo de 3:1 de contraste: há legenda e visão em tabela.
export const COR_REALIZADO = '#1a7f4b'
export const COR_ANTERIOR = '#E67E22'
export const COR_META = '#d9d4cc' // referência recessiva, não é série categórica
const EIXO = { fontSize: 11, fontFamily: 'Poppins', fill: '#8f978f' }

const brlCurto = (n: number) =>
  Math.abs(n) >= 1e6 ? `${(n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
    : Math.abs(n) >= 1e3 ? `${(n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil` : n.toLocaleString('pt-BR')
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

type Serie = { chave: string; nome: string; cor: string; formato: (n: number) => string }

function Dica({ active, payload, label, series }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string; series: Serie[] }) {
  if (!active || !payload?.length) return null
  return (
    <div className="mt-tip">
      <div className="mt-tip-tit">{label}</div>
      {series.map(s => {
        const p = payload.find(x => x.dataKey === s.chave)
        return p ? <div key={s.chave} className="mt-tip-lin"><span className="mt-dot" style={{ background: s.cor }} />{s.nome}<b>{s.formato(p.value)}</b></div> : null
      })}
    </div>
  )
}

function Cartao({ titulo, sub, series, tabela, children }: { titulo: string; sub?: string; series: Serie[]; tabela: React.ReactNode; children: React.ReactNode }) {
  const [verTabela, setVerTabela] = useState(false)
  return (
    <div className="ui-card mt-card">
      <style>{`
        .mt-card{padding:1.2rem 1.3rem 1rem;min-width:0}
        .mt-head{display:flex;align-items:flex-start;gap:1rem;margin-bottom:.9rem;flex-wrap:wrap}
        .mt-tit{font-size:.9rem;font-weight:600;color:#162a1e}
        .mt-sub{font-size:.72rem;color:#8f978f;margin-top:.15rem}
        .mt-leg{display:flex;gap:1rem;margin-left:auto;align-items:center;font-size:.72rem;color:#5b6660;flex-wrap:wrap}
        .mt-leg span{display:inline-flex;align-items:center;gap:.4rem}
        .mt-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0}
        .mt-tip{background:#fff;border:1px solid #eae5de;border-radius:10px;box-shadow:0 8px 24px rgba(22,42,30,.12);padding:.55rem .75rem;font-family:'Poppins',sans-serif;min-width:170px}
        .mt-tip-tit{font-size:.72rem;font-weight:600;color:#162a1e;margin-bottom:.3rem}
        .mt-tip-lin{display:flex;align-items:center;gap:.45rem;font-size:.72rem;color:#5b6660}
        .mt-tip-lin b{margin-left:auto;padding-left:.8rem;color:#162a1e;font-variant-numeric:tabular-nums}
        .mt-rodape{display:flex;justify-content:flex-end;margin-top:.5rem}
        .mt-link{background:none;border:none;color:#8f978f;font-size:.7rem;cursor:pointer;text-decoration:underline;font-family:inherit}
      `}</style>
      <div className="mt-head">
        <div><div className="mt-tit">{titulo}</div>{sub && <div className="mt-sub">{sub}</div>}</div>
        {series.length > 1 && <div className="mt-leg">{series.map(s => <span key={s.chave}><span className="mt-dot" style={{ background: s.cor }} />{s.nome}</span>)}</div>}
      </div>
      {verTabela ? tabela : children}
      <div className="mt-rodape"><button className="mt-link" onClick={() => setVerTabela(v => !v)}>{verTabela ? 'Ver gráfico' : 'Ver tabela'}</button></div>
    </div>
  )
}

function TabelaMeses({ linhas, series }: { linhas: Record<string, number | string>[]; series: Serie[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="mt-tabela">
        <thead><tr><th>Mês</th>{series.map(s => <th key={s.chave}>{s.nome}</th>)}</tr></thead>
        <tbody>{linhas.map(l => <tr key={String(l.rotulo)}><td>{l.rotulo}</td>{series.map(s => <td key={s.chave}>{s.formato(Number(l[s.chave]))}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

export function EvolucaoMensal({ mensal, ano, mesRef }: { mensal: { mes: number; meta: number; realizado: number; anterior: number }[]; ano: number; mesRef: number }) {
  const temAnterior = mensal.some(m => m.anterior)
  const series: Serie[] = [
    { chave: 'meta', nome: 'Meta', cor: COR_META, formato: brl },
    { chave: 'realizado', nome: `Realizado ${ano}`, cor: COR_REALIZADO, formato: brl },
    ...(temAnterior ? [{ chave: 'anterior', nome: `Realizado ${ano - 1}`, cor: COR_ANTERIOR, formato: brl }] : []),
  ]
  const dados = mensal.map(m => ({ ...m, rotulo: MESES_CURTOS[m.mes - 1] }))
  return (
    <Cartao titulo="Evolução mensal" sub={`Meta × realizado mês a mês · referência: ${MESES_CURTOS[mesRef - 1]}`} series={series} tabela={<TabelaMeses linhas={dados} series={series} />}>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="#f2efea" />
          <XAxis dataKey="rotulo" tick={EIXO} axisLine={false} tickLine={false} />
          <YAxis tick={EIXO} axisLine={false} tickLine={false} tickFormatter={brlCurto} width={56} />
          <Tooltip content={<Dica series={series} />} cursor={{ fill: 'rgba(22,42,30,.04)' }} />
          <Bar dataKey="meta" fill={COR_META} radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar dataKey="realizado" fill={COR_REALIZADO} radius={[4, 4, 0, 0]} maxBarSize={22} />
          {temAnterior && <Line dataKey="anterior" stroke={COR_ANTERIOR} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: COR_ANTERIOR }} activeDot={{ r: 5 }} />}
        </ComposedChart>
      </ResponsiveContainer>
    </Cartao>
  )
}

export function ToneladasMes({ toneladas }: { toneladas: number[] }) {
  const ton = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t`
  const series: Serie[] = [{ chave: 'toneladas', nome: 'Toneladas', cor: COR_REALIZADO, formato: ton }]
  const dados = toneladas.map((t, i) => ({ rotulo: MESES_CURTOS[i], toneladas: t }))
  const total = toneladas.reduce((a, b) => a + b, 0)
  return (
    <Cartao titulo="Toneladas de fertilizante" sub={`${ton(total)} no ano`} series={series} tabela={<TabelaMeses linhas={dados} series={series} />}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#f2efea" />
          <XAxis dataKey="rotulo" tick={EIXO} axisLine={false} tickLine={false} />
          <YAxis tick={EIXO} axisLine={false} tickLine={false} width={48} />
          <Tooltip content={<Dica series={series} />} cursor={{ fill: 'rgba(22,42,30,.04)' }} />
          <Bar dataKey="toneladas" fill={COR_REALIZADO} radius={[4, 4, 0, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </Cartao>
  )
}

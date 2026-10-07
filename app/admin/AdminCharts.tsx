'use client'

import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export type DadosColaborador = {
  id: string
  nome: string
  realizadas: number
  agendadas: number
  canceladas: number
  km: number
  litros: number
  gasto: number
}

type VisitasMesItem = { mes: string; realizadas: number; agendadas: number }

// Paleta validada (validate_palette.js): verde e laranja passam em CVD; o laranja fica
// abaixo de 3:1 de contraste, por isso há legenda + visão em tabela.
const COR_REALIZADA = '#1a7f4b'
const COR_AGENDADA = '#E67E22'
const EIXO = { fontSize: 11, fontFamily: 'Poppins', fill: '#8f978f' }

function Dica({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="pg-tip">
      <div className="pg-tip-tit">{label}</div>
      {payload.map(p => (
        <div key={p.name} className="pg-tip-lin"><span className="pg-dot" style={{ background: p.color }} />{p.name}<b>{p.value}</b></div>
      ))}
    </div>
  )
}

export default function AdminCharts({ visitasPorMes }: { visitasPorMes: VisitasMesItem[] }) {
  const [tabela, setTabela] = useState(false)
  const total = visitasPorMes.reduce((s, m) => s + m.realizadas, 0)
  const melhor = visitasPorMes.reduce<VisitasMesItem | null>((a, m) => (!a || m.realizadas > a.realizadas ? m : a), null)

  return (
    <div className="ui-card pg-card">
      <style>{`
        .pg-card{padding:1.2rem 1.3rem 1rem;display:flex;flex-direction:column;min-width:0}
        .pg-head{display:flex;align-items:flex-start;gap:1rem;margin-bottom:.9rem;flex-wrap:wrap}
        .pg-tit{font-size:.9rem;font-weight:600;color:#162a1e}
        .pg-sub{font-size:.72rem;color:#8f978f;margin-top:.15rem}
        .pg-leg{display:flex;gap:1rem;margin-left:auto;align-items:center;font-size:.72rem;color:#5b6660}
        .pg-leg span{display:inline-flex;align-items:center;gap:.4rem}
        .pg-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0}
        .pg-tip{background:#fff;border:1px solid #eae5de;border-radius:10px;box-shadow:0 8px 24px rgba(22,42,30,.12);padding:.55rem .75rem;font-family:'Poppins',sans-serif;min-width:150px}
        .pg-tip-tit{font-size:.72rem;font-weight:600;color:#162a1e;margin-bottom:.3rem}
        .pg-tip-lin{display:flex;align-items:center;gap:.45rem;font-size:.72rem;color:#5b6660}
        .pg-tip-lin b{margin-left:auto;color:#162a1e;font-variant-numeric:tabular-nums}
        .pg-tab{width:100%;border-collapse:collapse;font-size:.76rem}
        .pg-tab th{text-align:right;font-size:.62rem;font-weight:600;color:#8f978f;text-transform:uppercase;letter-spacing:.06em;padding:.5rem .6rem;border-bottom:1px solid #f2efea}
        .pg-tab td{text-align:right;padding:.5rem .6rem;border-bottom:1px solid #f7f5f1;color:#162a1e;font-variant-numeric:tabular-nums}
        .pg-tab th:first-child,.pg-tab td:first-child{text-align:left}
        .pg-rodape{display:flex;justify-content:space-between;align-items:center;margin-top:.6rem;font-size:.7rem;color:#8f978f}
        .pg-btn{border:none;background:none;font-family:inherit;font-size:.7rem;font-weight:600;color:#8f978f;cursor:pointer;padding:0}
        .pg-btn:hover{color:#E67E22}
      `}</style>
      <div className="pg-head">
        <div>
          <div className="pg-tit">Visitas por mês</div>
          <div className="pg-sub">Últimos 6 meses · {total} realizada{total !== 1 ? 's' : ''}</div>
        </div>
        <div className="pg-leg">
          <span><i className="pg-dot" style={{ background: COR_REALIZADA }} />Realizadas</span>
          <span><i className="pg-dot" style={{ background: COR_AGENDADA }} />Agendadas</span>
        </div>
      </div>

      {tabela ? (
        <table className="pg-tab">
          <thead><tr><th>Mês</th><th>Realizadas</th><th>Agendadas</th></tr></thead>
          <tbody>{visitasPorMes.map(m => <tr key={m.mes}><td>{m.mes}</td><td>{m.realizadas}</td><td>{m.agendadas}</td></tr>)}</tbody>
        </table>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={visitasPorMes} margin={{ top: 8, right: 4, left: -22, bottom: 0 }} barGap={2} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="#f2efea" />
            <XAxis dataKey="mes" tick={EIXO} axisLine={{ stroke: '#eae5de' }} tickLine={false} />
            <YAxis tick={EIXO} allowDecimals={false} axisLine={false} tickLine={false} />
            <Tooltip content={<Dica />} cursor={{ fill: 'rgba(22,42,30,.04)' }} />
            <Bar dataKey="realizadas" name="Realizadas" fill={COR_REALIZADA} radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Bar dataKey="agendadas" name="Agendadas" fill={COR_AGENDADA} radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      )}

      <div className="pg-rodape">
        <span>{melhor && melhor.realizadas > 0 ? `Melhor mês: ${melhor.mes} (${melhor.realizadas})` : 'Sem visitas realizadas no período'}</span>
        <button className="pg-btn" onClick={() => setTabela(t => !t)}>{tabela ? 'Ver gráfico' : 'Ver tabela'}</button>
      </div>
    </div>
  )
}

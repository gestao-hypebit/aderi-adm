'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'

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

type VisitasMesItem = {
  mes: string
  realizadas: number
  agendadas: number
}

type Props = {
  visitasPorMes: VisitasMesItem[]
  colaboradores: DadosColaborador[]
}

const FONT = { fontSize: 11, fontFamily: 'Comfortaa', fill: '#8f978f' }
const TOOLTIP_STYLE = { fontFamily: 'Comfortaa', fontSize: 12, borderRadius: 10, border: '1px solid #eae5de', boxShadow: '0 8px 24px rgba(22,42,30,.12)', padding: '.5rem .75rem' }
const CURSOR = { fill: 'rgba(22,42,30,.04)' }
const LEGEND = { fontSize: 11, fontFamily: 'Comfortaa', paddingTop: 6 }

export default function AdminCharts({ visitasPorMes, colaboradores }: Props) {
  const dadosVisitas = colaboradores.map(c => ({
    nome: c.nome.split(' ')[0],
    Realizadas: c.realizadas,
    Agendadas: c.agendadas,
    Canceladas: c.canceladas,
  }))

  const dadosKm = colaboradores.map(c => ({
    nome: c.nome.split(' ')[0],
    'KM rodado': c.km,
    'Gasto (R$)': Math.round(c.gasto),
  }))

  return (
    <>
      <style>{`
        .adm-charts-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1.1rem;margin-bottom:1.4rem}
        @media(max-width:1100px){.adm-charts-grid{grid-template-columns:1fr 1fr}}
        @media(max-width:700px){.adm-charts-grid{grid-template-columns:1fr}}
        .adm-chart-card{padding:1.15rem 1.25rem 1rem}
        .adm-chart-titulo{font-size:.84rem;font-weight:700;color:#162a1e}
        .adm-chart-sub{font-size:.68rem;color:#8f978f;margin:.2rem 0 .9rem}
        .adm-chart-vazio{color:#b8bdb6;font-size:.78rem;text-align:center;padding:3.5rem 0}
      `}</style>

      <div className="adm-charts-grid">
        {/* Visitas por mês */}
        <div className="ui-card adm-chart-card">
          <div className="adm-chart-titulo">Visitas por mês</div>
          <div className="adm-chart-sub">Últimos 6 meses</div>
          {visitasPorMes.length === 0 ? (
            <div className="adm-chart-vazio">Sem dados</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={visitasPorMes} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <CartesianGrid vertical={false} stroke="#f2efea" />
                <XAxis dataKey="mes" tick={FONT} axisLine={false} tickLine={false} />
                <YAxis tick={FONT} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={CURSOR} />
                <Legend wrapperStyle={LEGEND} iconType="circle" iconSize={8} />
                <Bar dataKey="realizadas" name="Realizadas" fill="#27ae60" radius={[5, 5, 0, 0]} maxBarSize={28} />
                <Bar dataKey="agendadas" name="Agendadas" fill="#E67E22" radius={[5, 5, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Visitas por colaborador */}
        <div className="ui-card adm-chart-card">
          <div className="adm-chart-titulo">Visitas por consultor</div>
          <div className="adm-chart-sub">Período selecionado</div>
          {dadosVisitas.length === 0 ? (
            <div className="adm-chart-vazio">Sem dados</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dadosVisitas} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <CartesianGrid vertical={false} stroke="#f2efea" />
                <XAxis dataKey="nome" tick={FONT} axisLine={false} tickLine={false} />
                <YAxis tick={FONT} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={CURSOR} />
                <Legend wrapperStyle={LEGEND} iconType="circle" iconSize={8} />
                <Bar dataKey="Realizadas" fill="#27ae60" radius={[5, 5, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Agendadas" fill="#E67E22" radius={[5, 5, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Canceladas" fill="#e74c3c" radius={[5, 5, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* KM por colaborador */}
        <div className="ui-card adm-chart-card">
          <div className="adm-chart-titulo">KM por consultor</div>
          <div className="adm-chart-sub">Período selecionado</div>
          {dadosKm.length === 0 ? (
            <div className="adm-chart-vazio">Sem dados</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dadosKm} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <CartesianGrid vertical={false} stroke="#f2efea" />
                <XAxis dataKey="nome" tick={FONT} axisLine={false} tickLine={false} />
                <YAxis tick={FONT} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={CURSOR} />
                <Legend wrapperStyle={LEGEND} iconType="circle" iconSize={8} />
                <Bar dataKey="KM rodado" fill="#162a1e" radius={[5, 5, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </>
  )
}

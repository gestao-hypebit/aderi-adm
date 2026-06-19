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

const FONT = { fontSize: 11, fontFamily: 'Comfortaa', fill: '#aaa' }
const TOOLTIP_STYLE = { fontFamily: 'Comfortaa', fontSize: 12, borderRadius: 8, border: '1px solid #eae5de' }

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
        .adm-charts-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;margin-bottom:1.2rem}
        @media(max-width:1100px){.adm-charts-grid{grid-template-columns:1fr 1fr}}
        @media(max-width:700px){.adm-charts-grid{grid-template-columns:1fr}}
        .adm-chart-card{background:#fff;border-radius:12px;padding:1.2rem 1.4rem;box-shadow:0 2px 8px rgba(0,0,0,.05)}
        .adm-chart-titulo{font-size:.78rem;font-weight:700;color:#162a1e;margin-bottom:.9rem}
        .adm-chart-vazio{color:#bbb;font-size:.78rem;text-align:center;padding:1.5rem 0}
      `}</style>

      <div className="adm-charts-grid">
        {/* Visitas por mês */}
        <div className="adm-chart-card">
          <div className="adm-chart-titulo">Visitas — últimos 6 meses</div>
          {visitasPorMes.length === 0 ? (
            <div className="adm-chart-vazio">Sem dados</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={visitasPorMes} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                <XAxis dataKey="mes" tick={FONT} />
                <YAxis tick={FONT} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Comfortaa' }} />
                <Bar dataKey="realizadas" name="Realizadas" fill="#27ae60" radius={[3, 3, 0, 0]} />
                <Bar dataKey="agendadas" name="Agendadas" fill="#E67E22" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Visitas por colaborador */}
        <div className="adm-chart-card">
          <div className="adm-chart-titulo">Visitas por consultor — período</div>
          {dadosVisitas.length === 0 ? (
            <div className="adm-chart-vazio">Sem dados</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dadosVisitas} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                <XAxis dataKey="nome" tick={FONT} />
                <YAxis tick={FONT} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Comfortaa' }} />
                <Bar dataKey="Realizadas" fill="#27ae60" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Agendadas" fill="#E67E22" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Canceladas" fill="#e74c3c" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* KM por colaborador */}
        <div className="adm-chart-card">
          <div className="adm-chart-titulo">KM por consultor — período</div>
          {dadosKm.length === 0 ? (
            <div className="adm-chart-vazio">Sem dados</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dadosKm} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                <XAxis dataKey="nome" tick={FONT} />
                <YAxis tick={FONT} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Comfortaa' }} />
                <Bar dataKey="KM rodado" fill="#162a1e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </>
  )
}

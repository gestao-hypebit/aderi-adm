'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type Props = {
  dados: { mes: string; realizadas: number; agendadas: number }[]
}

export default function DashboardCharts({ dados }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={dados} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8"/>
        <XAxis dataKey="mes" tick={{ fontSize: 11, fontFamily: 'Comfortaa', fill: '#aaa' }}/>
        <YAxis tick={{ fontSize: 11, fontFamily: 'Comfortaa', fill: '#aaa' }} allowDecimals={false}/>
        <Tooltip contentStyle={{ fontFamily: 'Comfortaa', fontSize: 12, borderRadius: 8, border: '1px solid #eae5de' }}/>
        <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Comfortaa' }}/>
        <Bar dataKey="realizadas" name="Realizadas" fill="#27ae60" radius={[4,4,0,0]}/>
        <Bar dataKey="agendadas" name="Agendadas" fill="#E67E22" radius={[4,4,0,0]}/>
      </BarChart>
    </ResponsiveContainer>
  )
}
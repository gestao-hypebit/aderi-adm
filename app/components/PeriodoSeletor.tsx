'use client'

import { useState } from 'react'
import { ATALHOS, INICIO_SEMPRE, FIM_SEMPRE, calcRange, detectAtalho } from '@/lib/dateUtils'

type Props = { inicio: string; fim: string; onChange: (inicio: string, fim: string) => void }

// Atalhos de período + datas personalizadas (mesmo visual da barra do dashboard), controlado por estado
export default function PeriodoSeletor({ inicio, fim, onChange }: Props) {
  const vazio = (d: string) => (d === INICIO_SEMPRE || d === FIM_SEMPRE ? '' : d)
  const [ini, setIni] = useState(vazio(inicio))
  const [ate, setAte] = useState(vazio(fim))
  const ativo = detectAtalho(inicio, fim)
  const alterado = ini !== vazio(inicio) || ate !== vazio(fim)

  function aplicar() {
    const a = ini || INICIO_SEMPRE
    const b = ate || FIM_SEMPRE
    if (a <= b) onChange(a, b)
  }

  return (
    <div className="ps-wrap">
      <style>{`
        .ps-wrap{background:#fff;border-radius:12px;padding:.65rem 1rem;box-shadow:0 2px 8px rgba(0,0,0,.04);margin-bottom:1rem;display:flex;flex-wrap:wrap;gap:.45rem;align-items:center}
        .ps-btn{background:#f0ede8;border:1.5px solid transparent;border-radius:20px;padding:.28rem .8rem;font-family:'Poppins',sans-serif;font-size:.7rem;font-weight:600;color:#888;cursor:pointer;white-space:nowrap}
        .ps-btn:hover{border-color:#E67E22;color:#E67E22}
        .ps-btn.ativo{background:#162a1e;color:#fff;border-color:#162a1e}
        .ps-sep{width:1px;background:#eae5de;height:20px;flex-shrink:0}
        .ps-datas{display:flex;gap:.4rem;align-items:center;flex-wrap:wrap}
        .ps-input{padding:.28rem .5rem;border:1.5px solid #eae5de;border-radius:7px;font-family:'Poppins',sans-serif;font-size:.74rem;color:#162a1e;background:#fff;outline:none}
        .ps-input.custom{border-color:#E67E22}
        .ps-ate{font-size:.7rem;color:#aaa;font-weight:600}
        .ps-aplicar{background:#E67E22;color:#fff;border:none;border-radius:7px;padding:.28rem .8rem;font-family:'Poppins',sans-serif;font-size:.7rem;font-weight:600;cursor:pointer}
        @media(max-width:600px){.ps-sep{display:none}}
      `}</style>
      {ATALHOS.map(([k, label]) => (
        <button key={k} type="button" className={`ps-btn ${ativo === k ? 'ativo' : ''}`}
          onClick={() => { const r = calcRange(k); setIni(vazio(r.inicio)); setAte(vazio(r.fim)); onChange(r.inicio, r.fim) }}>
          {label}
        </button>
      ))}
      <div className="ps-sep" />
      <div className="ps-datas">
        <input type="date" className={`ps-input${ativo === null ? ' custom' : ''}`} value={ini} onChange={e => setIni(e.target.value)} aria-label="Data inicial" />
        <span className="ps-ate">até</span>
        <input type="date" className={`ps-input${ativo === null ? ' custom' : ''}`} value={ate} onChange={e => setAte(e.target.value)} aria-label="Data final" />
        {alterado && <button type="button" className="ps-aplicar" onClick={aplicar}>Aplicar</button>}
      </div>
    </div>
  )
}

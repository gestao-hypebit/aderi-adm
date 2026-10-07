'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ATALHOS, INICIO_SEMPRE, FIM_SEMPRE, calcRange, detectAtalho } from '@/lib/dateUtils'

type Props = { inicio: string; fim: string }

export default function DashboardPeriodoBar({ inicio, fim }: Props) {
  const router = useRouter()
  // "Desde o início" usa limites 2000/2099: nos campos aparecem vazios
  const vazio = (d: string) => (d === INICIO_SEMPRE || d === FIM_SEMPRE ? '' : d)
  const [customInicio, setCustomInicio] = useState(vazio(inicio))
  const [customFim, setCustomFim] = useState(vazio(fim))

  const presetAtivo = detectAtalho(inicio, fim)
  const ehPersonalizado = presetAtivo === null

  function navegar(ini: string, f: string) {
    router.push(`/dashboard?inicio=${ini}&fim=${f}`)
  }

  function aplicarCustom() {
    const ini = customInicio || INICIO_SEMPRE
    const f = customFim || FIM_SEMPRE
    if (ini <= f) navegar(ini, f)
  }

  const customAlterado = customInicio !== vazio(inicio) || customFim !== vazio(fim)

  return (
    <>
      <style>{`
        .dpb-wrap{background:#fff;border-radius:12px;padding:.75rem 1.2rem;box-shadow:0 2px 8px rgba(0,0,0,.04);margin-bottom:1.2rem;display:flex;flex-wrap:wrap;gap:.5rem;align-items:center}
        .dpb-btn{background:#f0ede8;border:1.5px solid transparent;border-radius:20px;padding:.3rem .85rem;font-family:'Poppins',sans-serif;font-size:.72rem;font-weight:600;color:#888;cursor:pointer;transition:all .15s;white-space:nowrap}
        .dpb-btn:hover{border-color:#E67E22;color:#E67E22}
        .dpb-btn.ativo{background:#162a1e;color:#fff;border-color:#162a1e}
        .dpb-sep{width:1px;background:#eae5de;height:20px;flex-shrink:0}
        .dpb-datas{display:flex;gap:.4rem;align-items:center}
        .dpb-input{padding:.3rem .55rem;border:1.5px solid #eae5de;border-radius:7px;font-family:'Poppins',sans-serif;font-size:.75rem;color:#162a1e;background:#fff;outline:none;transition:border-color .15s}
        .dpb-input.custom{border-color:#E67E22}
        .dpb-ate{font-size:.7rem;color:#aaa;font-weight:600}
        .dpb-aplicar{background:#E67E22;color:#fff;border:none;border-radius:7px;padding:.3rem .85rem;font-family:'Poppins',sans-serif;font-size:.72rem;font-weight:600;cursor:pointer;transition:opacity .15s}
        .dpb-aplicar:hover{opacity:.85}
      `}</style>

      <div className="dpb-wrap">
        {ATALHOS.map(([key, label]) => (
          <button
            key={key}
            className={`dpb-btn ${presetAtivo === key ? 'ativo' : ''}`}
            onClick={() => { const r = calcRange(key); setCustomInicio(vazio(r.inicio)); setCustomFim(vazio(r.fim)); navegar(r.inicio, r.fim) }}
          >
            {label}
          </button>
        ))}

        <div className="dpb-sep" />

        <div className="dpb-datas">
          <input
            type="date"
            className={`dpb-input${ehPersonalizado ? ' custom' : ''}`}
            value={customInicio}
            onChange={e => setCustomInicio(e.target.value)}
          />
          <span className="dpb-ate">até</span>
          <input
            type="date"
            className={`dpb-input${ehPersonalizado ? ' custom' : ''}`}
            value={customFim}
            onChange={e => setCustomFim(e.target.value)}
          />
          {customAlterado && (
            <button className="dpb-aplicar" onClick={aplicarCustom}>Aplicar</button>
          )}
        </div>
      </div>
    </>
  )
}

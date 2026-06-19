'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Props = { inicio: string; fim: string }

function getRange(tipo: string): { inicio: string; fim: string } {
  const hoje = new Date()
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  if (tipo === 'hoje') return { inicio: fmt(hoje), fim: fmt(hoje) }
  if (tipo === 'esta-semana') {
    const dow = hoje.getDay()
    const seg = new Date(hoje)
    seg.setDate(hoje.getDate() - (dow === 0 ? 6 : dow - 1))
    const dom = new Date(seg)
    dom.setDate(seg.getDate() + 6)
    return { inicio: fmt(seg), fim: fmt(dom) }
  }
  if (tipo === 'este-mes') {
    return {
      inicio: fmt(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
      fim: fmt(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)),
    }
  }
  if (tipo === 'mes-passado') {
    return {
      inicio: fmt(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)),
      fim: fmt(new Date(hoje.getFullYear(), hoje.getMonth(), 0)),
    }
  }
  return {
    inicio: fmt(new Date(hoje.getFullYear(), 0, 1)),
    fim: fmt(new Date(hoje.getFullYear(), 11, 31)),
  }
}

const PRESETS = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'esta-semana', label: 'Esta semana' },
  { key: 'este-mes', label: 'Este mês' },
  { key: 'mes-passado', label: 'Mês passado' },
  { key: 'este-ano', label: 'Este ano' },
] as const

function detectPreset(inicio: string, fim: string): string | null {
  for (const p of PRESETS) {
    const r = getRange(p.key)
    if (r.inicio === inicio && r.fim === fim) return p.key
  }
  return null
}

export default function DashboardPeriodoBar({ inicio, fim }: Props) {
  const router = useRouter()
  const [customInicio, setCustomInicio] = useState(inicio)
  const [customFim, setCustomFim] = useState(fim)

  const presetAtivo = detectPreset(inicio, fim)
  const ehPersonalizado = presetAtivo === null

  function navegar(ini: string, f: string) {
    router.push(`/dashboard?inicio=${ini}&fim=${f}`)
  }

  function aplicarCustom() {
    if (customInicio && customFim && customInicio <= customFim) {
      navegar(customInicio, customFim)
    }
  }

  const customAlterado = customInicio !== inicio || customFim !== fim

  return (
    <>
      <style>{`
        .dpb-wrap{background:#fff;border-radius:12px;padding:.75rem 1.2rem;box-shadow:0 2px 8px rgba(0,0,0,.04);margin-bottom:1.2rem;display:flex;flex-wrap:wrap;gap:.5rem;align-items:center}
        .dpb-btn{background:#f0ede8;border:1.5px solid transparent;border-radius:20px;padding:.3rem .85rem;font-family:'Comfortaa',sans-serif;font-size:.72rem;font-weight:700;color:#888;cursor:pointer;transition:all .15s;white-space:nowrap}
        .dpb-btn:hover{border-color:#E67E22;color:#E67E22}
        .dpb-btn.ativo{background:#162a1e;color:#fff;border-color:#162a1e}
        .dpb-sep{width:1px;background:#eae5de;height:20px;flex-shrink:0}
        .dpb-datas{display:flex;gap:.4rem;align-items:center}
        .dpb-input{padding:.3rem .55rem;border:1.5px solid #eae5de;border-radius:7px;font-family:'Comfortaa',sans-serif;font-size:.75rem;color:#162a1e;background:#fff;outline:none;transition:border-color .15s}
        .dpb-input.custom{border-color:#E67E22}
        .dpb-ate{font-size:.7rem;color:#aaa;font-weight:700}
        .dpb-aplicar{background:#E67E22;color:#fff;border:none;border-radius:7px;padding:.3rem .85rem;font-family:'Comfortaa',sans-serif;font-size:.72rem;font-weight:700;cursor:pointer;transition:opacity .15s}
        .dpb-aplicar:hover{opacity:.85}
      `}</style>

      <div className="dpb-wrap">
        {PRESETS.map(p => (
          <button
            key={p.key}
            className={`dpb-btn ${presetAtivo === p.key ? 'ativo' : ''}`}
            onClick={() => { const r = getRange(p.key); setCustomInicio(r.inicio); setCustomFim(r.fim); navegar(r.inicio, r.fim) }}
          >
            {p.label}
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

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export type ComboOpcao = { id: string; label: string; sub?: string | null }

type Props = {
  opcoes: ComboOpcao[]
  valor: string
  onChange: (id: string) => void
  placeholder?: string
  vazioTexto?: string
  acaoExtra?: { label: string; onClick: () => void }
}

// Seletor com busca: digitar filtra, setas navegam, Enter escolhe.
export default function Combobox({ opcoes, valor, onChange, placeholder = 'Buscar...', vazioTexto = 'Nenhum resultado', acaoExtra }: Props) {
  const [aberto, setAberto] = useState(false)
  const [termo, setTermo] = useState('')
  const [ativo, setAtivo] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)

  const selecionada = opcoes.find(o => o.id === valor)

  const filtradas = useMemo(() => {
    const t = termo.trim().toLowerCase()
    const base = t
      ? opcoes.filter(o => o.label.toLowerCase().includes(t) || (o.sub ?? '').toLowerCase().includes(t))
      : opcoes
    return base.slice(0, 60)
  }, [opcoes, termo])

  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [])

  useEffect(() => {
    listaRef.current?.querySelector<HTMLElement>(`[data-idx="${ativo}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [ativo])

  function abrir() {
    setTermo('')
    setAtivo(0)
    setAberto(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function escolher(o: ComboOpcao) {
    onChange(o.id)
    setAberto(false)
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo(a => Math.min(a + 1, filtradas.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo(a => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtradas[ativo]) escolher(filtradas[ativo]) }
    else if (e.key === 'Escape') { setAberto(false) }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <style>{`
        .cb-trigger{width:100%;display:flex;align-items:center;gap:.6rem;text-align:left;padding:.62rem .9rem;border:1.5px solid #eae5de;border-radius:8px;background:#fff;font-family:'Comfortaa',sans-serif;font-size:.84rem;color:#162a1e;cursor:pointer;transition:border-color .15s,box-shadow .15s;min-height:44px}
        .cb-trigger:hover{border-color:#ddd6cc}
        .cb-trigger:focus-visible{outline:none;border-color:#E67E22;box-shadow:0 0 0 3px rgba(230,126,34,.12)}
        .cb-trigger-txt{flex:1;min-width:0}
        .cb-trigger-label{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .cb-trigger-sub{font-size:.7rem;color:#E67E22;font-weight:700;margin-top:.1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .cb-placeholder{color:#b8bdb6}
        .cb-pop{position:absolute;top:calc(100% + 6px);left:0;right:0;background:#fff;border:1px solid #eae5de;border-radius:12px;box-shadow:0 16px 40px rgba(22,42,30,.16);z-index:400;overflow:hidden}
        .cb-search{width:100%;border:none;border-bottom:1px solid #f2efea;padding:.75rem .9rem .75rem 2.2rem;font-family:'Comfortaa',sans-serif;font-size:.82rem;color:#162a1e;outline:none;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238f978f' stroke-width='2.2'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'/%3E%3C/svg%3E") no-repeat .8rem center}
        .cb-lista{max-height:260px;overflow-y:auto;padding:.3rem}
        .cb-opt{display:block;width:100%;text-align:left;border:none;background:none;padding:.55rem .7rem;border-radius:8px;cursor:pointer;font-family:'Comfortaa',sans-serif}
        .cb-opt.ativo{background:#f7f5f1}
        .cb-opt.sel .cb-opt-label{color:#E67E22}
        .cb-opt-label{font-size:.8rem;font-weight:700;color:#162a1e}
        .cb-opt-sub{font-size:.68rem;color:#8f978f;margin-top:.1rem}
        .cb-vazio{padding:1rem;text-align:center;font-size:.76rem;color:#8f978f}
        .cb-extra{display:block;width:100%;border:none;border-top:1px solid #f2efea;background:#faf8f5;padding:.7rem .9rem;text-align:left;font-family:'Comfortaa',sans-serif;font-size:.76rem;font-weight:700;color:#E67E22;cursor:pointer}
        .cb-extra:hover{background:#fdf3e9}
      `}</style>

      <button type="button" className="cb-trigger" onClick={() => (aberto ? setAberto(false) : abrir())} aria-haspopup="listbox" aria-expanded={aberto}>
        <span className="cb-trigger-txt">
          {selecionada ? (
            <>
              <div className="cb-trigger-label">{selecionada.label}</div>
              {selecionada.sub && <div className="cb-trigger-sub">{selecionada.sub}</div>}
            </>
          ) : <span className="cb-placeholder">{placeholder}</span>}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8f978f" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </button>

      {aberto && (
        <div className="cb-pop">
          <input
            ref={inputRef}
            className="cb-search"
            placeholder="Digite para buscar..."
            value={termo}
            onChange={e => { setTermo(e.target.value); setAtivo(0) }}
            onKeyDown={onKey}
          />
          <div className="cb-lista" ref={listaRef} role="listbox">
            {filtradas.length === 0 ? (
              <div className="cb-vazio">{vazioTexto}</div>
            ) : filtradas.map((o, i) => (
              <button
                type="button"
                key={o.id}
                data-idx={i}
                role="option"
                aria-selected={o.id === valor}
                className={`cb-opt ${i === ativo ? 'ativo' : ''} ${o.id === valor ? 'sel' : ''}`}
                onMouseEnter={() => setAtivo(i)}
                onClick={() => escolher(o)}
              >
                <div className="cb-opt-label">{o.label}</div>
                {o.sub && <div className="cb-opt-sub">{o.sub}</div>}
              </button>
            ))}
          </div>
          {acaoExtra && (
            <button type="button" className="cb-extra" onClick={() => { setAberto(false); acaoExtra.onClick() }}>
              {acaoExtra.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect } from 'react'

type Props = {
  aberto: boolean
  titulo: string
  children?: React.ReactNode
  confirmarTexto?: string
  perigo?: boolean
  carregando?: boolean
  onConfirmar: () => void
  onCancelar: () => void
}

function IconAlert() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
}

export default function ConfirmDialog({ aberto, titulo, children, confirmarTexto = 'Confirmar', perigo = false, carregando = false, onConfirmar, onCancelar }: Props) {
  useEffect(() => {
    if (!aberto) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && !carregando) onCancelar() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [aberto, carregando, onCancelar])

  if (!aberto) return null

  return (
    <div className="ui-modal-overlay" onClick={e => { if (e.target === e.currentTarget && !carregando) onCancelar() }}>
      <div className="ui-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-titulo" style={{ maxWidth: 440 }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: perigo ? '#fdeeec' : '#fdf3e9', color: perigo ? '#e74c3c' : '#E67E22',
          }}>
            <IconAlert />
          </div>
          <div style={{ minWidth: 0 }}>
            <div id="confirm-titulo" style={{ fontSize: '1rem', fontWeight: 600, color: '#162a1e', lineHeight: 1.3 }}>{titulo}</div>
            {children && <div style={{ fontSize: '.8rem', color: '#5b6660', lineHeight: 1.6, marginTop: '.45rem' }}>{children}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '.6rem', justifyContent: 'flex-end', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <button className="ui-btn ui-btn-ghost" onClick={onCancelar} disabled={carregando}>Cancelar</button>
          <button
            className={`ui-btn ${perigo ? 'ui-btn-danger' : 'ui-btn-primary'}`}
            style={perigo ? { background: '#e74c3c', color: '#fff', borderColor: '#e74c3c' } : undefined}
            onClick={onConfirmar}
            disabled={carregando}
            autoFocus
          >
            {carregando ? 'Aguarde...' : confirmarTexto}
          </button>
        </div>
      </div>
    </div>
  )
}

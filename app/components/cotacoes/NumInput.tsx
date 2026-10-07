'use client'

import { useState } from 'react'

// Campo numérico no padrão brasileiro (vírgula decimal). Em modo "pct" o usuário
// digita 5 e o valor guardado é 0,05.
export function parseNumero(txt: string) {
  let t = txt.trim().replace(/\s|R\$|%/g, '')
  if (!t) return 0
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(t)
  return isNaN(n) ? 0 : n
}

type Props = {
  valor: number
  onChange: (n: number) => void
  casas?: number
  pct?: boolean
  className?: string
  placeholder?: string
  disabled?: boolean
  ariaLabel?: string
  inputProps?: React.InputHTMLAttributes<HTMLInputElement> & { [k: `data-${string}`]: string | number }
}

export default function NumInput({ valor, onChange, casas = 2, pct = false, className = 'ui-input', placeholder, disabled, ariaLabel, inputProps }: Props) {
  const [texto, setTexto] = useState<string | null>(null)
  const exibido = pct ? valor * 100 : valor
  const formatado = exibido ? exibido.toLocaleString('pt-BR', { minimumFractionDigits: pct ? 0 : casas, maximumFractionDigits: pct ? 4 : casas }) : ''
  return (
    <input
      {...inputProps}
      className={className}
      inputMode="decimal"
      value={texto ?? formatado}
      placeholder={placeholder ?? (pct ? '0' : '0,00')}
      disabled={disabled}
      aria-label={ariaLabel}
      onFocus={e => { setTexto(formatado); requestAnimationFrame(() => e.target.select()) }}
      onChange={e => {
        setTexto(e.target.value)
        const n = parseNumero(e.target.value)
        onChange(pct ? n / 100 : n)
      }}
      onBlur={() => setTexto(null)}
    />
  )
}

'use client'

import { useRef, useState } from 'react'

// Campo numérico no padrão brasileiro (vírgula decimal, ponto de milhar). Em modo "pct" o usuário
// digita 5 e o valor guardado é 0,05.
export function parseNumero(txt: string) {
  let t = txt.trim().replace(/\s|R\$|%/g, '')
  if (!t) return 0
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  // "1.330" ou "12.500.000" sem vírgula: os pontos são separadores de milhar
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')
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
  const acabouDeFocar = useRef(false)
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
      // Seleciona tudo na hora do foco (não depois): se a seleção chegasse atrasada,
      // apagaria o primeiro dígito já digitado.
      onFocus={e => { setTexto(formatado); e.target.select(); acabouDeFocar.current = true }}
      // o clique que deu o foco não deve desfazer a seleção
      onMouseUp={e => { if (acabouDeFocar.current) { e.preventDefault(); acabouDeFocar.current = false } }}
      onChange={e => {
        acabouDeFocar.current = false
        setTexto(e.target.value)
        const n = parseNumero(e.target.value)
        onChange(pct ? n / 100 : n)
      }}
      onBlur={() => { setTexto(null); acabouDeFocar.current = false }}
    />
  )
}

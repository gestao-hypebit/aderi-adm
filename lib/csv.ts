// Gera e baixa um CSV compatível com o Excel em português (separador ";" e BOM UTF-8).
export function baixarCsv(nomeArquivo: string, colunas: string[], linhas: (string | number | null | undefined)[][]) {
  const escapar = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v)
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const conteudo = [colunas, ...linhas].map(l => l.map(escapar).join(';')).join('\r\n')
  const blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo.endsWith('.csv') ? nomeArquivo : `${nomeArquivo}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export const dataBR = (d: string | null | undefined) =>
  d ? new Date(d.length === 10 ? d + 'T12:00' : d).toLocaleDateString('pt-BR') : ''

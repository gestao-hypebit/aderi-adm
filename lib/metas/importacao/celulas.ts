import type { Cell, Worksheet } from 'exceljs'

// Valor "visível" da célula no exceljs: resultado da fórmula, texto do rich text, hiperlink...
export function valor(cell: Cell | undefined): unknown {
  const v = cell?.value as unknown
  if (v == null) return null
  if (v instanceof Date) return v
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    if ('result' in o) return o.result instanceof Date || typeof o.result !== 'object' ? o.result ?? null : null
    if ('richText' in o && Array.isArray(o.richText)) return (o.richText as { text: string }[]).map(t => t.text).join('')
    if ('text' in o) return o.text
    if ('error' in o) return null
    return null
  }
  return v
}

// Em célula mesclada o exceljs repete o valor em todas; só a principal conta
// (o rótulo "TOTAL FATURAMENTO..." mesclado de C a F não pode virar produto na coluna D).
export function celula(ws: Worksheet, linha: number, coluna: number) {
  const c = ws.getRow(linha).getCell(coluna)
  if (c.isMerged && c.master.address !== c.address) return null
  return valor(c)
}

export function numero(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') {
    const s = v.trim()
    if (!s || s === '-') return null
    // "1.234,56" ou "1234.56"
    const n = Number(/,\d{1,}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''))
    return Number.isFinite(n) ? n : null
  }
  return null
}

export const texto = (v: unknown) => (v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim())

// Data em AAAA-MM-DD. Aceita Date do exceljs (meia-noite UTC) e número serial do Excel.
// Texto não é aceito: as planilhas têm datas digitadas erradas ("30/092026").
export function dataISO(v: unknown): string | null {
  let d: Date | null = null
  if (v instanceof Date) d = v
  else if (typeof v === 'number' && v > 20000 && v < 80000) d = new Date(Math.round((v - 25569) * 86400000))
  if (!d || Number.isNaN(d.getTime())) return null
  const iso = d.toISOString().slice(0, 10)
  const ano = Number(iso.slice(0, 4))
  return ano >= 2000 && ano <= 2100 ? iso : null
}

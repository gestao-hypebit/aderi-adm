// Exportação para Excel (.xlsx) no navegador, com números de verdade (não texto) e formato pt-BR.
export type FormatoColuna = 'texto' | 'brl' | 'pct' | 'num' | 'data'
export type ColunaExcel = { titulo: string; formato?: FormatoColuna; largura?: number }
export type AbaExcel = { nome: string; colunas: ColunaExcel[]; linhas: (string | number | null | undefined)[][]; total?: (string | number | null | undefined)[] }

const FORMATOS: Record<FormatoColuna, string | undefined> = {
  texto: undefined,
  brl: '"R$" #,##0.00;[Red]-"R$" #,##0.00',
  pct: '0.0%',
  num: '#,##0.###',
  data: 'dd/mm/yyyy',
}

// Excel limita o nome da aba a 31 caracteres e proíbe alguns símbolos
const nomeAba = (s: string) => s.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31)

export async function gerarXlsx(abas: AbaExcel[]): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Aderi Agro'
  for (const aba of abas) {
    const ws = wb.addWorksheet(nomeAba(aba.nome), { views: [{ state: 'frozen', ySplit: 1 }] })
    ws.columns = aba.colunas.map(c => ({ header: c.titulo, width: c.largura ?? (c.formato === 'texto' || !c.formato ? 28 : 16), style: { numFmt: FORMATOS[c.formato ?? 'texto'] } }))
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF162A1E' } }
    const converter = (v: string | number | null | undefined, i: number) =>
      aba.colunas[i]?.formato === 'data' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? new Date(v.slice(0, 10) + 'T12:00:00Z') : v ?? null
    for (const l of aba.linhas) ws.addRow(l.map(converter))
    if (aba.total) ws.addRow(aba.total.map(converter)).font = { bold: true }
  }
  const buf = await wb.xlsx.writeBuffer()
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export async function baixarXlsx(nomeArquivo: string, abas: AbaExcel[]) {
  const blob = await gerarXlsx(abas)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo.endsWith('.xlsx') ? nomeArquivo : `${nomeArquivo}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

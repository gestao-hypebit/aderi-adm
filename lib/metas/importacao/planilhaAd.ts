import type { Workbook } from 'exceljs'
import { normalizar } from '../nomes'
import { celula, dataISO, numero, texto } from './celulas'
import type { LayoutImportacao, LinhaLida, TotalPlanilha } from './tipos'

// Planilha mensal "00X - MÊS - 26 AD", primeira aba.
// A aba tem um ou mais blocos (Verde Agro, Venda Direta), cada um começando numa linha com
// "Data:" na coluna A e terminando numa linha de total. O último total é o do mês.
const MESES = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO']

// "JANEIRO // 2026", "AGOSTO  // 26" ou uma data → AAAA-MM-01
export function competenciaDe(v: unknown): string | null {
  const iso = dataISO(v)
  if (iso) return iso.slice(0, 8) + '01'
  const n = normalizar(v)
  const m = MESES.findIndex(nome => n.startsWith(nome))
  const ano = n.match(/(\d{4}|\d{2})\s*$/)?.[1]
  if (m < 0 || !ano) return null
  return `${ano.length === 2 ? '20' + ano : ano}-${String(m + 1).padStart(2, '0')}-01`
}

const COL = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9, J: 10, K: 11, M: 13, N: 14, O: 15, R: 18, S: 19, T: 20, AA: 27 }

export const planilhaAd: LayoutImportacao = {
  id: 'planilha-ad',
  nome: 'Planilha mensal AD (colunas A–K e M–S)',
  ler(wb, arquivo) {
    const ws = wb.worksheets[0]
    const linhas: LinhaLida[] = []
    const totais: TotalPlanilha[] = []
    let dentro = false

    for (let r = 1; r <= ws.rowCount; r++) {
      const c = (col: number) => celula(ws, r, col)
      const a = c(COL.A)
      if (typeof a === 'string' && normalizar(a).startsWith('DATA')) { dentro = true; continue }
      if (!dentro) continue

      const produto = texto(c(COL.D))
      const g = numero(c(COL.G))
      const rotulo = [c(COL.A), c(COL.B), c(COL.C)].map(texto).join(' ').trim()
      const ehData = dataISO(a) != null

      // Linha de total: rótulo "TOTAL..."/"FATURAMENTO..." ou só o valor em G, sem data nem produto
      if (!ehData && !produto && g != null && (/TOTAL|FATURAMENTO/.test(normalizar(rotulo)) || !rotulo)) {
        totais.push({ linha: r, rotulo: rotulo.replace(/\.{3,}/g, '').trim(), valor: g })
        continue
      }
      if (!produto && g == null && !ehData) continue // linha em branco

      const textos = Array.from({ length: COL.K }, (_, i) => texto(c(i + 1)))
      const cancelada = textos.some(t => normalizar(t).includes('CANCELAD')) || normalizar(c(COL.K)) === 'CANC'
      const data = dataISO(a)

      linhas.push({
        linha: r,
        data,
        data_bruta: texto(a),
        dav: texto(c(COL.B)),
        cliente: texto(c(COL.C)),
        produto,
        quantidade: numero(c(COL.E)),
        preco_unitario: numero(c(COL.F)),
        faturamento: g,
        grupo: texto(c(COL.H)),
        consultor: texto(c(COL.I)),
        modalidade: texto(c(COL.J)),
        tipo: texto(c(COL.K)),
        custo_unitario: numero(c(COL.M)),
        frete_unitario: numero(c(COL.N)),
        desconto_unitario: numero(c(COL.O)),
        data_pagamento_compra: dataISO(c(COL.R)),
        data_recebimento: dataISO(c(COL.S)),
        aliquota_imposto: numero(c(COL.AA)),
        ignorada: cancelada ? 'cancelada' : data == null ? 'sem_data' : null,
      })
    }

    const comRotulo = totais.filter(t => /TOTAL/.test(normalizar(t.rotulo)))
    const total_geral = (comRotulo.at(-1) ?? totais.at(-1))?.valor ?? null
    return {
      arquivo,
      aba: ws.name,
      linhas,
      totais,
      total_geral,
      // B22 fica junto do cabeçalho e é a confiável; C1 às vezes ficou com o mês da cópia
      competencia: competenciaDe(celula(ws, 22, COL.B)) ?? competenciaDe(celula(ws, 1, COL.C)),
      taxa_juros_mensal: numero(celula(ws, 22, COL.T)),
    }
  },
}

export const LAYOUTS: LayoutImportacao[] = [planilhaAd]

// Usado na prévia para a pessoa conferir o layout
export function lerWorkbook(wb: Workbook, arquivo: string, layoutId = 'planilha-ad') {
  const layout = LAYOUTS.find(l => l.id === layoutId)
  if (!layout) throw new Error(`Layout de importação desconhecido: ${layoutId}`)
  return layout.ler(wb, arquivo)
}

import type { Worksheet } from 'exceljs'
import { normalizar } from '../nomes'
import { celula, numero, texto } from './celulas'

// Planilha "<Consultor> - 2026", primeira aba.
//  · linhas 5–9, coluna D: meta anual por grupo; coluna E: realizado do ano (digitado/fórmula)
//  · linhas 14–18, F–Q: realizado do ano anterior mês a mês
//  · linhas 25–29, F–Q: meta do ano mês a mês
// Grupos sempre nesta ordem: Defensivos, Diversos, Fertilizantes, Foliares, Sementes.
export const ORDEM_GRUPOS = ['Defensivos', 'Diversos', 'Fertilizantes', 'Foliares', 'Sementes']
const PREFIXOS = ['DEFENSIVO', 'DIVERSO', 'FERTILIZANTE', 'FOLIAR', 'SEMENTE']

export type LeituraConsultor = {
  aba: string
  meta_mensal: number[][]       // [grupo][mês]
  meta_anual_planilha: number[] // coluna D
  realizado_ano_planilha: number[] // coluna E, linhas 5–9
  realizado_anterior: number[][]
  avisos: string[]
}

export function lerPlanilhaConsultor(ws: Worksheet): LeituraConsultor {
  const avisos: string[] = []
  const bloco = (linha0: number) =>
    PREFIXOS.map((p, i) => {
      const r = linha0 + i
      const rotulo = normalizar(texto(celula(ws, r, 2)))
      if (!rotulo.startsWith(p)) avisos.push(`Linha ${r}: esperado grupo ${ORDEM_GRUPOS[i]}, encontrado "${rotulo}"`)
      return Array.from({ length: 12 }, (_, m) => numero(celula(ws, r, 6 + m)) ?? 0)
    })

  const meta_mensal = bloco(25)
  const realizado_anterior = bloco(14)
  const meta_anual_planilha = PREFIXOS.map((_, i) => numero(celula(ws, 5 + i, 4)) ?? 0)
  const realizado_ano_planilha = PREFIXOS.map((_, i) => numero(celula(ws, 5 + i, 5)) ?? 0)

  meta_mensal.forEach((meses, i) => {
    const soma = meses.reduce((a, b) => a + b, 0)
    if (Math.abs(soma - meta_anual_planilha[i]) > 0.005)
      avisos.push(`${ORDEM_GRUPOS[i]}: soma dos meses (${soma}) difere da meta anual da coluna D (${meta_anual_planilha[i]})`)
  })
  return { aba: ws.name, meta_mensal, meta_anual_planilha, realizado_ano_planilha, realizado_anterior, avisos }
}

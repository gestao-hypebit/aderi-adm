import { normalizar } from '../nomes'

// As planilhas não têm coluna de unidade. Para fertilizantes inferimos as toneladas:
//  · preço a partir de R$ 1.000 por unidade → vendido por tonelada (inferido pelo preço).
//    Vale mesmo com embalagem no nome: "AD - 18.04.17 ((01 SACO DE 50 KG))" vem com qtd 0,05.
//  · "TON"/"TONELADA" no nome → a própria quantidade
//  · embalagem no nome ("SACARIA 50KG", "SC 25 KG") → quantidade × kg / 1000
//  · o resto fica sem tonelada e vai para o relatório
export type OrigemToneladas = 'nome' | 'preco' | null
export const PRECO_MINIMO_TONELADA = 1000

export function inferirToneladas(produto: string, quantidade: number | null, precoUnitario: number | null): { toneladas: number | null; origem: OrigemToneladas; motivo?: string } {
  const q = quantidade ?? 0
  if (!(q > 0)) return { toneladas: null, origem: null, motivo: 'sem quantidade' }
  const n = normalizar(produto)
  const preco = precoUnitario ?? 0
  const porPreco = preco >= PRECO_MINIMO_TONELADA

  if (porPreco) return { toneladas: q, origem: 'preco' }
  if (/\bTON(ELADAS?)?\b|\bTN\b/.test(n)) return { toneladas: q, origem: 'nome' }
  const kg = n.match(/(\d+(?:[.,]\d+)?)\s*KGS?\b/)
  if (kg) return { toneladas: (q * Number(kg[1].replace(',', '.'))) / 1000, origem: 'nome' }
  return { toneladas: null, origem: null, motivo: `preço unitário ${preco} não indica tonelada e o nome não traz embalagem` }
}

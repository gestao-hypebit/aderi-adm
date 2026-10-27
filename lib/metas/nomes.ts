// Resolução dos nomes digitados nas planilhas ("GILVAM", "FOLIAR", "CV"...) para o cadastro.
// Primeiro compara com o próprio cadastro (normalizado); depois com o mapeamento salvo.

export type TipoMapeamento = 'consultor' | 'grupo' | 'modalidade' | 'tipo'
export type Mapeamento = { tipo: TipoMapeamento; texto_original: string; valor: string }
export type Opcao = { valor: string; rotulo: string; sinonimos?: string[] }

export const MODALIDADES: Opcao[] = [
  { valor: 'VERDE_AGRO', rotulo: 'Verde Agro', sinonimos: ['VERDE AGRO'] },
  { valor: 'VENDA_DIRETA', rotulo: 'Venda Direta', sinonimos: ['VENDA DIRETA'] },
]
export const TIPOS: Opcao[] = [
  { valor: 'DIF', rotulo: 'DIF', sinonimos: ['DIFERENCIADO'] },
  { valor: 'CONV', rotulo: 'CONV', sinonimos: ['CONVENCIONAL'] },
]

// Maiúsculas, sem acento, espaços simples
export function normalizar(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim()
}

export function resolverNome(tipo: TipoMapeamento, texto: unknown, opcoes: Opcao[], mapeamentos: Mapeamento[]): string | null {
  const n = normalizar(texto)
  if (!n) return null
  for (const o of opcoes) {
    if (normalizar(o.rotulo) === n || normalizar(o.valor) === n || o.sinonimos?.some(s => normalizar(s) === n)) return o.valor
  }
  const m = mapeamentos.find(m => m.tipo === tipo && normalizar(m.texto_original) === n)
  return m && opcoes.some(o => o.valor === m.valor) ? m.valor : null
}

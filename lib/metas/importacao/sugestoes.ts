import { normalizar, type Mapeamento } from '../nomes'

// Sugestões para o que o relatório do ERP não traz, aprendidas das vendas já lançadas.
//  Produto → nome completo, grupo e D/C:
//   1. mesmo código de produto do ERP já classificado antes
//   2. nome da planilha que começa igual à descrição do ERP (que vem cortada em 24 letras),
//      comparando só letras e números: "DF - MIRAVIS DUO (GL. 0" ↔ "DF - MIRAVIS DUO (GL.05LT)"
//   3. a "marca" (texto antes do primeiro "-": DF, AD, OMEX, CP...), se quase sempre cai no mesmo grupo
//  Consultor:
//   1. código do vendedor mapeado (mapeamento_nomes tipo 'vendedor')
//   2. último consultor que vendeu para o cliente (pelo código do ERP ou pelo nome)
// Tudo é sugestão: a venda fica editável na tela de lançamentos.

export type VendaHistorico = {
  data: string
  produto: string
  produto_codigo: string | null
  grupo_id: number | null
  tipo: string | null
  cliente: string
  cliente_codigo: string | null
  consultor_id: string | null
}

export type OrigemSugestao = 'codigo' | 'nome' | 'marca' | 'vendedor' | 'cliente' | null
export type SugestaoProduto = { nome: string | null; grupo_id: number | null; tipo: string | null; origem: OrigemSugestao }
export type SugestaoConsultor = { consultor_id: string | null; origem: OrigemSugestao }

const chave = (s: string) => normalizar(s).replace(/[^A-Z0-9]/g, '')
const marca = (s: string) => chave(normalizar(s).split(/\s*-\s*|\s+/)[0] ?? '')

// Mais frequente; empate → o mais recente (lista vem do mais recente para o mais antigo)
function maisComum<T>(xs: T[], id: (x: T) => string): { valor: T; n: number; total: number } | null {
  if (!xs.length) return null
  const cont = new Map<string, { valor: T; n: number }>()
  for (const x of xs) {
    const k = id(x)
    const c = cont.get(k)
    if (c) c.n++
    else cont.set(k, { valor: x, n: 1 })
  }
  const melhor = [...cont.values()].reduce((a, b) => (b.n > a.n ? b : a))
  return { ...melhor, total: xs.length }
}

export const MIN_CHAVE_NOME = 8          // descrição muito curta casa com qualquer coisa
export const MIN_VENDAS_MARCA = 3
export const MIN_PARTICIPACAO_MARCA = 0.8

export function montarSugestor(historico: VendaHistorico[], mapeamentos: Mapeamento[]) {
  const classificadas = historico
    .filter(h => h.grupo_id != null && h.tipo != null)
    .sort((a, b) => b.data.localeCompare(a.data))
    .map(h => ({ ...h, chave: chave(h.produto), marca: marca(h.produto) }))
  const comConsultor = historico.filter(h => h.consultor_id != null).sort((a, b) => b.data.localeCompare(a.data))
  const vendedores = new Map(mapeamentos.filter(m => m.tipo === 'vendedor').map(m => [normalizar(m.texto_original), m.valor]))
  const classe = (h: { grupo_id: number | null; tipo: string | null }) => `${h.grupo_id}|${h.tipo}`

  function produto(codigo: string | null, descricao: string): SugestaoProduto {
    if (codigo) {
      const doCodigo = classificadas.filter(h => h.produto_codigo === codigo)
      const m = maisComum(doCodigo, classe)
      if (m) return { nome: m.valor.produto, grupo_id: m.valor.grupo_id, tipo: m.valor.tipo, origem: 'codigo' }
    }
    const k = chave(descricao)
    if (k.length >= MIN_CHAVE_NOME) {
      const doNome = classificadas.filter(h => h.chave.startsWith(k))
      const m = maisComum(doNome, classe)
      if (m) {
        const nome = maisComum(doNome.filter(h => classe(h) === classe(m.valor)), h => h.produto)?.valor.produto ?? null
        return { nome, grupo_id: m.valor.grupo_id, tipo: m.valor.tipo, origem: 'nome' }
      }
    }
    const mk = marca(descricao)
    if (mk) {
      const m = maisComum(classificadas.filter(h => h.marca === mk), classe)
      if (m && m.total >= MIN_VENDAS_MARCA && m.n / m.total >= MIN_PARTICIPACAO_MARCA) {
        return { nome: null, grupo_id: m.valor.grupo_id, tipo: m.valor.tipo, origem: 'marca' }
      }
    }
    return { nome: null, grupo_id: null, tipo: null, origem: null }
  }

  function consultor(vendedor: string, clienteCodigo: string | null, cliente: string): SugestaoConsultor {
    const mapeado = vendedores.get(normalizar(vendedor))
    if (mapeado) return { consultor_id: mapeado, origem: 'vendedor' }
    const nome = normalizar(cliente)
    const h = (clienteCodigo && comConsultor.find(x => x.cliente_codigo === clienteCodigo)) || comConsultor.find(x => normalizar(x.cliente) === nome)
    return h ? { consultor_id: h.consultor_id, origem: 'cliente' } : { consultor_id: null, origem: null }
  }

  return { produto, consultor }
}
export type Sugestor = ReturnType<typeof montarSugestor>

// Indicadores do painel de metas — espelho das abas "PN GERAL"/consultor das planilhas.
// Tudo é calculado de metas + vendas (realizado = vendas faturadas, por competência).
import { resumirVendas, type ResumoVendas, type VendaCalculavel } from './calculo'

export type ValorMensal = { unidade_id: number; grupo_id: number; mes: number; valor: number }
export type VendaPainel = VendaCalculavel & {
  competencia: string // AAAA-MM-01
  unidade_id: number
  grupo_id: number
  consultor_id: string
  faturamento: number
  cancelada: boolean
  tipo: string
  modalidade: string
  toneladas: number | null
}
export type Nomeado = { id: number | string; nome: string }

export type FiltroPainel = {
  ano: number
  mes_ref: number      // 1–12: fim do ciclo
  unidade?: number
  consultor?: string   // filtra o realizado; a meta é a da unidade do consultor
  grupo?: number
}

export type LinhaMeta = {
  id: number | string
  nome: string
  meta_ano: number
  realizado: number          // jan até o mês de referência
  pct: number | null
  falta: number              // meta do ano − realizado (positivo = falta)
  pct_falta: number | null
  meta_ciclo: number         // jan até o mês de referência
  desvio_ciclo: number       // realizado − meta do ciclo
  pct_desvio_ciclo: number | null
  meta_ciclo_mais_1: number  // jan até o mês seguinte
  desvio_ciclo_mais_1: number
  pct_desvio_ciclo_mais_1: number | null
  precisa_proximo_mes: number // quanto falta vender para cumprir o ciclo + 1
}

export type Painel = {
  porGrupo: LinhaMeta[]
  porUnidade: LinhaMeta[]
  total: LinhaMeta
  mensal: { mes: number; meta: number; realizado: number; anterior: number }[]
  mix: { DIF: number; CONV: number }
  modalidade: { VERDE_AGRO: number; VENDA_DIRETA: number }
  toneladas: number[]   // por mês
  ranking: (LinhaMeta & { tipo: 'unidade' })[]
  consultores: { id: string; nome: string; unidade_id: number; realizado: number; pct_meta_unidade: number | null }[]
  resultadoPorConsultor: { id: string; nome: string; resumo: ResumoVendas }[]
  resultadoPorGrupo: { id: number; nome: string; resumo: ResumoVendas }[]
}

export const div = (a: number, b: number) => (b ? a / b : null)
const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const mesDe = (competencia: string) => Number(competencia.slice(5, 7))
const anoDe = (competencia: string) => Number(competencia.slice(0, 4))

export type Faixa = 'vermelho' | 'amarelo' | 'verde'
export function faixaAtingimento(pct: number | null, limiteAmarelo = 0.7, limiteVerde = 1): Faixa | null {
  if (pct == null) return null
  return pct < limiteAmarelo ? 'vermelho' : pct < limiteVerde ? 'amarelo' : 'verde'
}

function linha(id: number | string, nome: string, metas: ValorMensal[], realizado: number, mesRef: number): LinhaMeta {
  const ate = (m: number) => soma(metas.filter(x => x.mes <= m).map(x => x.valor))
  const meta_ano = ate(12)
  const meta_ciclo = ate(mesRef)
  const meta_ciclo_mais_1 = ate(Math.min(12, mesRef + 1))
  return {
    id, nome, meta_ano, realizado,
    pct: div(realizado, meta_ano),
    falta: meta_ano - realizado,
    pct_falta: div(meta_ano - realizado, meta_ano),
    meta_ciclo,
    desvio_ciclo: realizado - meta_ciclo,
    pct_desvio_ciclo: div(realizado - meta_ciclo, meta_ciclo),
    meta_ciclo_mais_1,
    desvio_ciclo_mais_1: realizado - meta_ciclo_mais_1,
    pct_desvio_ciclo_mais_1: div(realizado - meta_ciclo_mais_1, meta_ciclo_mais_1),
    precisa_proximo_mes: Math.max(0, meta_ciclo_mais_1 - realizado),
  }
}

export function montarPainel(args: {
  filtro: FiltroPainel
  metas: ValorMensal[]
  vendas: VendaPainel[]         // do ano (e de outros, são filtradas aqui)
  anterior: ValorMensal[]       // realizado do ano anterior por mês
  grupos: Nomeado[]
  unidades: Nomeado[]
  consultores: (Nomeado & { unidade_id: number })[]
}): Painel {
  const { filtro: f, grupos, unidades, consultores } = args
  const unidadeConsultor = f.consultor ? consultores.find(c => c.id === f.consultor)?.unidade_id : undefined
  const unidadeFiltro = unidadeConsultor ?? f.unidade

  const filtraMeta = (m: ValorMensal) => (unidadeFiltro == null || m.unidade_id === unidadeFiltro) && (f.grupo == null || m.grupo_id === f.grupo)
  const metas = args.metas.filter(filtraMeta)
  const anterior = args.anterior.filter(filtraMeta)

  // Canceladas não contam em nada
  const doAno = args.vendas.filter(v => !v.cancelada && anoDe(v.competencia) === f.ano
    && (unidadeFiltro == null || v.unidade_id === unidadeFiltro)
    && (f.consultor == null || v.consultor_id === f.consultor)
    && (f.grupo == null || v.grupo_id === f.grupo))
  const noCiclo = doAno.filter(v => mesDe(v.competencia) <= f.mes_ref)
  const realizadoDe = (vs: VendaPainel[]) => soma(vs.map(v => v.faturamento))

  const porGrupo = grupos
    .filter(g => f.grupo == null || g.id === f.grupo)
    .map(g => linha(g.id, g.nome, metas.filter(m => m.grupo_id === g.id), realizadoDe(noCiclo.filter(v => v.grupo_id === g.id)), f.mes_ref))
  const porUnidade = unidades
    .filter(u => unidadeFiltro == null || u.id === unidadeFiltro)
    .map(u => linha(u.id, u.nome, metas.filter(m => m.unidade_id === u.id), realizadoDe(noCiclo.filter(v => v.unidade_id === u.id)), f.mes_ref))
  const total = linha('total', 'Total', metas, realizadoDe(noCiclo), f.mes_ref)

  const mensal = Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1,
    meta: soma(metas.filter(m => m.mes === i + 1).map(m => m.valor)),
    realizado: realizadoDe(doAno.filter(v => mesDe(v.competencia) === i + 1)),
    anterior: soma(anterior.filter(m => m.mes === i + 1).map(m => m.valor)),
  }))

  const somaPor = <K extends string>(campo: 'tipo' | 'modalidade', chaves: K[]) =>
    Object.fromEntries(chaves.map(k => [k, realizadoDe(noCiclo.filter(v => v[campo] === k))])) as Record<K, number>

  const consultoresLinhas = consultores
    .filter(c => (unidadeFiltro == null || c.unidade_id === unidadeFiltro) && (f.consultor == null || c.id === f.consultor))
    .map(c => {
      const realizado = realizadoDe(noCiclo.filter(v => v.consultor_id === c.id))
      const metaUnidade = porUnidade.find(u => u.id === c.unidade_id)?.meta_ano ?? 0
      return { id: String(c.id), nome: c.nome, unidade_id: c.unidade_id, realizado, pct_meta_unidade: div(realizado, metaUnidade) }
    })
    .filter(c => c.realizado !== 0)
    .sort((a, b) => b.realizado - a.realizado)

  return {
    porGrupo,
    porUnidade,
    total,
    mensal,
    mix: somaPor('tipo', ['DIF', 'CONV']),
    modalidade: somaPor('modalidade', ['VERDE_AGRO', 'VENDA_DIRETA']),
    toneladas: Array.from({ length: 12 }, (_, i) => soma(doAno.filter(v => mesDe(v.competencia) === i + 1).map(v => v.toneladas ?? 0))),
    ranking: porUnidade.filter(u => u.meta_ano > 0).map(u => ({ ...u, tipo: 'unidade' as const })).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0)),
    consultores: consultoresLinhas,
    resultadoPorConsultor: consultores
      .filter(c => noCiclo.some(v => v.consultor_id === c.id))
      .map(c => ({ id: String(c.id), nome: c.nome, resumo: resumirVendas(noCiclo.filter(v => v.consultor_id === c.id)) })),
    resultadoPorGrupo: grupos
      .filter(g => noCiclo.some(v => v.grupo_id === g.id))
      .map(g => ({ id: Number(g.id), nome: g.nome, resumo: resumirVendas(noCiclo.filter(v => v.grupo_id === g.id)) })),
  }
}

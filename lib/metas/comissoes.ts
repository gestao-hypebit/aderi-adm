import { calcularVenda, resumirVendas, type ResumoVendas } from './calculo'
import { competenciaBR, vendaCompleta, type VendaRow } from './vendas'

// Relatório de comissões: quanto cada consultor vendeu e quanto tem a receber no período.
// Mesmo critério do painel de metas: canceladas e vendas a completar não contam, e venda
// sem custo conta no vendido, mas não gera comissão até o custo ser informado.

export type VendaComissao = {
  id: string
  data: string
  dav: string | null
  cliente: string
  produto: string
  quantidade: number
  faturamento: number
  custo_total: number | null
  resultado: number | null   // após imposto, igual à coluna "Result." dos lançamentos
  custo_pendente: boolean
  margem_liquida: number | null
  percentual_comissao: number | null
  comissao: number | null
}

export type ConsultorComissao = { id: string; nome: string; resumo: ResumoVendas; vendas: VendaComissao[] }

export type RelatorioComissoes = {
  consultores: ConsultorComissao[]
  total: ResumoVendas
  aCompletar: { qtd: number; valor: number; competencias: string[] }
}

export function montarRelatorioComissoes(vendas: VendaRow[], consultores: { id: string; nome: string }[], consultor = ''): RelatorioComissoes {
  const ativas = vendas.filter(v => !v.cancelada && (!consultor || v.consultor_id === consultor || v.consultor_id == null))
  const completas = ativas.filter(v => vendaCompleta(v) && (!consultor || v.consultor_id === consultor))
  const pendentes = ativas.filter(v => !vendaCompleta(v))

  const porConsultor = new Map<string, VendaRow[]>()
  for (const v of completas) porConsultor.set(v.consultor_id!, [...(porConsultor.get(v.consultor_id!) ?? []), v])

  return {
    consultores: [...porConsultor].map(([id, lista]) => ({
      id,
      nome: consultores.find(c => c.id === id)?.nome ?? 'Consultor não cadastrado',
      resumo: resumirVendas(lista),
      vendas: [...lista].sort((a, b) => a.data.localeCompare(b.data) || (a.dav ?? '').localeCompare(b.dav ?? '')).map(v => {
        const c = calcularVenda(v)
        return {
          id: v.id, data: v.data, dav: v.dav, cliente: v.cliente, produto: v.produto, quantidade: v.quantidade,
          faturamento: c.faturamento, custo_total: c.custo_total, resultado: c.resultado_apos_imposto,
          custo_pendente: c.custo_pendente, margem_liquida: c.margem_liquida, percentual_comissao: c.percentual_comissao, comissao: c.comissao,
        }
      }),
    })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    total: resumirVendas(completas),
    aCompletar: {
      qtd: pendentes.length,
      valor: pendentes.reduce((s, v) => s + v.faturamento, 0),
      competencias: [...new Set(pendentes.map(v => v.competencia))].sort(),
    },
  }
}

// "2026-01", "2026-10" → "jan/2026 a out/2026"; mês único → "out/2026"
export function periodoBR(de: string, ate: string) {
  const mes = (m: string) => competenciaBR(`${m}-01`)
  return de === ate ? mes(de) : `${mes(de)} a ${mes(ate)}`
}

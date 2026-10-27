import type { AbaExcel, ColunaExcel } from './excel'
import type { LinhaMeta, Painel } from './painel'
import { MESES_CURTOS } from './vendas'

const COLUNAS_META: ColunaExcel[] = [
  { titulo: 'Meta do ano', formato: 'brl' }, { titulo: 'Realizado', formato: 'brl' }, { titulo: '% realizado', formato: 'pct' },
  { titulo: 'Falta', formato: 'brl' }, { titulo: '% falta', formato: 'pct' },
  { titulo: 'Meta do ciclo', formato: 'brl' }, { titulo: 'Desvio do ciclo', formato: 'brl' }, { titulo: '% desvio do ciclo', formato: 'pct' },
  { titulo: 'Meta ciclo + 1', formato: 'brl' }, { titulo: 'Desvio ciclo + 1', formato: 'brl' }, { titulo: '% desvio ciclo + 1', formato: 'pct' },
  { titulo: 'Precisa vender', formato: 'brl' },
]
const valoresMeta = (l: LinhaMeta) => [
  l.meta_ano, l.realizado, l.pct, l.falta, l.pct_falta, l.meta_ciclo, l.desvio_ciclo, l.pct_desvio_ciclo,
  l.meta_ciclo_mais_1, l.desvio_ciclo_mais_1, l.pct_desvio_ciclo_mais_1, l.precisa_proximo_mes,
]

export function abasPainel(p: Painel, ano: number, mesRef: number): AbaExcel[] {
  const ref = `jan–${MESES_CURTOS[mesRef - 1]}/${ano}`
  const div = (a: number, b: number) => (b ? a / b : null)
  const totalMix = p.mix.DIF + p.mix.CONV
  const totalMod = p.modalidade.VERDE_AGRO + p.modalidade.VENDA_DIRETA
  return [
    {
      nome: 'Meta x realizado (grupo)',
      colunas: [{ titulo: `Grupo (realizado ${ref})` }, ...COLUNAS_META],
      linhas: p.porGrupo.map(l => [l.nome, ...valoresMeta(l)]),
      total: ['Total', ...valoresMeta(p.total)],
    },
    {
      nome: 'Meta x realizado (unidade)',
      colunas: [{ titulo: `Unidade (realizado ${ref})` }, ...COLUNAS_META],
      linhas: p.porUnidade.map(l => [l.nome, ...valoresMeta(l)]),
      total: ['Total', ...valoresMeta(p.total)],
    },
    {
      nome: 'Evolução mensal',
      colunas: [{ titulo: 'Mês', largura: 10 }, { titulo: 'Meta', formato: 'brl' }, { titulo: `Realizado ${ano}`, formato: 'brl' }, { titulo: '% da meta', formato: 'pct' },
        { titulo: `Realizado ${ano - 1}`, formato: 'brl' }, { titulo: `Variação × ${ano - 1}`, formato: 'pct' }, { titulo: 'Toneladas fertilizante', formato: 'num' }],
      linhas: p.mensal.map((m, i) => [MESES_CURTOS[m.mes - 1], m.meta, m.realizado, div(m.realizado, m.meta), m.anterior, m.anterior ? m.realizado / m.anterior - 1 : null, p.toneladas[i]]),
      total: ['Total', ...(() => {
        const s = (k: 'meta' | 'realizado' | 'anterior') => p.mensal.reduce((a, m) => a + m[k], 0)
        return [s('meta'), s('realizado'), div(s('realizado'), s('meta')), s('anterior'), null, p.toneladas.reduce((a, b) => a + b, 0)]
      })()],
    },
    {
      nome: 'Mix e modalidade',
      colunas: [{ titulo: `Divisão (${ref})` }, { titulo: 'Valor', formato: 'brl' }, { titulo: '%', formato: 'pct' }],
      linhas: [
        ['DIF (diferenciado)', p.mix.DIF, div(p.mix.DIF, totalMix)],
        ['CONV (convencional)', p.mix.CONV, div(p.mix.CONV, totalMix)],
        [null, null, null],
        ['Verde Agro', p.modalidade.VERDE_AGRO, div(p.modalidade.VERDE_AGRO, totalMod)],
        ['Venda Direta', p.modalidade.VENDA_DIRETA, div(p.modalidade.VENDA_DIRETA, totalMod)],
      ],
    },
    {
      nome: 'Ranking',
      colunas: [{ titulo: 'Unidade' }, { titulo: 'Meta do ano', formato: 'brl' }, { titulo: 'Realizado', formato: 'brl' }, { titulo: '% da meta', formato: 'pct' }],
      linhas: [
        ...p.ranking.map(r => [r.nome, r.meta_ano, r.realizado, r.pct]),
        [null, null, null, null],
        ['Consultor', null, 'Realizado', '% da meta da unidade'],
        ...p.consultores.map(c => [c.nome, null, c.realizado, c.pct_meta_unidade]),
      ],
    },
    {
      nome: 'Resultado',
      colunas: [{ titulo: `Consultor / grupo (${ref})` }, { titulo: 'Realizado', formato: 'brl' }, { titulo: 'Faturamento com custo', formato: 'brl' },
        { titulo: 'Lucro', formato: 'brl' }, { titulo: 'Lucro %', formato: 'pct' }, { titulo: 'Comissão', formato: 'brl' }, { titulo: 'Margem líquida', formato: 'pct' }, { titulo: 'Vendas com custo pendente', formato: 'num' }],
      linhas: [
        ...p.resultadoPorConsultor.map(r => [r.nome, r.resumo.realizado, r.resumo.faturamento_com_custo, r.resumo.lucro, r.resumo.lucro_pct, r.resumo.comissao, r.resumo.margem_liquida, r.resumo.qtd_custo_pendente]),
        [null, null, null, null, null, null, null, null],
        ...p.resultadoPorGrupo.map(r => [r.nome, r.resumo.realizado, r.resumo.faturamento_com_custo, r.resumo.lucro, r.resumo.lucro_pct, r.resumo.comissao, r.resumo.margem_liquida, r.resumo.qtd_custo_pendente]),
      ],
    },
  ]
}

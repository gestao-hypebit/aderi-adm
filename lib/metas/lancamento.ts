// Tela de lançamentos do mês — a planilha "00X - MÊS - 26 AD" dentro do sistema.
// Regras de edição de uma linha e o quadro-resumo do topo da planilha (GERAL, UNIDADE DE
// NEGÓCIOS, DIF/CONV, MODALIDADE, FERTILIZANTES - TONELADAS).
import { resumirVendas, type ResumoVendas } from './calculo'
import { inferirToneladas } from './importacao/toneladas'
import { faltandoNaVenda, type VendaRow } from './vendas'

export type CamposEditaveis = Pick<VendaRow,
  'data' | 'dav' | 'cliente' | 'produto' | 'quantidade' | 'preco_unitario' | 'faturamento' | 'grupo_id' | 'consultor_id' |
  'modalidade' | 'tipo' | 'custo_unitario' | 'frete_unitario' | 'desconto_unitario' | 'data_pagamento_compra' |
  'data_recebimento' | 'aliquota_imposto' | 'toneladas' | 'observacao' | 'cancelada'>

// Completa a edição com o que a planilha recalcularia:
//  · qtd ou unitário mudou → faturamento = qtd × unitário [G = E × F]. Com qtd 0 (venda direta
//    lançada só pelo valor) o faturamento informado fica.
//  · fertilizante → toneladas inferidas de novo (a não ser que a própria edição seja a tonelada)
//  · fora de fertilizantes → sem tonelada
export function completarEdicao(v: VendaRow, campos: Partial<CamposEditaveis>, fertilizantesId: number | null): Partial<CamposEditaveis> {
  const novo = { ...v, ...campos }
  const patch: Partial<CamposEditaveis> = { ...campos }
  if (('quantidade' in campos || 'preco_unitario' in campos) && !('faturamento' in campos) && novo.quantidade > 0) {
    patch.faturamento = novo.quantidade * novo.preco_unitario
  }
  const ehFertilizante = fertilizantesId != null && novo.grupo_id === fertilizantesId
  if (!ehFertilizante) {
    if (v.toneladas != null) patch.toneladas = null
  } else if (!('toneladas' in campos) && ['grupo_id', 'quantidade', 'preco_unitario', 'produto'].some(k => k in campos)) {
    patch.toneladas = inferirToneladas(novo.produto, novo.quantidade, novo.preco_unitario).toneladas
  }
  return patch
}

type Fatia = { id: string; nome: string; valor: number }
export type ResumoMes = {
  total: number                    // faturamento do mês (sem canceladas), como o TOTAL da planilha
  porGrupo: Fatia[]
  porUnidade: Fatia[]
  porTipo: Fatia[]
  porModalidade: Fatia[]
  toneladas: number
  a_completar: { qtd: number; valor: number }
  resultado: ResumoVendas          // lucro/comissão (só das vendas com custo)
  linhas: number
  canceladas: number
}

const SEM = '—'

function agrupar(vs: VendaRow[], chave: (v: VendaRow) => string | number | null, nomes: { id: string | number; nome: string }[], rotuloSem: string): Fatia[] {
  const soma = new Map<string, number>()
  for (const v of vs) {
    const k = chave(v) == null ? SEM : String(chave(v))
    soma.set(k, (soma.get(k) ?? 0) + v.faturamento)
  }
  const fatias = nomes.map(n => ({ id: String(n.id), nome: n.nome, valor: soma.get(String(n.id)) ?? 0 }))
  const conhecidos = new Set(fatias.map(f => f.id))
  const outros = [...soma.entries()].filter(([k]) => !conhecidos.has(k)).reduce((s, [, x]) => s + x, 0)
  if (Math.abs(outros) > 0.005) fatias.push({ id: SEM, nome: rotuloSem, valor: outros })
  return fatias
}

export function resumirMes(
  vendas: VendaRow[],
  cad: { grupos: { id: number; nome: string }[]; unidades: { id: number; codigo: string; nome: string }[] },
  fertilizantesId: number | null,
): ResumoMes {
  const ativas = vendas.filter(v => !v.cancelada)
  const incompletas = ativas.filter(v => faltandoNaVenda(v).length > 0)
  return {
    total: ativas.reduce((s, v) => s + v.faturamento, 0),
    porGrupo: agrupar(ativas, v => v.grupo_id, cad.grupos, 'Sem grupo'),
    porUnidade: agrupar(ativas, v => v.unidade_id, cad.unidades.map(u => ({ id: u.id, nome: `${u.codigo} · ${u.nome}` })), 'Sem consultor'),
    porTipo: agrupar(ativas, v => v.tipo, [{ id: 'DIF', nome: 'Diferenciados (DIF)' }, { id: 'CONV', nome: 'Convencionais (CONV)' }], 'Sem D/C'),
    porModalidade: agrupar(ativas, v => v.modalidade, [{ id: 'VERDE_AGRO', nome: 'Fat. Verde Agro Insumos' }, { id: 'VENDA_DIRETA', nome: 'Fat. Venda Direta' }], 'Sem modalidade'),
    toneladas: ativas.filter(v => v.grupo_id === fertilizantesId).reduce((s, v) => s + (v.toneladas ?? 0), 0),
    a_completar: { qtd: incompletas.length, valor: incompletas.reduce((s, v) => s + v.faturamento, 0) },
    resultado: resumirVendas(ativas),
    linhas: vendas.length,
    canceladas: vendas.length - ativas.length,
  }
}

// Data padrão de uma linha nova: hoje, se hoje cai no mês; senão o dia 1
export function dataPadrao(mes: string, hoje: string) {
  return hoje.slice(0, 7) === mes ? hoje : `${mes}-01`
}

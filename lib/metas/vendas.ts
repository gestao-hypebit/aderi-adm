import type { SupabaseClient } from '@supabase/supabase-js'
import type { VendaCalculavel } from './calculo'

// Registro de public.vendas como vem do banco (numeric chega como string)
export type VendaRow = {
  id: string
  data: string
  competencia: string
  dav: string | null
  cliente: string
  cliente_id: string | null
  produto: string
  produto_id: string | null
  quantidade: number
  preco_unitario: number
  faturamento: number
  // nulos = venda "a completar" (veio do relatório do ERP sem classificação)
  grupo_id: number | null
  consultor_id: string | null
  unidade_id: number | null
  modalidade: 'VERDE_AGRO' | 'VENDA_DIRETA' | null
  tipo: 'DIF' | 'CONV' | null
  cancelada: boolean
  custo_unitario: number | null
  frete_unitario: number
  desconto_unitario: number
  data_pagamento_compra: string | null
  data_recebimento: string | null
  toneladas: number | null
  taxa_juros_mensal: number
  aliquota_imposto: number
  fator_comissao: number
  cotacao_id: string | null
  importacao_id: string | null
  linha_origem: number | null
  observacao: string | null
  cliente_codigo: string | null
  produto_codigo: string | null
  vendedor_codigo: string | null
  created_at: string
}

export type VendaCompleta = VendaRow & { grupo_id: number; consultor_id: string; unidade_id: number; modalidade: 'VERDE_AGRO' | 'VENDA_DIRETA'; tipo: 'DIF' | 'CONV' }

// O que falta para a venda contar no painel de metas
export function faltandoNaVenda(v: Pick<VendaRow, 'grupo_id' | 'consultor_id' | 'modalidade' | 'tipo'>): string[] {
  return [v.consultor_id == null && 'consultor', v.grupo_id == null && 'grupo', v.modalidade == null && 'modalidade', v.tipo == null && 'D/C'].filter((x): x is string => !!x)
}
export const vendaCompleta = (v: VendaRow): v is VendaCompleta => faltandoNaVenda(v).length === 0 && v.unidade_id != null

const NUMERICOS = ['quantidade', 'preco_unitario', 'faturamento', 'custo_unitario', 'frete_unitario', 'desconto_unitario', 'toneladas', 'taxa_juros_mensal', 'aliquota_imposto', 'fator_comissao'] as const

export function vendaDoBanco(r: Record<string, unknown>): VendaRow {
  const v = { ...r } as Record<string, unknown>
  for (const k of NUMERICOS) v[k] = v[k] == null ? null : Number(v[k])
  return v as VendaRow
}

export const paraCalculo = (v: VendaRow): VendaCalculavel => v

export const MODALIDADE_ROTULO: Record<string, string> = { VERDE_AGRO: 'Verde Agro', VENDA_DIRETA: 'Venda Direta' }

// "2026-01-01" → "jan/2026"
export const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const competenciaBR = (c: string) => `${MESES_CURTOS[Number(c.slice(5, 7)) - 1]}/${c.slice(0, 4)}`

// O PostgREST devolve no máximo 1.000 linhas por vez; busca em páginas
export async function buscarTodas<T>(montar: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>, pagina = 1000): Promise<T[]> {
  const todas: T[] = []
  for (let de = 0; ; de += pagina) {
    const { data, error } = await montar(de, de + pagina - 1)
    if (error) throw error
    todas.push(...(data ?? []))
    if (!data || data.length < pagina) return todas
  }
}

export type FiltrosVendas = {
  de: string        // AAAA-MM (competência inicial)
  ate: string       // AAAA-MM
  unidade: string
  consultor: string
  grupo: string
  modalidade: string
  tipo: string
  cliente: string
  custoPendente: boolean
  aCompletar: boolean
  canceladas: boolean
}

const ultimoDia = (mes: string) => {
  const [a, m] = mes.split('-').map(Number)
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10)
}

export async function buscarVendas(supabase: SupabaseClient, f: FiltrosVendas): Promise<VendaRow[]> {
  const linhas = await buscarTodas<Record<string, unknown>>((de, ate) => {
    let q = supabase.from('vendas').select('*')
    if (f.de) q = q.gte('competencia', f.de + '-01')
    if (f.ate) q = q.lte('competencia', ultimoDia(f.ate))
    if (f.unidade) q = q.eq('unidade_id', Number(f.unidade))
    if (f.consultor) q = q.eq('consultor_id', f.consultor)
    if (f.grupo) q = q.eq('grupo_id', Number(f.grupo))
    if (f.modalidade) q = q.eq('modalidade', f.modalidade)
    if (f.tipo) q = q.eq('tipo', f.tipo)
    if (f.cliente.trim()) q = q.ilike('cliente', `%${f.cliente.trim().replace(/[%_,()]/g, ' ')}%`)
    // mesmo critério de lib/metas/calculo.ts: sem custo, custo zerado ou sem quantidade
    if (f.custoPendente) q = q.or('custo_unitario.is.null,custo_unitario.lte.0,quantidade.lte.0')
    if (!f.canceladas) q = q.eq('cancelada', false)
    return q.order('data', { ascending: false }).order('dav', { ascending: false }).order('id').range(de, ate)
  })
  // filtrado aqui: dois .or() na mesma consulta não combinam bem no PostgREST
  const vendas = linhas.map(vendaDoBanco)
  return f.aCompletar ? vendas.filter(v => !vendaCompleta(v)) : vendas
}

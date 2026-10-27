import type { SupabaseClient } from '@supabase/supabase-js'
import { PARAMETROS_VENDA_PADRAO, type ParametrosVenda } from './calculo'
import type { Mapeamento } from './nomes'
import type { Cadastros } from './importacao/resolver'

export type Unidade = { id: number; codigo: string; nome: string; ativo: boolean }
export type Grupo = { id: number; nome: string; descricao: string | null; ordem: number; ativo: boolean }
export type Consultor = { id: string; nome: string; unidade_id: number; ativo: boolean; profile_id: string | null }
export type ConfigMetas = ParametrosVenda & { limite_amarelo: number; limite_verde: number }

export type DadosCadastro = {
  unidades: Unidade[]
  grupos: Grupo[]
  consultores: Consultor[]
  mapeamentos: Mapeamento[]
  config: ConfigMetas
}

export async function carregarCadastros(supabase: SupabaseClient): Promise<DadosCadastro> {
  const [u, g, c, m, cfg] = await Promise.all([
    supabase.from('unidades_negocio').select('*').order('id'),
    supabase.from('grupos_produto').select('*').order('ordem'),
    supabase.from('consultores_comerciais').select('*').order('nome'),
    supabase.from('mapeamento_nomes').select('tipo, texto_original, valor'),
    supabase.from('configuracoes').select('meta_juros_mes, meta_aliquota_imposto, meta_fator_comissao, meta_limite_amarelo, meta_limite_verde').eq('id', 1).maybeSingle(),
  ])
  const erro = u.error ?? g.error ?? c.error ?? m.error ?? cfg.error
  if (erro) throw erro
  return {
    unidades: (u.data ?? []) as Unidade[],
    grupos: (g.data ?? []) as Grupo[],
    consultores: (c.data ?? []) as Consultor[],
    mapeamentos: (m.data ?? []) as Mapeamento[],
    config: {
      taxa_juros_mensal: Number(cfg.data?.meta_juros_mes ?? PARAMETROS_VENDA_PADRAO.taxa_juros_mensal),
      aliquota_imposto: Number(cfg.data?.meta_aliquota_imposto ?? PARAMETROS_VENDA_PADRAO.aliquota_imposto),
      fator_comissao: Number(cfg.data?.meta_fator_comissao ?? PARAMETROS_VENDA_PADRAO.fator_comissao),
      limite_amarelo: Number(cfg.data?.meta_limite_amarelo ?? 0.7),
      limite_verde: Number(cfg.data?.meta_limite_verde ?? 1),
    },
  }
}

// Opções para o resolvedor de nomes da importação
export function cadastrosImportacao(d: DadosCadastro): Cadastros {
  return {
    consultores: d.consultores.map(c => ({ valor: c.id, rotulo: c.nome })),
    grupos: d.grupos.map(g => ({ valor: String(g.id), rotulo: g.nome, sinonimos: g.descricao ? [g.descricao] : [] })),
    mapeamentos: d.mapeamentos,
  }
}

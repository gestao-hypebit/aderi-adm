import { custoPendente, type ParametrosVenda } from '../calculo'
import { MODALIDADES, TIPOS, normalizar, resolverNome, type Mapeamento, type Opcao, type TipoMapeamento } from '../nomes'
import { inferirToneladas, type OrigemToneladas } from './toneladas'
import type { LeituraPlanilha, LinhaLida } from './tipos'

export type Cadastros = {
  consultores: Opcao[] // valor = id do consultor, rótulo = nome
  grupos: Opcao[]      // valor = id do grupo (texto), rótulo = nome, sinônimo = descrição
  mapeamentos: Mapeamento[]
}

// Pronta para gravar em public.vendas
export type VendaImportada = {
  linha_origem: number
  data: string
  competencia: string // AAAA-MM-01
  dav: string | null
  cliente: string
  produto: string
  quantidade: number
  preco_unitario: number
  faturamento: number
  grupo_id: number
  consultor_id: string
  modalidade: string
  tipo: string
  custo_unitario: number | null
  frete_unitario: number
  desconto_unitario: number
  data_pagamento_compra: string | null
  data_recebimento: string | null
  toneladas: number | null
  taxa_juros_mensal: number
  aliquota_imposto: number
  fator_comissao: number
}

export type LinhaValida = { venda: VendaImportada; avisos: string[]; toneladas_origem: OrigemToneladas; toneladas_motivo?: string }
export type LinhaComErro = { lida: LinhaLida; erros: string[] }
export type NaoReconhecido = { tipo: TipoMapeamento; texto: string; ocorrencias: number }

export type Resolucao = {
  validas: LinhaValida[]
  com_erro: LinhaComErro[]
  ignoradas: LinhaLida[]
  nao_reconhecidos: NaoReconhecido[]
}

// Chave de duplicidade: DAV + produto + quantidade + valor
export const chaveDuplicidade = (v: { dav: string | null; produto: string; quantidade: number; preco_unitario: number }) =>
  [normalizar(v.dav), normalizar(v.produto), Number(v.quantidade), Number(v.preco_unitario)].join('|')

const ROTULO_TIPO: Record<TipoMapeamento, string> = { consultor: 'Consultor', grupo: 'Grupo', modalidade: 'Modalidade', tipo: 'D/C', vendedor: 'Vendedor (ERP)' }

// competencia: mês de referência escolhido na importação (padrão: o da planilha; sem ele, o mês da data)
export function resolverLeitura(leitura: LeituraPlanilha, cad: Cadastros, padrao: ParametrosVenda, competencia = leitura.competencia): Resolucao {
  const validas: LinhaValida[] = []
  const com_erro: LinhaComErro[] = []
  const ignoradas: LinhaLida[] = []
  const naoRec = new Map<string, NaoReconhecido>()
  const vistas = new Map<string, number>()
  const fertilizantes = cad.grupos.find(g => normalizar(g.rotulo) === 'FERTILIZANTES')?.valor

  const opcoes: Record<TipoMapeamento, Opcao[]> = { consultor: cad.consultores, grupo: cad.grupos, modalidade: MODALIDADES, tipo: TIPOS, vendedor: cad.consultores }

  for (const l of leitura.linhas) {
    if (l.ignorada) { ignoradas.push(l); continue }
    const erros: string[] = []
    const avisos: string[] = []

    const resolver = (tipo: TipoMapeamento, txt: string) => {
      if (!normalizar(txt) || normalizar(txt) === '-') { erros.push(`${ROTULO_TIPO[tipo]} não informado`); return null }
      const v = resolverNome(tipo, txt, opcoes[tipo], cad.mapeamentos)
      if (v == null) {
        erros.push(`${ROTULO_TIPO[tipo]} não reconhecido: "${txt}"`)
        const k = tipo + '|' + normalizar(txt)
        const atual = naoRec.get(k) ?? { tipo, texto: normalizar(txt), ocorrencias: 0 }
        atual.ocorrencias++
        naoRec.set(k, atual)
      }
      return v
    }
    const consultor = resolver('consultor', l.consultor)
    const grupo = resolver('grupo', l.grupo)
    const modalidade = resolver('modalidade', l.modalidade)
    const tipo = resolver('tipo', l.tipo)

    if (!l.produto) erros.push('Produto não informado')
    if (!l.cliente) erros.push('Cliente não informado')

    const q = l.quantidade ?? 0
    const unit = l.preco_unitario ?? (q > 0 && l.faturamento != null ? l.faturamento / q : 0)
    const faturamento = l.faturamento ?? (q > 0 ? q * unit : null)
    if (faturamento == null) erros.push('Faturamento não informado')
    else if (Math.abs(faturamento - q * unit) > 0.01) avisos.push(`Faturamento da planilha (${faturamento.toFixed(2)}) difere de qtd × unitário (${(q * unit).toFixed(2)}); vale o da planilha`)
    if (!(q > 0)) avisos.push('Quantidade zerada')
    if (custoPendente(l.custo_unitario)) avisos.push('Custo pendente')
    if (competencia && l.data && l.data.slice(0, 7) !== competencia.slice(0, 7)) avisos.push(`Data ${l.data} fora do mês de referência`)

    if (erros.length || faturamento == null) { com_erro.push({ lida: l, erros }); continue }

    let toneladas: number | null = null
    let toneladas_origem: OrigemToneladas = null
    let toneladas_motivo: string | undefined
    if (grupo === fertilizantes) {
      const t = inferirToneladas(l.produto, q, unit)
      toneladas = t.toneladas
      toneladas_origem = t.origem
      toneladas_motivo = t.motivo
      if (t.toneladas == null) avisos.push(`Toneladas não inferidas: ${t.motivo}`)
    }

    const venda: VendaImportada = {
      linha_origem: l.linha,
      data: l.data!,
      competencia: competencia ?? l.data!.slice(0, 8) + '01',
      dav: l.dav || null,
      cliente: l.cliente,
      produto: l.produto,
      quantidade: q,
      preco_unitario: unit,
      faturamento,
      grupo_id: Number(grupo),
      consultor_id: consultor!,
      modalidade: modalidade!,
      tipo: tipo!,
      custo_unitario: custoPendente(l.custo_unitario) ? null : l.custo_unitario,
      frete_unitario: l.frete_unitario ?? 0,
      desconto_unitario: l.desconto_unitario ?? 0,
      data_pagamento_compra: l.data_pagamento_compra,
      data_recebimento: l.data_recebimento,
      toneladas,
      taxa_juros_mensal: leitura.taxa_juros_mensal ?? padrao.taxa_juros_mensal,
      aliquota_imposto: l.aliquota_imposto ?? padrao.aliquota_imposto,
      fator_comissao: padrao.fator_comissao,
    }

    const chave = chaveDuplicidade(venda)
    const anterior = vistas.get(chave)
    if (anterior) avisos.push(`Possível duplicidade com a linha ${anterior} deste arquivo`)
    else vistas.set(chave, l.linha)

    validas.push({ venda, avisos, toneladas_origem, toneladas_motivo })
  }

  return { validas, com_erro, ignoradas, nao_reconhecidos: [...naoRec.values()] }
}

// Conciliação: soma das linhas importáveis × total que a planilha traz
export function conciliar(leitura: LeituraPlanilha, res: Resolucao) {
  const soma = (xs: { valor: number }[]) => xs.reduce((s, x) => s + x.valor, 0)
  const importado = soma(res.validas.map(v => ({ valor: v.venda.faturamento })))
  const fora = [
    ...res.com_erro.map(e => ({ linha: e.lida.linha, motivo: e.erros.join('; '), valor: e.lida.faturamento ?? 0 })),
    ...res.ignoradas.map(l => ({ linha: l.linha, motivo: l.ignorada === 'cancelada' ? 'cancelada' : `sem data válida ("${l.data_bruta}")`, valor: l.faturamento ?? 0 })),
  ].sort((a, b) => a.linha - b.linha)
  const total = leitura.total_geral
  const diferenca = total == null ? null : total - importado
  return {
    arquivo: leitura.arquivo,
    total_planilha: total,
    importado,
    diferenca,
    fora_com_valor: fora.filter(f => Math.abs(f.valor) > 0.005),
    fora_sem_valor: fora.filter(f => Math.abs(f.valor) <= 0.005).length,
    // quanto da diferença NÃO é explicado pelas linhas que ficaram de fora (exceto canceladas)
    nao_explicado: diferenca == null ? null : diferenca - fora.filter(f => f.motivo !== 'cancelada').reduce((s, f) => s + f.valor, 0),
  }
}
export type Conciliacao = ReturnType<typeof conciliar>

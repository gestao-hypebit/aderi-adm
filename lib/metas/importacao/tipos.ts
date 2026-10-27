import type { Workbook } from 'exceljs'

// Linha lida da planilha, ainda com os nomes como foram digitados.
export type LinhaLida = {
  linha: number
  data: string | null
  data_bruta: string
  dav: string
  cliente: string
  produto: string
  quantidade: number | null
  preco_unitario: number | null
  faturamento: number | null       // como está na planilha
  grupo: string
  consultor: string
  modalidade: string
  tipo: string
  custo_unitario: number | null
  frete_unitario: number | null
  desconto_unitario: number | null
  data_pagamento_compra: string | null
  data_recebimento: string | null
  aliquota_imposto: number | null
  ignorada: null | 'cancelada' | 'sem_data'
}

// Totais que a planilha traz (digitados ou por fórmula), para conciliar com a soma das linhas
export type TotalPlanilha = { linha: number; rotulo: string; valor: number }

export type LeituraPlanilha = {
  arquivo: string
  aba: string
  linhas: LinhaLida[]
  totais: TotalPlanilha[]
  total_geral: number | null      // último total da aba (o que a planilha considera o mês)
  competencia: string | null      // AAAA-MM-01, da célula "REF. MÊS"
  taxa_juros_mensal: number | null
}

// Um layout sabe ler um formato de arquivo. Hoje: planilha mensal AD.
// TODO(cliente): layout do export de vendas do ERP, quando houver.
export type LayoutImportacao = {
  id: string
  nome: string
  ler(wb: Workbook, arquivo: string): LeituraPlanilha
}

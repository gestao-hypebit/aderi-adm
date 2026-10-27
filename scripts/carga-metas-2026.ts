// Carga inicial do módulo de metas a partir das planilhas em docs/planilhas/ (rodar uma vez).
//
//   npx tsx scripts/carga-metas-2026.ts
//
// Não grava nada direto: gera em docs/planilhas/_saida/
//  · carga-metas-2026.sql   → colar no SQL Editor do Supabase (é idempotente: pode rodar de novo)
//  · conciliacao-2026.md    → relatório de conciliação (linhas importadas × total da planilha)
// A pasta docs/planilhas/ fica fora do git (dados do cliente).
import ExcelJS from 'exceljs'
import fs from 'node:fs'
import path from 'node:path'
import { PARAMETROS_VENDA_PADRAO } from '../lib/metas/calculo'
import type { Mapeamento } from '../lib/metas/nomes'
import { celula, numero } from '../lib/metas/importacao/celulas'
import { planilhaAd } from '../lib/metas/importacao/planilhaAd'
import { lerPlanilhaConsultor, ORDEM_GRUPOS, type LeituraConsultor } from '../lib/metas/importacao/planilhaConsultor'
import { conciliar, resolverLeitura, type Cadastros, type Conciliacao, type Resolucao } from '../lib/metas/importacao/resolver'
import type { LeituraPlanilha } from '../lib/metas/importacao/tipos'

const PASTA = path.resolve(import.meta.dirname, '../docs/planilhas')
const SAIDA = path.join(PASTA, '_saida')
const ANO = 2026

const MENSAIS = [
  '001 - JANEIRO - 2026 AD.xlsx', '002 - FEVEREIRO - 26 AD.xlsx', '003 -MARÇO - 26 - AD.xlsx',
  '004 -ABRIL - 26 - AD.xlsx', '005 - MAIO - 26 - AD.xlsx', '006 - JUNHO - 26 - AD.xlsx',
  '007 -JULHO - 26 - AD.xlsx', '008 - AGOSTO - 26 AD.xlsx', '009 - SETEMBRO - 26 AD.xlsx', // "(1)" é idêntico
]
const CONSULTORES = [
  { arquivo: 'Aderi agro  - 2026.xlsx', unidade: 1, codigo: 'I' },
  { arquivo: 'Gabriel - 2026.xlsx', unidade: 2, codigo: 'II' },
  { arquivo: 'Gilvan - 2026.xlsx', unidade: 3, codigo: 'III' },
  { arquivo: 'Joao Victor - 2026.xlsx', unidade: 4, codigo: 'IV' },
]
const UNIDADE_DO_CONSULTOR: Record<string, number> = { 'Aderi Agro': 1, Gabriel: 2, Gilvan: 3, 'João Victor': 4, 'Fabrício': 4 }

// Espelho do que a migration 20261027090000 semeia. O id do consultor aqui é o nome;
// o SQL gerado troca pelo uuid com um JOIN em consultores_comerciais.nome.
const CADASTROS: Cadastros = {
  consultores: Object.keys(UNIDADE_DO_CONSULTOR).map(n => ({ valor: n, rotulo: n })),
  grupos: ORDEM_GRUPOS.map((g, i) => ({ valor: String(i + 1), rotulo: g, sinonimos: i === 0 ? ['Defensivos Agrícolas – Herbicidas'] : [] })),
  mapeamentos: ([
    ['consultor', 'GILVAM', 'Gilvan'], ['consultor', 'JOAO', 'João Victor'], ['consultor', 'ADERI', 'Aderi Agro'],
    ['consultor', 'ADERI - BALCAO', 'Aderi Agro'], ['consultor', 'ADERI BALCAO', 'Aderi Agro'], ['consultor', 'FABRICIO', 'Fabrício'],
    ['grupo', 'FOLIAR', '4'], ['grupo', 'DEFENSIVO', '1'], ['grupo', 'FERTILIZANTE', '3'], ['grupo', 'SEMENTE', '5'], ['grupo', 'DIVERSO', '2'],
    ['modalidade', 'VENDA DIREYA', 'VENDA_DIRETA'], ['modalidade', 'VERDE', 'VERDE_AGRO'],
    ['tipo', 'CV', 'CONV'], ['tipo', 'D', 'DIF'], ['tipo', 'C', 'CONV'],
  ] as const).map(([tipo, texto_original, valor]) => ({ tipo, texto_original, valor }) as Mapeamento),
}

const brl = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const q = (v: unknown) => (v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`)

async function abrir(arquivo: string) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(path.join(PASTA, arquivo))
  return wb
}

async function main() {
  fs.mkdirSync(SAIDA, { recursive: true })
  const sql: string[] = [
    `-- Carga inicial do módulo de metas (${ANO}) — gerado por scripts/carga-metas-2026.ts em ${new Date().toISOString()}`,
    '-- Idempotente: refaz metas/realizado do ano anterior (upsert) e substitui as vendas da carga inicial.',
    'BEGIN;',
  ]
  const md: string[] = [`# Conciliação da carga inicial — metas ${ANO}`, '', `Gerado em ${new Date().toLocaleString('pt-BR')}.`, '']

  // ── a/b) Metas do ano e realizado do ano anterior ─────────
  const leiturasConsultor: (LeituraConsultor & { unidade: number; codigo: string; arquivo: string })[] = []
  for (const c of CONSULTORES) {
    const wb = await abrir(c.arquivo)
    leiturasConsultor.push({ ...lerPlanilhaConsultor(wb.worksheets[0]), ...c })
  }
  const linhasMeta: string[] = []
  const linhasHist: string[] = []
  for (const l of leiturasConsultor) {
    l.meta_mensal.forEach((meses, g) => meses.forEach((v, m) => linhasMeta.push(`(${ANO}, ${l.unidade}, ${g + 1}, ${m + 1}, ${v})`)))
    l.realizado_anterior.forEach((meses, g) => meses.forEach((v, m) => linhasHist.push(`(${ANO - 1}, ${l.unidade}, ${g + 1}, ${m + 1}, ${v}, ${q(l.arquivo)})`)))
  }
  sql.push('',
    `INSERT INTO public.metas (ano, unidade_id, grupo_id, mes, valor) VALUES\n  ${linhasMeta.join(',\n  ')}\nON CONFLICT (ano, unidade_id, grupo_id, mes) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now();`,
    '',
    `INSERT INTO public.realizado_historico (ano, unidade_id, grupo_id, mes, valor, origem) VALUES\n  ${linhasHist.join(',\n  ')}\nON CONFLICT (ano, unidade_id, grupo_id, mes) DO UPDATE SET valor = EXCLUDED.valor, origem = EXCLUDED.origem, updated_at = now();`)

  const metaTotal = soma(leiturasConsultor.flatMap(l => l.meta_mensal.flat()))
  const metaCiclo = (ate: number) => soma(leiturasConsultor.flatMap(l => l.meta_mensal.flatMap(m => m.slice(0, ate))))
  md.push('## Metas 2026', '', '| Unidade | Meta (soma dos meses) | Coluna D | Avisos |', '|---|---:|---:|---|')
  for (const l of leiturasConsultor) md.push(`| ${l.codigo} (${l.aba}) | ${brl(soma(l.meta_mensal.flat()))} | ${brl(soma(l.meta_anual_planilha))} | ${l.avisos.join('<br>') || '—'} |`)
  md.push(`| **Total** | **${brl(metaTotal)}** | | |`, '')
  md.push('| Grupo | Meta |', '|---|---:|')
  ORDEM_GRUPOS.forEach((g, i) => md.push(`| ${g} | ${brl(soma(leiturasConsultor.flatMap(l => l.meta_mensal[i])))} |`))
  md.push('', `Meta acumulada jan–set: **${brl(metaCiclo(9))}** · jan–out: **${brl(metaCiclo(10))}**`, '')
  const hist = soma(leiturasConsultor.flatMap(l => l.realizado_anterior.flat()))
  md.push(`## Realizado ${ANO - 1}`, '', `Total: **${brl(hist)}** (${leiturasConsultor.map(l => `${l.codigo} ${brl(soma(l.realizado_anterior.flat()))}`).join(' · ')})`, '')

  // ── c) Vendas dos arquivos mensais ─────────────────────────
  sql.push('',
    "DELETE FROM public.vendas WHERE importacao_id IN (SELECT id FROM public.importacoes WHERE relatorio->>'carga_inicial' = 'true');",
    "DELETE FROM public.importacoes WHERE relatorio->>'carga_inicial' = 'true';")

  const conciliacoes: (Conciliacao & { mes: number })[] = []
  const resolucoes: { leitura: LeituraPlanilha; res: Resolucao; mes: number }[] = []
  let totalVendas = 0
  for (const [i, arquivo] of MENSAIS.entries()) {
    const leitura = planilhaAd.ler(await abrir(arquivo), arquivo)
    const res = resolverLeitura(leitura, CADASTROS, PARAMETROS_VENDA_PADRAO)
    const conc = conciliar(leitura, res)
    conciliacoes.push({ ...conc, mes: i + 1 })
    resolucoes.push({ leitura, res, mes: i + 1 })
    totalVendas += res.validas.length

    if (leitura.competencia !== `${ANO}-${String(i + 1).padStart(2, '0')}-01`) throw new Error(`${arquivo}: REF. MÊS lido como ${leitura.competencia}`)
    const foraDoMes = res.validas.filter(v => v.venda.data.slice(0, 7) !== v.venda.competencia.slice(0, 7))
    const relatorio = {
      carga_inicial: true,
      conciliacao: conc,
      taxa_juros_mensal: leitura.taxa_juros_mensal,
      totais_planilha: leitura.totais,
      erros: res.com_erro.map(e => ({ linha: e.lida.linha, erros: e.erros, produto: e.lida.produto, faturamento: e.lida.faturamento })),
      ignoradas: res.ignoradas.map(l => ({ linha: l.linha, motivo: l.ignorada, data: l.data_bruta, faturamento: l.faturamento })),
      toneladas_nao_inferidas: res.validas.filter(v => v.toneladas_origem == null && v.toneladas_motivo).map(v => ({ linha: v.venda.linha_origem, produto: v.venda.produto, motivo: v.toneladas_motivo })),
      datas_fora_do_mes: foraDoMes.map(v => ({ linha: v.venda.linha_origem, data: v.venda.data })),
    }
    const valores = res.validas.map(({ venda: v }) => '(' + [
      v.linha_origem, q(v.data), q(v.competencia), q(v.dav), q(v.cliente), q(v.produto), q(v.quantidade), q(v.preco_unitario), q(v.faturamento),
      q(v.grupo_id), q(v.consultor_id), q(v.modalidade), q(v.tipo), q(v.custo_unitario), q(v.frete_unitario), q(v.desconto_unitario),
      q(v.data_pagamento_compra), q(v.data_recebimento), q(v.toneladas), q(v.taxa_juros_mensal), q(v.aliquota_imposto), q(v.fator_comissao),
    ].join(', ') + ')')

    sql.push('', `-- ${arquivo}: ${res.validas.length} vendas`,
      `WITH imp AS (\n  INSERT INTO public.importacoes (layout, arquivo, linhas_lidas, linhas_importadas, linhas_ignoradas, relatorio)\n  VALUES ('planilha-ad', ${q(arquivo)}, ${leitura.linhas.length}, ${res.validas.length}, ${res.ignoradas.length + res.com_erro.length}, ${q(JSON.stringify(relatorio))}::jsonb)\n  RETURNING id\n)`,
      `INSERT INTO public.vendas (importacao_id, linha_origem, data, competencia, dav, cliente, produto, quantidade, preco_unitario, faturamento, grupo_id, consultor_id, modalidade, tipo, custo_unitario, frete_unitario, desconto_unitario, data_pagamento_compra, data_recebimento, toneladas, taxa_juros_mensal, aliquota_imposto, fator_comissao)`,
      `SELECT imp.id, v.linha::int, v.data::date, v.competencia::date, v.dav, v.cliente, v.produto, v.qtd::numeric, v.unit::numeric, v.fat::numeric, v.grupo::smallint, c.id, v.modalidade, v.tipo,\n       v.custo::numeric, v.frete::numeric, v.descto::numeric, v.pgto::date, v.receb::date, v.ton::numeric, v.juros::numeric, v.imposto::numeric, v.fator::numeric`,
      `FROM imp, (VALUES\n  ${valores.join(',\n  ')}\n) AS v(linha, data, competencia, dav, cliente, produto, qtd, unit, fat, grupo, consultor, modalidade, tipo, custo, frete, descto, pgto, receb, ton, juros, imposto, fator)`,
      'JOIN public.consultores_comerciais c ON c.nome = v.consultor;')
  }

  sql.push('', `DO $$\nBEGIN\n  IF (SELECT count(*) FROM public.vendas WHERE importacao_id IN (SELECT id FROM public.importacoes WHERE relatorio->>'carga_inicial' = 'true')) <> ${totalVendas} THEN\n    RAISE EXCEPTION 'Carga incompleta: esperadas ${totalVendas} vendas (consultor não encontrado?)';\n  END IF;\nEND $$;`, '', 'COMMIT;', '')

  // ── Relatório de vendas ────────────────────────────────────
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  md.push('## Vendas 2026: linhas importadas × total da planilha', '',
    '| Mês | Total da planilha | Linhas importadas | Diferença | Não explicada pelas linhas fora | Vendas | Com erro | Ignoradas |', '|---|---:|---:|---:|---:|---:|---:|---:|')
  for (const c of conciliacoes) {
    const r = resolucoes[c.mes - 1].res
    md.push(`| ${meses[c.mes - 1]} | ${brl(c.total_planilha)} | ${brl(c.importado)} | ${brl(c.diferenca)} | ${brl(c.nao_explicado)} | ${r.validas.length} | ${r.com_erro.length} | ${r.ignoradas.length} |`)
  }
  const totPl = soma(conciliacoes.map(c => c.total_planilha ?? 0))
  const totImp = soma(conciliacoes.map(c => c.importado))
  md.push(`| **jan–set** | **${brl(totPl)}** | **${brl(totImp)}** | **${brl(totPl - totImp)}** | | | | |`, '')

  md.push('### Linhas que ficaram de fora (com valor)', '', '| Mês | Linha | Valor | Motivo |', '|---|---:|---:|---|')
  for (const c of conciliacoes) for (const f of c.fora_com_valor) md.push(`| ${meses[c.mes - 1]} | ${f.linha} | ${brl(f.valor)} | ${f.motivo} |`)
  md.push('')

  // Por unidade: importado × coluna E da planilha do consultor
  md.push('### Realizado jan–set por unidade', '', '| Unidade | Linhas importadas | Planilha do consultor (col. E) | Diferença |', '|---|---:|---:|---:|')
  const porUnidade = [0, 0, 0, 0, 0]
  const porUnidadeGrupo = Array.from({ length: 5 }, () => [0, 0, 0, 0, 0])
  for (const { res } of resolucoes) for (const { venda } of res.validas) {
    const u = UNIDADE_DO_CONSULTOR[venda.consultor_id]
    porUnidade[u] += venda.faturamento
    porUnidadeGrupo[u][venda.grupo_id - 1] += venda.faturamento
  }
  for (const l of leiturasConsultor) {
    const pl = soma(l.realizado_ano_planilha)
    md.push(`| ${l.codigo} | ${brl(porUnidade[l.unidade])} | ${brl(pl)} | ${brl(pl - porUnidade[l.unidade])} |`)
  }
  md.push('', '#### Por unidade e grupo (importado / planilha)', '', `| Unidade | ${ORDEM_GRUPOS.join(' | ')} |`, `|---|${ORDEM_GRUPOS.map(() => '---:').join('|')}|`)
  for (const l of leiturasConsultor) md.push(`| ${l.codigo} | ${ORDEM_GRUPOS.map((_, g) => `${brl(porUnidadeGrupo[l.unidade][g])}<br>${brl(l.realizado_ano_planilha[g])}`).join(' | ')} |`)
  md.push('')

  // Nomes, toneladas, custo pendente
  const naoRec = new Map<string, number>()
  for (const { res } of resolucoes) for (const n of res.nao_reconhecidos) naoRec.set(`${n.tipo}: "${n.texto}"`, (naoRec.get(`${n.tipo}: "${n.texto}"`) ?? 0) + n.ocorrencias)
  md.push('## Nomes não reconhecidos', '', naoRec.size ? [...naoRec].map(([k, v]) => `- ${k} — ${v} linha(s)`).join('\n') : 'Nenhum.', '')

  const erros = resolucoes.flatMap(({ res, mes }) => res.com_erro.map(e => ({ mes, ...e })))
  md.push('## Linhas com erro (não importadas)', '', erros.length ? '| Mês | Linha | Produto | Valor | Erro |\n|---|---:|---|---:|---|\n' + erros.map(e => `| ${meses[e.mes - 1]} | ${e.lida.linha} | ${e.lida.produto} | ${brl(e.lida.faturamento)} | ${e.erros.join('; ')} |`).join('\n') : 'Nenhuma.', '')

  const fert = resolucoes.flatMap(({ res, mes }) => res.validas.filter(v => v.venda.grupo_id === 3).map(v => ({ mes, ...v })))
  md.push('## Toneladas de fertilizante', '', '| Mês | Toneladas | Pelo nome | Pelo preço (≥ R$ 1.000/un) | Não inferidas |', '|---|---:|---:|---:|---:|')
  for (let m = 1; m <= 9; m++) {
    const f = fert.filter(x => x.mes === m)
    md.push(`| ${meses[m - 1]} | ${soma(f.map(x => x.venda.toneladas ?? 0)).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} | ${f.filter(x => x.toneladas_origem === 'nome').length} | ${f.filter(x => x.toneladas_origem === 'preco').length} | ${f.filter(x => x.toneladas_origem == null).length} |`)
  }
  const naoInf = fert.filter(x => x.toneladas_origem == null)
  md.push('', '### Não foi possível inferir', '', naoInf.length ? '| Mês | Linha | Produto | Qtd | Unitário | Motivo |\n|---|---:|---|---:|---:|---|\n' + naoInf.map(x => `| ${meses[x.mes - 1]} | ${x.venda.linha_origem} | ${x.venda.produto} | ${x.venda.quantidade} | ${brl(x.venda.preco_unitario)} | ${x.toneladas_motivo} |`).join('\n') : 'Nenhuma.', '')

  const todas = resolucoes.flatMap(r => r.res.validas)
  const pend = todas.filter(v => v.venda.custo_unitario == null || !(v.venda.quantidade > 0))
  const diverg = resolucoes.flatMap(({ res, mes }) => res.validas.filter(v => v.avisos.some(a => a.startsWith('Faturamento da planilha'))).map(v => ({ mes, ...v })))
  md.push('## Avisos', '',
    `- **Custo pendente:** ${pend.length} de ${todas.length} vendas (${brl(soma(pend.map(v => v.venda.faturamento)))}) — contam no realizado, ficam fora de lucro/comissão.`,
    `- **Faturamento ≠ qtd × unitário:** ${diverg.length} linha(s); vale o valor da coluna G.`,
    ...diverg.map(d => `  - ${meses[d.mes - 1]}, linha ${d.venda.linha_origem}: ${d.venda.produto} — ${d.avisos.find(a => a.startsWith('Faturamento'))}`),
    `- **Data fora do mês de referência** (entra no mês do arquivo, como na planilha): ${resolucoes.flatMap(({ res, mes }) => res.validas.filter(v => v.venda.data.slice(0, 7) !== v.venda.competencia.slice(0, 7)).map(v => `${meses[mes - 1]} L${v.venda.linha_origem} (${v.venda.data})`)).join(', ') || 'nenhuma'}`,
    `- **Taxa de juros (T22):** ${resolucoes.map(r => `${meses[r.mes - 1]} ${r.leitura.taxa_juros_mensal ?? 'padrão'}`).join(' · ')}`,
    '')

  // ── Conferência com o consolidado (2026 - GERAL ADERI VERDE, aba "PN GERAL") ──
  const geral = (await abrir('2026 - GERAL ADERI VERDE.xlsx')).getWorksheet('PN GERAL ')
  if (geral) {
    const linhaGeral = (r: number) => Array.from({ length: 9 }, (_, m) => numero(celula(geral, r, 6 + m)) ?? 0)
    const vendasDoMes = (m: number) => resolucoes[m - 1].res.validas.map(v => v.venda)
    const conferencias: [string, number, (m: number) => number][] = [
      ['Realizado', 41, m => soma(vendasDoMes(m).map(v => v.faturamento))],
      ...ORDEM_GRUPOS.map((g, i) => [`  ${g}`, 35 + i, (m: number) => soma(vendasDoMes(m).filter(v => v.grupo_id === i + 1).map(v => v.faturamento))] as [string, number, (m: number) => number]),
      ['DIF', 63, m => soma(vendasDoMes(m).filter(v => v.tipo === 'DIF').map(v => v.faturamento))],
      ['CONV', 64, m => soma(vendasDoMes(m).filter(v => v.tipo === 'CONV').map(v => v.faturamento))],
      ['Verde Agro', 70, m => soma(vendasDoMes(m).filter(v => v.modalidade === 'VERDE_AGRO').map(v => v.faturamento))],
      ['Venda Direta', 71, m => soma(vendasDoMes(m).filter(v => v.modalidade === 'VENDA_DIRETA').map(v => v.faturamento))],
      ['Toneladas fertilizante', 68, m => soma(vendasDoMes(m).map(v => v.toneladas ?? 0))],
    ]
    const fmt = (n: number, ton: boolean) => (ton ? n.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : brl(n))
    md.push('## Conferência com o consolidado (GERAL ADERI VERDE, aba PN GERAL)', '',
      'Cada célula: **importado** / consolidado. Só aparece o consolidado quando difere em mais de R$ 1,00 (ou 0,5 t).', '',
      `| Indicador | ${meses.slice(0, 9).join(' | ')} |`, `|---|${meses.slice(0, 9).map(() => '---:').join('|')}|`)
    for (const [rotulo, linha, calc] of conferencias) {
      const ton = linha === 68
      const pl = linhaGeral(linha)
      md.push(`| ${rotulo} | ${pl.map((v, m) => { const imp = calc(m + 1); return Math.abs(imp - v) > (ton ? 0.5 : 1) ? `**${fmt(imp, ton)}**<br>${fmt(v, ton)}` : fmt(imp, ton) }).join(' | ')} |`)
    }
    const hist25 = Array.from({ length: 12 }, (_, m) => numero(celula(geral, 20, 6 + m)) ?? 0)
    const histCons = Array.from({ length: 12 }, (_, m) => soma(leiturasConsultor.flatMap(l => l.realizado_anterior.map(g => g[m]))))
    md.push('', `### Realizado ${ANO - 1}: planilhas dos consultores × consolidado`, '',
      `O consolidado soma **${brl(soma(hist25))}**; as 4 planilhas dos consultores (que têm a unidade e foram importadas) somam **${brl(hist)}**. Diferença por mês:`, '',
      `| ${meses.join(' | ')} |`, `|${meses.map(() => '---:').join('|')}|`,
      `| ${hist25.map((v, m) => brl(v - histCons[m])).join(' | ')} |`, '')
  }

  fs.writeFileSync(path.join(SAIDA, 'carga-metas-2026.sql'), sql.join('\n'), 'utf8')
  fs.writeFileSync(path.join(SAIDA, 'conciliacao-2026.md'), md.join('\n'), 'utf8')
  console.log(`Metas ${ANO}: ${brl(metaTotal)} · jan–set ${brl(metaCiclo(9))} · jan–out ${brl(metaCiclo(10))}`)
  console.log(`Realizado ${ANO - 1}: ${brl(hist)}`)
  console.log(`Vendas: ${totalVendas} linhas, ${brl(totImp)} (planilhas: ${brl(totPl)})`)
  for (const c of conciliacoes) console.log(`  ${meses[c.mes - 1]}: planilha ${brl(c.total_planilha)} · linhas ${brl(c.importado)} · dif ${brl(c.diferenca)} · não explicada ${brl(c.nao_explicado)}`)
  console.log(`Arquivos em ${SAIDA}`)
}

main().catch(e => { console.error(e); process.exit(1) })

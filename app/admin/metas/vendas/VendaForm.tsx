'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NumInput from '@/app/components/cotacoes/NumInput'
import { brl } from '@/lib/cotacao'
import { calcularVenda, type ParametrosVenda } from '@/lib/metas/calculo'
import type { DadosCadastro } from '@/lib/metas/cadastros'
import { chaveDuplicidade } from '@/lib/metas/importacao/resolver'
import { inferirToneladas } from '@/lib/metas/importacao/toneladas'
import { MODALIDADES, TIPOS, normalizar } from '@/lib/metas/nomes'
import type { VendaRow } from '@/lib/metas/vendas'

type Item = {
  chave: number
  produto: string
  produto_id: string | null
  grupo_id: string
  tipo: string
  quantidade: number
  preco_unitario: number
  faturamento_fixo: number | null // faturamento informado que difere de qtd × unitário
  custo_unitario: number
  frete_unitario: number
  desconto_unitario: number
  data_pagamento_compra: string
  data_recebimento: string
  toneladas: number | null        // nulo = inferir
}

let seq = 0
const itemVazio = (): Item => ({
  chave: ++seq, produto: '', produto_id: null, grupo_id: '', tipo: '', quantidade: 0, preco_unitario: 0, faturamento_fixo: null,
  custo_unitario: 0, frete_unitario: 0, desconto_unitario: 0, data_pagamento_compra: '', data_recebimento: '', toneladas: null,
})

const hoje = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
const pct = (n: number | null) => (n == null ? '—' : `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`)
const diasBR = (n: number) => `${n.toLocaleString('pt-BR')} dia${Math.abs(n) === 1 ? '' : 's'}`

function IconPlus() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function IconTrash() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
}

// Conta da venda passo a passo, na ordem das colunas da planilha de lançamentos
function Detalhamento({ c, params }: { c: ReturnType<typeof calcularVenda>; params: ParametrosVenda }) {
  if (c.custo_pendente) {
    return (
      <div className="vf-pendente">
        Sem custo (ou sem quantidade): a venda conta no realizado, mas fica fora de lucro e comissão até o custo unitário ser informado.
      </div>
    )
  }
  const negativo = (n: number | null) => (n != null && n < 0 ? ' vf-neg' : '')
  const linha = (rotulo: string, valor: string, como?: string, cls = '') => (
    <div className={`vf-linha${cls}`}><span>{rotulo}{como && <small>{como}</small>}</span><strong>{valor}</strong></div>
  )
  return (
    <div className="vf-detalhe">
      <div>
        <div className="vf-detalhe-titulo">Financeiro</div>
        {linha('Faturamento', brl(c.faturamento))}
        {linha('Custo unit. total', brl(c.custo_unit_total ?? 0), 'custo + frete + desconto')}
        {linha('Total da compra', brl(c.total_compra ?? 0), 'qtd × custo unit. total')}
        {linha('Prazo financiado', diasBR(c.dias_financiamento), 'recebimento − pagamento da compra')}
        {linha('Custo financeiro', brl(c.custo_financeiro ?? 0), `total compra × dias × ${pct(params.taxa_juros_mensal)} ÷ 30`)}
        {linha('Custo total', brl(c.custo_total ?? 0), 'compra + financeiro')}
        {linha('Resultado bruto', brl(c.resultado_bruto ?? 0), `margem bruta ${pct(c.margem_bruta)}`, negativo(c.resultado_bruto))}
        {linha('Imposto', brl(c.imposto ?? 0), `${pct(params.aliquota_imposto)} do resultado bruto`)}
        {linha('Resultado após imposto', brl(c.resultado_apos_imposto ?? 0), `margem líquida ${pct(c.margem_liquida)}`, ' vf-forte' + negativo(c.resultado_apos_imposto))}
      </div>
      <div>
        <div className="vf-detalhe-titulo">Comissão e lucro</div>
        {linha('Base de comissão', brl(c.base_comissao ?? 0), 'faturamento − imposto − financeiro − frete/desconto')}
        {linha('Margem líquida', pct(c.margem_liquida))}
        {linha('Fator de comissão', pct(params.fator_comissao))}
        {linha('% de comissão', pct(c.percentual_comissao), 'margem líquida × fator', ' vf-forte')}
        {linha('Comissão', brl(c.comissao ?? 0), 'base × % de comissão', ' vf-destaque' + negativo(c.comissao))}
        {linha('Lucro', brl(c.lucro ?? 0), 'faturamento − custo total − imposto − comissão', ' vf-forte' + negativo(c.lucro))}
        {linha('% de contribuição', pct(c.lucro_pct), 'lucro ÷ faturamento')}
      </div>
    </div>
  )
}

export default function VendaForm({ dados, venda, voltar = '/admin/metas/vendas' }: { dados: DadosCadastro; venda?: VendaRow; voltar?: string }) {
  const supabase = createClient()
  const router = useRouter()
  const editando = !!venda

  const [data, setData] = useState(venda?.data ?? hoje())
  const [competencia, setCompetencia] = useState(venda?.competencia.slice(0, 7) ?? hoje().slice(0, 7))
  const [competenciaManual, setCompetenciaManual] = useState(!!venda && venda.competencia.slice(0, 7) !== venda.data.slice(0, 7))
  const [dav, setDav] = useState(venda?.dav ?? '')
  const [cliente, setCliente] = useState(venda?.cliente ?? '')
  const [consultorId, setConsultorId] = useState(venda?.consultor_id ?? '')
  // venda importada pode estar sem modalidade ("a completar")
  const [modalidade, setModalidade] = useState<string>(venda ? venda.modalidade ?? '' : 'VERDE_AGRO')
  const [observacao, setObservacao] = useState(venda?.observacao ?? '')
  const [codigos, setCodigos] = useState({ cliente: venda?.cliente_codigo ?? '', produto: venda?.produto_codigo ?? '', vendedor: venda?.vendedor_codigo ?? '' })
  // Parâmetros: os da configuração no lançamento; os gravados na venda na edição. Editáveis nos dois casos.
  const [params, setParams] = useState<ParametrosVenda>(() => venda
    ? { taxa_juros_mensal: venda.taxa_juros_mensal, aliquota_imposto: venda.aliquota_imposto, fator_comissao: venda.fator_comissao }
    : { taxa_juros_mensal: dados.config.taxa_juros_mensal, aliquota_imposto: dados.config.aliquota_imposto, fator_comissao: dados.config.fator_comissao })
  const [itens, setItens] = useState<Item[]>(() => venda ? [{
    chave: ++seq, produto: venda.produto, produto_id: venda.produto_id, grupo_id: venda.grupo_id == null ? '' : String(venda.grupo_id), tipo: venda.tipo ?? '',
    quantidade: venda.quantidade, preco_unitario: venda.preco_unitario,
    faturamento_fixo: Math.abs(venda.faturamento - venda.quantidade * venda.preco_unitario) > 0.005 ? venda.faturamento : null,
    custo_unitario: venda.custo_unitario ?? 0, frete_unitario: venda.frete_unitario, desconto_unitario: venda.desconto_unitario,
    data_pagamento_compra: venda.data_pagamento_compra ?? '', data_recebimento: venda.data_recebimento ?? '', toneladas: venda.toneladas,
  }] : [itemVazio()])

  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([])
  const [produtos, setProdutos] = useState<{ id: string; nome: string }[]>([])
  const [erro, setErro] = useState('')
  const [duplicadas, setDuplicadas] = useState<string[] | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    supabase.from('clientes').select('id, nome').order('nome').limit(5000).then(({ data }) => setClientes(data ?? []))
    supabase.from('produtos').select('id, nome').eq('ativo', true).order('nome').then(({ data }) => setProdutos(data ?? []))
  }, [])

  const fertilizantes = String(dados.grupos.find(g => normalizar(g.nome) === 'FERTILIZANTES')?.id ?? '')
  const consultor = dados.consultores.find(c => c.id === consultorId)
  const unidade = dados.unidades.find(u => u.id === consultor?.unidade_id)

  const calculos = useMemo(() => itens.map(it => calcularVenda({
    ...params, quantidade: it.quantidade, preco_unitario: it.preco_unitario, faturamento: it.faturamento_fixo,
    custo_unitario: it.custo_unitario, frete_unitario: it.frete_unitario, desconto_unitario: it.desconto_unitario,
    data_pagamento_compra: it.data_pagamento_compra || null, data_recebimento: it.data_recebimento || null,
  })), [itens, params])

  const toneladasDe = (it: Item) => it.grupo_id !== fertilizantes ? null : it.toneladas ?? inferirToneladas(it.produto, it.quantidade, it.preco_unitario).toneladas
  const total = calculos.reduce((s, c) => s + c.faturamento, 0)
  const faltando = editando ? [
    !consultorId && 'consultor', !itens[0].grupo_id && 'grupo', !modalidade && 'modalidade', !itens[0].tipo && 'D/C',
  ].filter((x): x is string => !!x) : []

  function mudarItem(chave: number, campos: Partial<Item>) {
    setItens(xs => xs.map(it => {
      if (it.chave !== chave) return it
      const novo = { ...it, ...campos }
      if (('quantidade' in campos || 'preco_unitario' in campos) && !('faturamento_fixo' in campos)) novo.faturamento_fixo = null
      return novo
    }))
    setDuplicadas(null)
  }

  // Faturamento digitado igual a qtd × unitário volta a ser calculado
  function mudarFaturamento(it: Item, n: number) {
    mudarItem(it.chave, { faturamento_fixo: Math.abs(n - it.quantidade * it.preco_unitario) > 0.005 ? n : null })
  }

  function mudarData(d: string) {
    setData(d)
    if (!competenciaManual && d) setCompetencia(d.slice(0, 7))
  }

  function validar() {
    if (!data) return 'Informe a data.'
    if (!competencia) return 'Informe o mês de referência.'
    if (!cliente.trim()) return 'Informe o cliente.'
    // Na edição a classificação pode ficar em branco: a venda continua "a completar", como nos lançamentos
    if (!editando && !consultorId) return 'Escolha o consultor.'
    for (const [i, it] of itens.entries()) {
      const n = itens.length > 1 ? ` (item ${i + 1})` : ''
      if (!it.produto.trim()) return `Informe o produto${n}.`
      if (!editando && !it.grupo_id) return `Escolha o grupo${n}.`
      if (!editando && !it.tipo) return `Escolha DIF ou CONV${n}.`
      if (!(it.quantidade > 0) && it.faturamento_fixo == null) return `Informe a quantidade ou o faturamento${n}.`
      if (!(it.preco_unitario > 0) && it.faturamento_fixo == null) return `Informe o preço unitário ou o faturamento${n}.`
    }
    return ''
  }

  function payload(it: Item, c: ReturnType<typeof calcularVenda>) {
    const nomeProduto = it.produto.trim()
    const prod = it.produto_id ? { id: it.produto_id } : produtos.find(p => normalizar(p.nome) === normalizar(nomeProduto))
    const cli = clientes.find(x => normalizar(x.nome) === normalizar(cliente))
    return {
      data, competencia: competencia + '-01', dav: dav.trim() || null, cliente: cliente.trim(), cliente_id: cli?.id ?? venda?.cliente_id ?? null,
      produto: nomeProduto, produto_id: prod?.id ?? null, quantidade: it.quantidade, preco_unitario: it.preco_unitario,
      faturamento: c.faturamento, grupo_id: it.grupo_id ? Number(it.grupo_id) : null, consultor_id: consultorId || null,
      modalidade: modalidade || null, tipo: it.tipo || null,
      custo_unitario: it.custo_unitario > 0 ? it.custo_unitario : null, frete_unitario: it.frete_unitario, desconto_unitario: it.desconto_unitario,
      data_pagamento_compra: it.data_pagamento_compra || null, data_recebimento: it.data_recebimento || null,
      toneladas: toneladasDe(it), observacao: observacao.trim() || null, ...params,
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const msg = validar()
    if (msg) { setErro(msg); return }
    setErro('')
    setSalvando(true)
    const linhas = itens.map((it, i) => payload(it, calculos[i]))

    if (editando) {
      // unidade_id é recalculada pelo trigger quando o consultor muda
      const { error } = await supabase.from('vendas').update({
        ...linhas[0], cliente_codigo: codigos.cliente.trim() || null, produto_codigo: codigos.produto.trim() || null, vendedor_codigo: codigos.vendedor.trim() || null,
      }).eq('id', venda.id)
      setSalvando(false)
      if (error) { setErro(`Erro ao salvar: ${error.message}`); return }
      router.push(voltar)
      router.refresh()
      return
    }

    // Duplicidade (DAV + produto + quantidade + valor): avisa uma vez, a segunda tentativa grava
    if (duplicadas == null && dav.trim()) {
      const { data: existentes } = await supabase.from('vendas').select('dav, produto, quantidade, preco_unitario').eq('dav', dav.trim())
      const chaves = new Set((existentes ?? []).map(v => chaveDuplicidade({ ...v, quantidade: Number(v.quantidade), preco_unitario: Number(v.preco_unitario) })))
      const repetidas = linhas.filter(l => chaves.has(chaveDuplicidade(l))).map(l => l.produto)
      if (repetidas.length) { setDuplicadas(repetidas); setSalvando(false); return }
    }

    const { error } = await supabase.from('vendas').insert(linhas)
    setSalvando(false)
    if (error) { setErro(`Erro ao salvar: ${error.message}`); return }
    router.push(voltar)
    router.refresh()
  }

  const grade = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0 1rem' } as const
  const opcional = editando ? 'Em branco (a completar)' : 'Escolha...'

  return (
    <form onSubmit={salvar}>
      <style>{`
        .vf-detalhe{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:.5rem 2rem;border-top:1px solid var(--borda-suave);padding-top:.85rem}
        .vf-detalhe-titulo{font-size:.64rem;font-weight:600;color:var(--texto-3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.35rem}
        .vf-linha{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;font-size:.8rem;padding:.3rem 0;border-bottom:1px solid var(--borda-suave);color:var(--texto-2);font-variant-numeric:tabular-nums}
        .vf-linha:last-child{border-bottom:none}
        .vf-linha small{display:block;font-size:.68rem;color:var(--texto-4)}
        .vf-linha strong{color:var(--texto);font-weight:600;white-space:nowrap}
        .vf-forte span{color:var(--texto);font-weight:600}
        .vf-destaque strong{color:#1a7f4b;font-size:.9rem}
        .vf-neg strong{color:#c0392b}
        .vf-pendente{border-top:1px solid var(--borda-suave);padding-top:.75rem;font-size:.8rem;color:#7a52b3}
      `}</style>

      {erro && <div className="ui-alert ui-alert-erro">{erro}</div>}
      {duplicadas && (
        <div className="ui-alert ui-alert-erro">
          Já existe venda com o DAV {dav} para: {duplicadas.join(', ')} (mesma quantidade e valor). Confira; se estiver certo, clique em salvar de novo.
        </div>
      )}
      {faltando.length > 0 && (
        <div className="ui-alert ui-alert-erro">A completar: falta {faltando.join(', ')}. Pode salvar assim, mas a venda fica fora do painel de metas e das comissões.</div>
      )}

      <div className="ui-card ui-card-pad" style={{ marginBottom: '1.25rem' }}>
        <div className="ui-card-title" style={{ marginBottom: '.75rem' }}>Venda</div>
        <div style={grade}>
          <div className="ui-field">
            <label className="ui-label">Data</label>
            <input type="date" className="ui-input" value={data} onChange={e => mudarData(e.target.value)} />
          </div>
          <div className="ui-field">
            <label className="ui-label">Mês de referência</label>
            <input type="month" className="ui-input" value={competencia} onChange={e => { setCompetencia(e.target.value); setCompetenciaManual(true) }} />
          </div>
          <div className="ui-field">
            <label className="ui-label">DAV</label>
            <input className="ui-input" value={dav} onChange={e => { setDav(e.target.value); setDuplicadas(null) }} placeholder="Nº do documento" />
          </div>
          <div className="ui-field">
            <label className="ui-label">Consultor</label>
            <select className="ui-select" value={consultorId} onChange={e => setConsultorId(e.target.value)}>
              <option value="">{opcional}</option>
              {dados.consultores.filter(c => c.ativo || c.id === consultorId).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            {unidade && <div className="ui-hint">Unidade {unidade.codigo} · {unidade.nome}</div>}
          </div>
          <div className="ui-field">
            <label className="ui-label">Modalidade</label>
            <select className="ui-select" value={modalidade} onChange={e => setModalidade(e.target.value)}>
              {editando && <option value="">{opcional}</option>}
              {MODALIDADES.map(m => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
            </select>
          </div>
        </div>
        <div className="ui-field">
          <label className="ui-label">Cliente</label>
          <input className="ui-input" list="metas-clientes" value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Nome do cliente" />
          <datalist id="metas-clientes">{clientes.map(c => <option key={c.id} value={c.nome} />)}</datalist>
        </div>
        <div className="ui-field" style={editando ? undefined : { marginBottom: 0 }}>
          <label className="ui-label">Observação</label>
          <input className="ui-input" value={observacao} onChange={e => setObservacao(e.target.value)} />
        </div>
        {editando && (
          <div style={grade}>
            <div className="ui-field" style={{ marginBottom: 0 }}>
              <label className="ui-label">Cód. cliente (ERP)</label>
              <input className="ui-input" value={codigos.cliente} onChange={e => setCodigos(c => ({ ...c, cliente: e.target.value }))} />
            </div>
            <div className="ui-field" style={{ marginBottom: 0 }}>
              <label className="ui-label">Cód. produto (ERP)</label>
              <input className="ui-input" value={codigos.produto} onChange={e => setCodigos(c => ({ ...c, produto: e.target.value }))} />
            </div>
            <div className="ui-field" style={{ marginBottom: 0 }}>
              <label className="ui-label">Cód. vendedor (ERP)</label>
              <input className="ui-input" value={codigos.vendedor} onChange={e => setCodigos(c => ({ ...c, vendedor: e.target.value }))} />
            </div>
          </div>
        )}
      </div>

      <div className="ui-card ui-card-pad" style={{ marginBottom: '1.25rem' }}>
        <div className="ui-card-title" style={{ marginBottom: '.25rem' }}>Parâmetros de cálculo</div>
        <div className="ui-hint" style={{ marginBottom: '.75rem' }}>
          {editando ? 'Gravados nesta venda. Mudar aqui não altera a configuração geral nem as outras vendas.' : 'Vêm da configuração; mudar aqui vale só para esta venda.'}
        </div>
        <div style={grade}>
          <div className="ui-field" style={{ marginBottom: 0 }}>
            <label className="ui-label">Juros (% a.m.)</label>
            <NumInput valor={params.taxa_juros_mensal} pct onChange={n => setParams(p => ({ ...p, taxa_juros_mensal: n }))} />
          </div>
          <div className="ui-field" style={{ marginBottom: 0 }}>
            <label className="ui-label">Imposto (%)</label>
            <NumInput valor={params.aliquota_imposto} pct onChange={n => setParams(p => ({ ...p, aliquota_imposto: n }))} />
          </div>
          <div className="ui-field" style={{ marginBottom: 0 }}>
            <label className="ui-label">Fator de comissão (%)</label>
            <NumInput valor={params.fator_comissao} pct onChange={n => setParams(p => ({ ...p, fator_comissao: n }))} />
            <div className="ui-hint">% comissão = margem líq. × fator</div>
          </div>
        </div>
      </div>

      <datalist id="metas-produtos">{produtos.map(p => <option key={p.id} value={p.nome} />)}</datalist>

      {itens.map((it, i) => {
        const c = calculos[i]
        const ton = toneladasDe(it)
        return (
          <div key={it.chave} className="ui-card ui-card-pad" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
              <div className="ui-card-title">{editando ? 'Item' : `Item ${i + 1}`}</div>
              {itens.length > 1 && (
                <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => setItens(xs => xs.filter(x => x.chave !== it.chave))}><IconTrash /> Remover</button>
              )}
            </div>
            <div className="ui-field">
              <label className="ui-label">Produto</label>
              <input className="ui-input" list="metas-produtos" value={it.produto} onChange={e => mudarItem(it.chave, { produto: e.target.value, produto_id: null })} />
            </div>
            <div style={grade}>
              <div className="ui-field">
                <label className="ui-label">Grupo</label>
                <select className="ui-select" value={it.grupo_id} onChange={e => mudarItem(it.chave, { grupo_id: e.target.value })}>
                  <option value="">{opcional}</option>
                  {dados.grupos.filter(g => g.ativo || String(g.id) === it.grupo_id).map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </select>
              </div>
              <div className="ui-field">
                <label className="ui-label">Tipo (D/C)</label>
                <select className="ui-select" value={it.tipo} onChange={e => mudarItem(it.chave, { tipo: e.target.value })}>
                  <option value="">{opcional}</option>
                  {TIPOS.map(t => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
                </select>
              </div>
              <div className="ui-field">
                <label className="ui-label">Quantidade</label>
                <NumInput valor={it.quantidade} casas={3} onChange={n => mudarItem(it.chave, { quantidade: n })} />
              </div>
              <div className="ui-field">
                <label className="ui-label">Preço unitário</label>
                <NumInput valor={it.preco_unitario} onChange={n => mudarItem(it.chave, { preco_unitario: n })} />
              </div>
              <div className="ui-field">
                <label className="ui-label">Faturamento</label>
                <NumInput valor={c.faturamento} onChange={n => mudarFaturamento(it, n)} />
                <div className="ui-hint">{it.faturamento_fixo != null ? 'Informado (difere de qtd × unitário)' : 'Qtd × unitário'}</div>
              </div>
              <div className="ui-field">
                <label className="ui-label">Custo unitário</label>
                <NumInput valor={it.custo_unitario} onChange={n => mudarItem(it.chave, { custo_unitario: n })} />
                {c.custo_pendente && <div className="ui-hint" style={{ color: '#7a52b3' }}>Custo pendente</div>}
              </div>
              <div className="ui-field">
                <label className="ui-label">Frete unitário</label>
                <NumInput valor={it.frete_unitario} onChange={n => mudarItem(it.chave, { frete_unitario: n })} />
              </div>
              <div className="ui-field">
                <label className="ui-label">Desconto unitário</label>
                <NumInput valor={it.desconto_unitario} onChange={n => mudarItem(it.chave, { desconto_unitario: n })} />
              </div>
              <div className="ui-field">
                <label className="ui-label">Pagamento da compra</label>
                <input type="date" className="ui-input" value={it.data_pagamento_compra} onChange={e => mudarItem(it.chave, { data_pagamento_compra: e.target.value })} />
              </div>
              <div className="ui-field">
                <label className="ui-label">Recebimento do cliente</label>
                <input type="date" className="ui-input" value={it.data_recebimento} onChange={e => mudarItem(it.chave, { data_recebimento: e.target.value })} />
              </div>
              {it.grupo_id === fertilizantes && (
                <div className="ui-field">
                  <label className="ui-label">Toneladas</label>
                  <NumInput valor={ton ?? 0} casas={3} onChange={n => mudarItem(it.chave, { toneladas: n })} />
                  {it.toneladas == null && <div className="ui-hint">{ton == null ? 'Não deu para inferir; informe' : 'Inferido pelo produto/preço'}</div>}
                </div>
              )}
            </div>
            <Detalhamento c={c} params={params} />
          </div>
        )
      })}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
        <div>
          {!editando && <button type="button" className="ui-btn ui-btn-secondary" onClick={() => setItens(xs => [...xs, itemVazio()])}><IconPlus /> Adicionar item</button>}
        </div>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
          <strong>{brl(total)}</strong>
          <button type="button" className="ui-btn ui-btn-ghost" onClick={() => router.push(voltar)} disabled={salvando}>Cancelar</button>
          <button type="submit" className="ui-btn ui-btn-primary" disabled={salvando}>{salvando ? 'Salvando...' : duplicadas ? 'Salvar mesmo assim' : 'Salvar'}</button>
        </div>
      </div>
    </form>
  )
}

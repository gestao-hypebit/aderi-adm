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
  faturamento_fixo: number | null // faturamento importado que difere de qtd × unitário
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

function IconPlus() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function IconTrash() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
}

export default function VendaForm({ dados, venda }: { dados: DadosCadastro; venda?: VendaRow }) {
  const supabase = createClient()
  const router = useRouter()
  const editando = !!venda

  const [data, setData] = useState(venda?.data ?? hoje())
  const [competencia, setCompetencia] = useState(venda?.competencia.slice(0, 7) ?? hoje().slice(0, 7))
  const [competenciaManual, setCompetenciaManual] = useState(!!venda && venda.competencia.slice(0, 7) !== venda.data.slice(0, 7))
  const [dav, setDav] = useState(venda?.dav ?? '')
  const [cliente, setCliente] = useState(venda?.cliente ?? '')
  const [consultorId, setConsultorId] = useState(venda?.consultor_id ?? '')
  const [modalidade, setModalidade] = useState<string>(venda?.modalidade ?? 'VERDE_AGRO')
  const [observacao, setObservacao] = useState(venda?.observacao ?? '')
  const [itens, setItens] = useState<Item[]>(() => venda ? [{
    chave: ++seq, produto: venda.produto, produto_id: venda.produto_id, grupo_id: String(venda.grupo_id), tipo: venda.tipo,
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

  // Parâmetros: os da configuração no lançamento; os gravados na venda na edição
  const params: ParametrosVenda = venda
    ? { taxa_juros_mensal: venda.taxa_juros_mensal, aliquota_imposto: venda.aliquota_imposto, fator_comissao: venda.fator_comissao }
    : dados.config
  const fertilizantes = String(dados.grupos.find(g => normalizar(g.nome) === 'FERTILIZANTES')?.id ?? '')
  const consultor = dados.consultores.find(c => c.id === consultorId)
  const unidade = dados.unidades.find(u => u.id === consultor?.unidade_id)

  const calculos = useMemo(() => itens.map(it => calcularVenda({
    ...params, quantidade: it.quantidade, preco_unitario: it.preco_unitario, faturamento: it.faturamento_fixo,
    custo_unitario: it.custo_unitario, frete_unitario: it.frete_unitario, desconto_unitario: it.desconto_unitario,
    data_pagamento_compra: it.data_pagamento_compra || null, data_recebimento: it.data_recebimento || null,
  })), [itens, params.taxa_juros_mensal, params.aliquota_imposto, params.fator_comissao])

  const toneladasDe = (it: Item) => it.grupo_id !== fertilizantes ? null : it.toneladas ?? inferirToneladas(it.produto, it.quantidade, it.preco_unitario).toneladas
  const total = calculos.reduce((s, c) => s + c.faturamento, 0)

  function mudarItem(chave: number, campos: Partial<Item>) {
    setItens(xs => xs.map(it => {
      if (it.chave !== chave) return it
      const novo = { ...it, ...campos }
      if ('quantidade' in campos || 'preco_unitario' in campos) novo.faturamento_fixo = null
      return novo
    }))
    setDuplicadas(null)
  }

  function mudarData(d: string) {
    setData(d)
    if (!competenciaManual && d) setCompetencia(d.slice(0, 7))
  }

  function validar() {
    if (!data) return 'Informe a data.'
    if (!competencia) return 'Informe o mês de referência.'
    if (!cliente.trim()) return 'Informe o cliente.'
    if (!consultorId) return 'Escolha o consultor.'
    for (const [i, it] of itens.entries()) {
      const n = itens.length > 1 ? ` (item ${i + 1})` : ''
      if (!it.produto.trim()) return `Informe o produto${n}.`
      if (!it.grupo_id) return `Escolha o grupo${n}.`
      if (!it.tipo) return `Escolha DIF ou CONV${n}.`
      if (!(it.quantidade > 0) && it.faturamento_fixo == null) return `Informe a quantidade${n}.`
      if (!(it.preco_unitario > 0) && it.faturamento_fixo == null) return `Informe o preço unitário${n}.`
    }
    return ''
  }

  function payload(it: Item, c: ReturnType<typeof calcularVenda>) {
    const nomeProduto = it.produto.trim()
    const prod = it.produto_id ? { id: it.produto_id } : produtos.find(p => normalizar(p.nome) === normalizar(nomeProduto))
    const cli = clientes.find(x => normalizar(x.nome) === normalizar(cliente))
    return {
      data, competencia: competencia + '-01', dav: dav.trim() || null, cliente: cliente.trim(), cliente_id: cli?.id ?? null,
      produto: nomeProduto, produto_id: prod?.id ?? null, quantidade: it.quantidade, preco_unitario: it.preco_unitario,
      faturamento: c.faturamento, grupo_id: Number(it.grupo_id), consultor_id: consultorId, modalidade, tipo: it.tipo,
      custo_unitario: it.custo_unitario > 0 ? it.custo_unitario : null, frete_unitario: it.frete_unitario, desconto_unitario: it.desconto_unitario,
      data_pagamento_compra: it.data_pagamento_compra || null, data_recebimento: it.data_recebimento || null,
      toneladas: toneladasDe(it), observacao: observacao.trim() || null,
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
      const { error } = await supabase.from('vendas').update(linhas[0]).eq('id', venda.id)
      setSalvando(false)
      if (error) { setErro(`Erro ao salvar: ${error.message}`); return }
      router.push('/admin/metas/vendas')
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

    const { error } = await supabase.from('vendas').insert(linhas.map(l => ({ ...l, ...params })))
    setSalvando(false)
    if (error) { setErro(`Erro ao salvar: ${error.message}`); return }
    router.push('/admin/metas/vendas')
    router.refresh()
  }

  const grade = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0 1rem' } as const

  return (
    <form onSubmit={salvar}>
      {erro && <div className="ui-alert ui-alert-erro">{erro}</div>}
      {duplicadas && (
        <div className="ui-alert ui-alert-erro">
          Já existe venda com o DAV {dav} para: {duplicadas.join(', ')} (mesma quantidade e valor). Confira; se estiver certo, clique em salvar de novo.
        </div>
      )}

      <div className="ui-card ui-card-pad" style={{ marginBottom: '1.25rem' }}>
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
              <option value="">Escolha...</option>
              {dados.consultores.filter(c => c.ativo || c.id === consultorId).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            {unidade && <div className="ui-hint">Unidade {unidade.codigo} · {unidade.nome}</div>}
          </div>
          <div className="ui-field">
            <label className="ui-label">Modalidade</label>
            <select className="ui-select" value={modalidade} onChange={e => setModalidade(e.target.value)}>
              {MODALIDADES.map(m => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
            </select>
          </div>
        </div>
        <div className="ui-field">
          <label className="ui-label">Cliente</label>
          <input className="ui-input" list="metas-clientes" value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Nome do cliente" />
          <datalist id="metas-clientes">{clientes.map(c => <option key={c.id} value={c.nome} />)}</datalist>
        </div>
        <div className="ui-field" style={{ marginBottom: 0 }}>
          <label className="ui-label">Observação</label>
          <input className="ui-input" value={observacao} onChange={e => setObservacao(e.target.value)} />
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
                  <option value="">Escolha...</option>
                  {dados.grupos.filter(g => g.ativo || String(g.id) === it.grupo_id).map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </select>
              </div>
              <div className="ui-field">
                <label className="ui-label">Tipo</label>
                <select className="ui-select" value={it.tipo} onChange={e => mudarItem(it.chave, { tipo: e.target.value })}>
                  <option value="">Escolha...</option>
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
                <div className="ui-input" style={{ background: 'var(--fundo-2)' }}>{brl(c.faturamento)}</div>
                {it.faturamento_fixo != null && <div className="ui-hint">Valor importado (difere de qtd × unitário)</div>}
              </div>
              <div className="ui-field">
                <label className="ui-label">Custo unitário</label>
                <NumInput valor={it.custo_unitario} onChange={n => mudarItem(it.chave, { custo_unitario: n })} />
                {c.custo_pendente && <div className="ui-hint">Custo pendente</div>}
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
                <label className="ui-label">Recebimento</label>
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
            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '.8rem', color: 'var(--texto-2)', borderTop: '1px solid var(--borda-suave)', paddingTop: '.75rem' }}>
              {c.custo_pendente ? <span>Sem custo: conta no realizado, fora de lucro e comissão.</span> : <>
                <span>Custo total <strong>{brl(c.custo_total ?? 0)}</strong></span>
                <span>Custo financeiro <strong>{brl(c.custo_financeiro ?? 0)}</strong> ({c.dias_financiamento} dias)</span>
                <span>Imposto <strong>{brl(c.imposto ?? 0)}</strong></span>
                <span>Margem líquida <strong>{pct(c.margem_liquida)}</strong></span>
                <span>Comissão <strong>{brl(c.comissao ?? 0)}</strong></span>
                <span>Lucro <strong>{brl(c.lucro ?? 0)}</strong> ({pct(c.lucro_pct)})</span>
              </>}
            </div>
          </div>
        )
      })}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
        <div>
          {!editando && <button type="button" className="ui-btn ui-btn-secondary" onClick={() => setItens(xs => [...xs, itemVazio()])}><IconPlus /> Adicionar item</button>}
          <span className="ui-hint" style={{ marginLeft: '.75rem' }}>
            Juros {pct(params.taxa_juros_mensal)} a.m. · imposto {pct(params.aliquota_imposto)} · fator comissão {pct(params.fator_comissao)}
            {editando ? ' (gravados na venda)' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
          <strong>{brl(total)}</strong>
          <button type="button" className="ui-btn ui-btn-ghost" onClick={() => router.back()} disabled={salvando}>Cancelar</button>
          <button type="submit" className="ui-btn ui-btn-primary" disabled={salvando}>{salvando ? 'Salvando...' : duplicadas ? 'Salvar mesmo assim' : 'Salvar'}</button>
        </div>
      </div>
    </form>
  )
}

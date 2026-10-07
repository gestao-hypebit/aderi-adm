'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Tabela from '@/app/components/Tabela'
import { baixarCsv } from '@/lib/csv'
import { hojeISO } from '@/lib/dateUtils'
import { STATUS_COTACAO, calcularItem, itemDoBanco, parametrosDoBanco, type ItemCotacao } from '@/lib/cotacao'
import { Barra, CabecalhoRelatorio, FiltrosRelatorio, Indicadores, Secao, brl, dataBR, div, num, pctTxt, um, useFiltrosRelatorio } from '../Comum'

type Cotacao = {
  id: string
  numero: string
  status: string
  created_at: string
  criado_por: string
  cliente_id: string | null
  cliente_nome: string | null
  motivo_perda: string | null
  autor: { nome_completo: string | null } | { nome_completo: string | null }[] | null
  venda: number
  resultado: number
  itens: (ItemCotacao & { calc: ReturnType<typeof calcularItem> })[]
}

const COR_STATUS: Record<string, string> = { rascunho: '#b8bdb6', enviada: '#E67E22', aprovada: '#1a7f4b', perdida: '#c0392b' }

export default function RelatorioVendas() {
  const { filtros, setFiltros, consultores, periodo } = useFiltrosRelatorio()
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    createClient().from('cotacoes')
      .select('id, numero, status, created_at, criado_por, cliente_id, cliente_nome, motivo_perda, ptax, juros_mes, aliquota_icms, aliquota_ir, autor:profiles!cotacoes_criado_por_fkey(nome_completo), itens:cotacao_itens(*)')
      .gte('created_at', filtros.dataInicio).lte('created_at', filtros.dataFim + 'T23:59:59')
      .match(filtros.funcionarioId ? { criado_por: filtros.funcionarioId } : {})
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setCotacoes((data ?? []).map(c => {
          const p = parametrosDoBanco(c)
          const itens = ((c.itens ?? []) as Record<string, unknown>[]).map(itemDoBanco).map(i => ({ ...i, calc: calcularItem(i, p) }))
          return {
            id: c.id, numero: c.numero, status: c.status, created_at: c.created_at, criado_por: c.criado_por,
            cliente_id: c.cliente_id, cliente_nome: c.cliente_nome, motivo_perda: c.motivo_perda, autor: c.autor, itens,
            venda: itens.reduce((s, i) => s + i.calc.total, 0),
            resultado: itens.reduce((s, i) => s + i.calc.resultadoLiquido, 0),
          }
        }))
        setCarregando(false)
      })
  }, [filtros.dataInicio, filtros.dataFim, filtros.funcionarioId])

  const r = useMemo(() => {
    const aprovadas = cotacoes.filter(c => c.status === 'aprovada')
    const perdidas = cotacoes.filter(c => c.status === 'perdida')
    const vendido = aprovadas.reduce((s, c) => s + c.venda, 0)
    const resultado = aprovadas.reduce((s, c) => s + c.resultado, 0)

    const funil = Object.keys(STATUS_COTACAO).map(st => {
      const l = cotacoes.filter(c => c.status === st)
      return { status: st, qtd: l.length, valor: l.reduce((s, c) => s + c.venda, 0) }
    })

    const porConsultor = new Map<string, { id: string; nome: string; total: number; aprovadas: number; perdidas: number; cotado: number; vendido: number; resultado: number }>()
    cotacoes.forEach(c => {
      const x = porConsultor.get(c.criado_por) ?? { id: c.criado_por, nome: um(c.autor)?.nome_completo ?? '—', total: 0, aprovadas: 0, perdidas: 0, cotado: 0, vendido: 0, resultado: 0 }
      x.total++; x.cotado += c.venda
      if (c.status === 'aprovada') { x.aprovadas++; x.vendido += c.venda; x.resultado += c.resultado }
      if (c.status === 'perdida') x.perdidas++
      porConsultor.set(c.criado_por, x)
    })

    const porProduto = new Map<string, { produto: string; unidade: string; quantidade: number; valor: number; resultado: number; cotacoes: Set<string> }>()
    aprovadas.forEach(c => c.itens.forEach(i => {
      const k = i.produto_nome.trim().toUpperCase()
      const x = porProduto.get(k) ?? { produto: i.produto_nome, unidade: i.unidade ?? '', quantidade: 0, valor: 0, resultado: 0, cotacoes: new Set<string>() }
      x.quantidade += i.quantidade; x.valor += i.calc.total; x.resultado += i.calc.resultadoLiquido; x.cotacoes.add(c.id)
      porProduto.set(k, x)
    }))

    const porCliente = new Map<string, { cliente: string; aprovadas: number; valor: number }>()
    aprovadas.forEach(c => {
      const k = c.cliente_id ?? c.cliente_nome ?? '—'
      const x = porCliente.get(k) ?? { cliente: c.cliente_nome ?? '—', aprovadas: 0, valor: 0 }
      x.aprovadas++; x.valor += c.venda
      porCliente.set(k, x)
    })

    // motivo principal = texto antes do " — " (o detalhe livre vem depois)
    const porMotivo = new Map<string, { motivo: string; qtd: number; valor: number }>()
    perdidas.forEach(c => {
      const m = (c.motivo_perda ?? 'Não informado').split(' — ')[0]
      const x = porMotivo.get(m) ?? { motivo: m, qtd: 0, valor: 0 }
      x.qtd++; x.valor += c.venda
      porMotivo.set(m, x)
    })

    return {
      motivos: [...porMotivo.values()].sort((a, b) => b.qtd - a.qtd),
      valorPerdido: perdidas.reduce((s, c) => s + c.venda, 0),
      total: cotacoes.length, cotado: cotacoes.reduce((s, c) => s + c.venda, 0),
      aprovadas: aprovadas.length, vendido, resultado,
      conversao: div(aprovadas.length, aprovadas.length + perdidas.length),
      ticket: div(vendido, aprovadas.length),
      margem: div(resultado, vendido),
      funil,
      consultores: [...porConsultor.values()].sort((a, b) => b.vendido - a.vendido),
      produtos: [...porProduto.values()].sort((a, b) => b.valor - a.valor),
      clientes: [...porCliente.values()].sort((a, b) => b.valor - a.valor),
    }
  }, [cotacoes])

  const maxFunil = Math.max(1, ...r.funil.map(f => f.valor))
  const maxProd = Math.max(1, ...r.produtos.map(p => p.valor))
  const maxCli = Math.max(1, ...r.clientes.map(c => c.valor))

  function exportar() {
    baixarCsv(`relatorio-cotacoes-${hojeISO()}`, ['Número', 'Data', 'Cliente', 'Consultor', 'Status', 'Total (R$)', 'Resultado (R$)', 'Margem líquida (%)', 'Motivo da perda'],
      cotacoes.map(c => [c.numero, dataBR(c.created_at), c.cliente_nome, um(c.autor)?.nome_completo, STATUS_COTACAO[c.status]?.label ?? c.status,
        c.venda.toFixed(2).replace('.', ','), c.resultado.toFixed(2).replace('.', ','), c.venda ? ((c.resultado / c.venda) * 100).toFixed(2).replace('.', ',') : '', c.motivo_perda ?? '']))
  }

  return (
    <>
      <CabecalhoRelatorio titulo="Cotações e vendas" descricao="Funil comercial pela data de criação da cotação" periodo={periodo} onExportar={exportar} exportarDesabilitado={!cotacoes.length} />
      <FiltrosRelatorio filtros={filtros} setFiltros={f => { setCarregando(true); setFiltros(f) }} consultores={consultores} />

      <Indicadores carregando={carregando} itens={[
        { rotulo: 'Cotações', valor: num(r.total), sub: `${brl(r.cotado)} cotados` },
        { rotulo: 'Vendas aprovadas', valor: brl(r.vendido), cor: '#1a7f4b', sub: `${r.aprovadas} cotaç${r.aprovadas === 1 ? 'ão' : 'ões'}` },
        { rotulo: 'Conversão', valor: pctTxt(r.conversao), sub: 'aprovadas ÷ (aprovadas + perdidas)' },
        { rotulo: 'Ticket médio', valor: r.ticket != null ? brl(r.ticket) : '—', sub: 'por cotação aprovada' },
        { rotulo: 'Resultado líquido', valor: brl(r.resultado), cor: r.resultado < 0 ? '#c0392b' : undefined, sub: `margem de ${pctTxt(r.margem, 1)}` },
      ]} />

      <div className="rl-duas">
        <Secao titulo="Funil por status" sub="Quantidade e valor das cotações">
          <Tabela linhas={r.funil} chave={f => f.status} carregando={carregando} paginar={false}
            colunas={[
              { id: 'st', titulo: 'Status', celula: f => <span className="ui-cel" style={{ gap: '.5rem' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: COR_STATUS[f.status] }} />{STATUS_COTACAO[f.status].label}</span> },
              { id: 'qtd', titulo: 'Qtd.', alinhar: 'dir', celula: f => <span className="ui-cel-num">{f.qtd}</span> },
              { id: 'valor', titulo: 'Valor', celula: f => <Barra valor={f.valor} max={maxFunil} cor={COR_STATUS[f.status]} texto={brl(f.valor)} /> },
            ]} />
        </Secao>

        <Secao titulo="Principais clientes" sub="Valor aprovado no período">
          <Tabela linhas={r.clientes} chave={c => c.cliente} carregando={carregando} porPagina={5} rotulo="clientes"
            vazio={<div className="ui-empty"><div className="ui-empty-title">Nenhuma venda aprovada</div></div>}
            colunas={[
              { id: 'cli', titulo: 'Cliente', ordenar: (a, b) => a.cliente.localeCompare(b.cliente), celula: c => <span className="ui-cel-titulo">{c.cliente}</span> },
              { id: 'n', titulo: 'Aprov.', alinhar: 'dir', ocultar: 'celular', ordenar: (a, b) => a.aprovadas - b.aprovadas, celula: c => <span className="ui-cel-num">{c.aprovadas}</span> },
              { id: 'valor', titulo: 'Valor', ordenar: (a, b) => a.valor - b.valor, celula: c => <Barra valor={c.valor} max={maxCli} texto={brl(c.valor)} /> },
            ]} />
        </Secao>
      </div>

      <div style={{ height: '1.6rem' }} />

      <Secao titulo="Por consultor" sub="Valor e resultado das cotações aprovadas">
        <Tabela linhas={r.consultores} chave={c => c.id} carregando={carregando} porPagina={10} rotulo="consultores"
          colunas={[
            { id: 'nome', titulo: 'Consultor', ordenar: (a, b) => a.nome.localeCompare(b.nome), celula: c => <span className="ui-cel-titulo">{c.nome}</span> },
            { id: 'total', titulo: 'Cotações', alinhar: 'dir', ordenar: (a, b) => a.total - b.total, celula: c => <span className="ui-cel-num">{c.total}</span> },
            { id: 'apr', titulo: 'Aprovadas', alinhar: 'dir', ordenar: (a, b) => a.aprovadas - b.aprovadas, celula: c => <span className="ui-cel-num ui-cel-forte">{c.aprovadas}</span> },
            { id: 'perd', titulo: 'Perdidas', alinhar: 'dir', ocultar: 'celular', ordenar: (a, b) => a.perdidas - b.perdidas, celula: c => <span className="ui-cel-num">{c.perdidas}</span> },
            { id: 'conv', titulo: 'Conversão', alinhar: 'dir', ocultar: 'celular', ordenar: (a, b) => (div(a.aprovadas, a.aprovadas + a.perdidas) ?? -1) - (div(b.aprovadas, b.aprovadas + b.perdidas) ?? -1),
              celula: c => <span className="ui-cel-num">{pctTxt(div(c.aprovadas, c.aprovadas + c.perdidas))}</span> },
            { id: 'cot', titulo: 'Cotado', alinhar: 'dir', ocultar: 'tablet', ordenar: (a, b) => a.cotado - b.cotado, celula: c => <span className="ui-cel-num">{brl(c.cotado)}</span> },
            { id: 'vend', titulo: 'Vendido', alinhar: 'dir', ordenar: (a, b) => a.vendido - b.vendido, celula: c => <span className="ui-cel-num ui-cel-forte">{brl(c.vendido)}</span> },
            { id: 'res', titulo: 'Resultado', alinhar: 'dir', ocultar: 'tablet', ordenar: (a, b) => a.resultado - b.resultado,
              celula: c => <><div className="ui-cel-num" style={{ color: c.resultado < 0 ? '#c0392b' : '#1e8a4c', fontWeight: 600 }}>{brl(c.resultado)}</div><div className="ui-cel-sub">{pctTxt(div(c.resultado, c.vendido), 1)}</div></> },
          ]} />
      </Secao>

      <Secao titulo="Motivos de perda" sub={`${brl(r.valorPerdido)} em cotações perdidas no período`}>
        <Tabela linhas={r.motivos} chave={m => m.motivo} carregando={carregando} paginar={false}
          vazio={<div className="ui-empty"><div className="ui-empty-title">Nenhuma cotação perdida no período</div></div>}
          colunas={[
            { id: 'motivo', titulo: 'Motivo', ordenar: (a, b) => a.motivo.localeCompare(b.motivo), celula: m => <span className="ui-cel-titulo">{m.motivo}</span> },
            { id: 'qtd', titulo: 'Cotações', ordenar: (a, b) => a.qtd - b.qtd, celula: m => <Barra valor={m.qtd} max={Math.max(1, ...r.motivos.map(x => x.qtd))} cor="#c0392b" texto={num(m.qtd)} /> },
            { id: 'valor', titulo: 'Valor perdido', alinhar: 'dir', ordenar: (a, b) => a.valor - b.valor, celula: m => <span className="ui-cel-num ui-cel-forte">{brl(m.valor)}</span> },
          ]} />
      </Secao>

      <Secao titulo="Produtos mais vendidos" sub="Somente cotações aprovadas">
        <Tabela linhas={r.produtos} chave={p => p.produto} carregando={carregando} porPagina={10} rotulo="produtos"
          vazio={<div className="ui-empty"><div className="ui-empty-title">Nenhuma venda aprovada no período</div></div>}
          colunas={[
            { id: 'prod', titulo: 'Produto', ordenar: (a, b) => a.produto.localeCompare(b.produto), celula: p => <span className="ui-cel-titulo">{p.produto}</span> },
            { id: 'qtd', titulo: 'Quantidade', alinhar: 'dir', ordenar: (a, b) => a.quantidade - b.quantidade, celula: p => <span className="ui-cel-num">{num(p.quantidade, p.quantidade % 1 ? 2 : 0)} {p.unidade}</span> },
            { id: 'valor', titulo: 'Valor vendido', ordenar: (a, b) => a.valor - b.valor, celula: p => <Barra valor={p.valor} max={maxProd} texto={brl(p.valor)} /> },
            { id: 'medio', titulo: 'Preço médio', alinhar: 'dir', ocultar: 'celular', ordenar: (a, b) => (div(a.valor, a.quantidade) ?? 0) - (div(b.valor, b.quantidade) ?? 0),
              celula: p => <span className="ui-cel-num">{brl(div(p.valor, p.quantidade) ?? 0, 2)}</span> },
            { id: 'marg', titulo: 'Margem líq.', alinhar: 'dir', ocultar: 'tablet', ordenar: (a, b) => (div(a.resultado, a.valor) ?? 0) - (div(b.resultado, b.valor) ?? 0),
              celula: p => <span className="ui-cel-num" style={{ color: p.resultado < 0 ? '#c0392b' : undefined }}>{pctTxt(div(p.resultado, p.valor), 1)}</span> },
            { id: 'n', titulo: 'Cotações', alinhar: 'dir', ocultar: 'tablet', ordenar: (a, b) => a.cotacoes.size - b.cotacoes.size, celula: p => <span className="ui-cel-num">{p.cotacoes.size}</span> },
          ]} />
      </Secao>
    </>
  )
}

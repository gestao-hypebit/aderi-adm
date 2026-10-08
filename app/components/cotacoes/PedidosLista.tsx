'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Tabela from '@/app/components/Tabela'
import { baixarCsv } from '@/lib/csv'
import { hojeISO } from '@/lib/dateUtils'
import { PAGAMENTO_STATUS, PEDIDO_STATUS, brl, calcularTotais, itemDoBanco, parametrosDoBanco, saldoPorProduto, totaisPorUnidade, qtd, type SaldoProduto } from '@/lib/cotacao'

// Pedidos = cotações em que o cliente aprovou o orçamento. A lista acompanha faturamento, entregas (cargas e saldo)
// e pagamento; o registro em si é editado na aba "Pedido" da cotação.

type Pedido = {
  id: string
  numero: string
  cliente_nome: string | null
  empresa_rural: string | null
  criado_por: string
  autor: string
  created_at: string
  pedido_status: string | null
  pagamento_status: string | null
  nota_fiscal: string | null
  faturado_em: string | null
  entregue_em: string | null
  pago_em: string | null
  vencimento: string | null
  total: number
  recebido: number
  saldos: SaldoProduto[]
}

const BADGE_PEDIDO: Record<string, string> = { aguardando: 'ui-badge-agendada', faturado: 'ui-badge-neutro', parcial: 'ui-badge-aprovada', entregue: 'ui-badge-realizada', cancelado: 'ui-badge-cancelada' }
const BADGE_PAGTO: Record<string, string> = { em_aberto: 'ui-badge-agendada', parcial: 'ui-badge-neutro', pago: 'ui-badge-realizada' }
const dataBR = (d: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '—')
const situacaoDe = (p: Pedido) => p.pedido_status ?? 'aguardando'
// quanto falta receber: pago = nada; senão total menos o que já entrou
const falta = (p: Pedido) => (p.pagamento_status === 'pago' ? 0 : Math.max(0, p.total - p.recebido))
const faturado = (p: Pedido) => p.pedido_status === 'faturado' || p.pedido_status === 'parcial' || p.pedido_status === 'entregue'
const unidades = (l: { unidade: string; saldo: number; pedido: number; entregue: number }[], campo: 'saldo' | 'pedido' | 'entregue') =>
  l.filter(x => x[campo] > 0.0001).map(x => `${qtd(x[campo])} ${x.unidade}`).join(' + ') || '0'

export default function PedidosLista({ base }: { base: string }) {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [admin, setAdmin] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [situacao, setSituacao] = useState('')
  const [pagamento, setPagamento] = useState('')
  const [consultor, setConsultor] = useState('')
  const [visao, setVisao] = useState<'pedidos' | 'produtos'>('pedidos')
  const [soComSaldo, setSoComSaldo] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      const [{ data: perfil }, { data }, { data: cargas }] = await Promise.all([
        supabase.from('profiles').select('role').eq('id', user?.id ?? '').single(),
        supabase.from('cotacoes')
          .select('id, numero, cliente_nome, empresa_rural, criado_por, created_at, pedido_status, pagamento_status, nota_fiscal, faturado_em, entregue_em, pago_em, valor_recebido, ptax, juros_mes, aliquota_icms, aliquota_ir, autor:profiles!cotacoes_criado_por_fkey(nome_completo), itens:cotacao_itens(*)')
          .eq('status', 'efetivada')
          .order('created_at', { ascending: false }),
        supabase.from('pedido_entregas').select('cotacao_id, produto_nome, unidade, quantidade'),
      ])
      const porPedido = new Map<string, { produto_nome: string; unidade: string | null; quantidade: number }[]>()
      ;(cargas ?? []).forEach(e => { const l = porPedido.get(e.cotacao_id) ?? []; l.push({ ...e, quantidade: Number(e.quantidade) }); porPedido.set(e.cotacao_id, l) })
      setAdmin(perfil?.role === 'admin')
      setPedidos((data ?? []).map(c => {
        const itens = ((c.itens ?? []) as Record<string, unknown>[]).map(itemDoBanco)
        const a = Array.isArray(c.autor) ? c.autor[0] : c.autor
        const vencs = itens.map(i => i.vencimento || i.data_final).filter(Boolean).sort() as string[]
        return {
          id: c.id, numero: c.numero, cliente_nome: c.cliente_nome, empresa_rural: c.empresa_rural, criado_por: c.criado_por,
          autor: a?.nome_completo ?? '—', created_at: c.created_at, pedido_status: c.pedido_status, pagamento_status: c.pagamento_status,
          nota_fiscal: c.nota_fiscal, faturado_em: c.faturado_em, entregue_em: c.entregue_em, pago_em: c.pago_em,
          vencimento: vencs[0] ?? null, total: calcularTotais(itens, parametrosDoBanco(c)).venda,
          saldos: saldoPorProduto(itens, porPedido.get(c.id) ?? []),
          recebido: Number(c.valor_recebido ?? 0),
        }
      }))
      setCarregando(false)
    }
    carregar()
  }, [])

  const consultores = useMemo(() => [...new Map(pedidos.map(p => [p.criado_por, p.autor])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [pedidos])

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return pedidos.filter(p =>
      (!situacao || situacaoDe(p) === situacao) &&
      (!pagamento || (p.pagamento_status ?? 'em_aberto') === pagamento) &&
      (!consultor || p.criado_por === consultor) &&
      (!t || p.numero.includes(t) || (p.cliente_nome ?? '').toLowerCase().includes(t) || (p.nota_fiscal ?? '').toLowerCase().includes(t)))
  }, [pedidos, busca, situacao, pagamento, consultor])

  const ativos = pedidos.filter(p => p.pedido_status !== 'cancelado')
  const saldoGeral = totaisPorUnidade(ativos.flatMap(p => p.saldos))

  // Saldo por produto: soma de todos os pedidos (respeita busca e consultor)
  const produtos = useMemo(() => {
    const m = new Map<string, SaldoProduto & { pedidos: number; clientes: Set<string> }>()
    lista.filter(p => p.pedido_status !== 'cancelado').forEach(p => p.saldos.forEach(s => {
      const k = `${s.chave}|${s.unidade}`
      const x = m.get(k) ?? { ...s, pedido: 0, entregue: 0, saldo: 0, cargas: 0, pedidos: 0, clientes: new Set<string>() }
      x.pedido += s.pedido; x.entregue += s.entregue; x.saldo += s.saldo; x.cargas += s.cargas
      if (s.saldo > 0.0001) { x.pedidos++; if (p.cliente_nome) x.clientes.add(p.cliente_nome) }
      m.set(k, x)
    }))
    return [...m.values()].filter(x => !soComSaldo || x.saldo > 0.0001).sort((a, b) => b.saldo - a.saldo)
  }, [lista, soComSaldo])
  const soma = (f: (p: Pedido) => boolean) => ativos.filter(f).reduce((s, p) => s + p.total, 0)
  const conta = (f: (p: Pedido) => boolean) => ativos.filter(f).length
  const hoje = hojeISO()

  function exportar() {
    if (visao === 'produtos') {
      baixarCsv(`saldo-por-produto-${hoje}`, ['Produto', 'Unidade', 'Vendido', 'Entregue', 'Saldo a entregar', 'Pedidos com saldo', 'Clientes'],
        produtos.map(x => [x.produto, x.unidade, qtd(x.pedido), qtd(x.entregue), qtd(x.saldo), x.pedidos, [...x.clientes].join(', ')]))
      return
    }
    baixarCsv(`pedidos-aderi-${hoje}`, ['Número', 'Data', 'Cliente', 'Consultor', 'Total (R$)', 'Situação', 'Pedido (qtd)', 'Entregue (qtd)', 'Saldo (qtd)', 'Nota fiscal', 'Faturado em', 'Entregue em', 'Pagamento', 'Recebido (R$)', 'Falta receber (R$)', 'Pago em'],
      lista.map(p => { const t = totaisPorUnidade(p.saldos); return [p.numero, dataBR(p.created_at), p.cliente_nome, p.autor, p.total.toFixed(2).replace('.', ','), PEDIDO_STATUS[situacaoDe(p)],
        unidades(t, 'pedido'), unidades(t, 'entregue'), unidades(t, 'saldo'),
        p.nota_fiscal, dataBR(p.faturado_em), dataBR(p.entregue_em), PAGAMENTO_STATUS[p.pagamento_status ?? 'em_aberto'], p.recebido.toFixed(2).replace('.', ','), falta(p).toFixed(2).replace('.', ','), dataBR(p.pago_em)] }))
  }

  return (
    <>
      <div className="ui-page-header">
        <div>
          <div className="ui-title">Pedidos</div>
          <div className="ui-sub">Orçamentos que o cliente aprovou: faturamento, cargas entregues, saldo a entregar e pagamento. Para registrar uma carga, abra o pedido.</div>
        </div>
        <div className="ui-header-actions">
          <button className="ui-btn ui-btn-secondary" onClick={exportar} disabled={carregando || !lista.length}>Exportar CSV</button>
          <Link href={base} className="ui-btn ui-btn-ghost">Ver cotações</Link>
        </div>
      </div>

      <div className="ui-kpis">
        <div className="ui-kpi"><div className="ui-kpi-body"><div className="ui-kpi-label">Total em pedidos</div><div className="ui-kpi-num">{brl(soma(() => true))}</div><div className="ui-kpi-sub">{ativos.length} pedido{ativos.length !== 1 ? 's' : ''} ativo{ativos.length !== 1 ? 's' : ''}</div></div></div>
        <div className="ui-kpi"><div className="ui-kpi-body"><div className="ui-kpi-label">Faturado</div><div className="ui-kpi-num" style={{ color: '#1a7f4b' }}>{brl(soma(faturado))}</div><div className="ui-kpi-sub">{conta(faturado)} pedido{conta(faturado) !== 1 ? 's' : ''} com nota emitida</div></div></div>
        <div className="ui-kpi"><div className="ui-kpi-body"><div className="ui-kpi-label">Saldo a entregar</div><div className="ui-kpi-num" style={{ color: saldoGeral.some(u => u.saldo > 0.0001) ? '#c0651a' : '#1a7f4b', fontSize: '1.15rem' }}>{unidades(saldoGeral, 'saldo')}</div><div className="ui-kpi-sub">de {unidades(saldoGeral, 'pedido')} vendidos</div></div></div>
        <div className="ui-kpi"><div className="ui-kpi-body"><div className="ui-kpi-label">A faturar</div><div className="ui-kpi-num">{brl(soma(p => situacaoDe(p) === 'aguardando'))}</div><div className="ui-kpi-sub">{conta(p => situacaoDe(p) === 'aguardando')} aguardando faturamento</div></div></div>
        <div className="ui-kpi"><div className="ui-kpi-body"><div className="ui-kpi-label">A receber</div><div className="ui-kpi-num">{brl(ativos.reduce((s, p) => s + falta(p), 0))}</div><div className="ui-kpi-sub">{conta(p => falta(p) > 0.005)} pedido{conta(p => falta(p) > 0.005) !== 1 ? 's' : ''} com saldo a receber</div></div></div>
      </div>

      <div className="ui-segmented" role="tablist" aria-label="Visão" style={{ marginBottom: '.8rem' }}>
        <button className={visao === 'pedidos' ? 'ativo' : ''} onClick={() => setVisao('pedidos')}>Por pedido</button>
        <button className={visao === 'produtos' ? 'ativo' : ''} onClick={() => setVisao('produtos')}>Saldo por produto</button>
      </div>

      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
        <input className="ui-input" style={{ width: 260, maxWidth: '100%' }} placeholder="Buscar nº, cliente ou nota fiscal..." value={busca} onChange={e => setBusca(e.target.value)} />
        {admin && consultores.length > 1 && (
          <select className="ui-select ui-select-sm" value={consultor} onChange={e => setConsultor(e.target.value)} aria-label="Filtrar por consultor">
            <option value="">Todos os consultores</option>
            {consultores.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </select>
        )}
        <select className="ui-select ui-select-sm" value={pagamento} onChange={e => setPagamento(e.target.value)} aria-label="Filtrar por pagamento">
          <option value="">Qualquer pagamento</option>
          {Object.entries(PAGAMENTO_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {visao === 'produtos' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.76rem', fontWeight: 600, color: '#5b6660', marginLeft: 'auto' }}>
            <input type="checkbox" checked={soComSaldo} onChange={e => setSoComSaldo(e.target.checked)} /> Só produtos com saldo
          </label>
        )}
        {visao === 'pedidos' && <div className="ui-segmented" role="tablist" aria-label="Situação do pedido" style={{ marginLeft: 'auto' }}>
          <button className={!situacao ? 'ativo' : ''} onClick={() => setSituacao('')}>Todos</button>
          {Object.entries(PEDIDO_STATUS).map(([k, v]) => (
            <button key={k} className={situacao === k ? 'ativo' : ''} onClick={() => setSituacao(k)}>{k === 'aguardando' ? 'A faturar' : v} <span className="ui-count">{pedidos.filter(p => situacaoDe(p) === k).length}</span></button>
          ))}
        </div>}
      </div>

      {visao === 'produtos' ? (
        <Tabela
          linhas={produtos}
          chave={x => `${x.chave}|${x.unidade}`}
          carregando={carregando}
          reiniciar={`${busca}|${consultor}|${soComSaldo}`}
          rotulo="produtos"
          vazio={<div className="ui-empty"><div className="ui-empty-title">{soComSaldo ? 'Nada a entregar' : 'Nenhum produto vendido'}</div><div className="ui-empty-text">{soComSaldo ? 'Todos os pedidos foram entregues.' : 'Os produtos aparecem aqui quando o cliente aprova um orçamento.'}</div></div>}
          colunas={[
            { id: 'prod', titulo: 'Produto', ordenar: (a, b) => a.produto.localeCompare(b.produto),
              celula: x => <div className="ui-cel-txt"><div className="ui-cel-titulo">{x.produto}</div><div className="ui-cel-sub">{x.pedidos ? `${x.pedidos} pedido${x.pedidos > 1 ? 's' : ''} com saldo · ${[...x.clientes].slice(0, 3).join(', ')}${x.clientes.size > 3 ? '…' : ''}` : 'tudo entregue'}</div></div> },
            { id: 'vend', titulo: 'Vendido', alinhar: 'dir', ordenar: (a, b) => a.pedido - b.pedido, celula: x => <span className="ui-cel-num">{qtd(x.pedido)} {x.unidade}</span> },
            { id: 'entr', titulo: 'Entregue', alinhar: 'dir', ordenar: (a, b) => a.entregue - b.entregue, celula: x => <span className="ui-cel-num">{qtd(x.entregue)} {x.unidade}</span> },
            { id: 'saldo', titulo: 'Saldo a entregar', alinhar: 'dir', ordenar: (a, b) => a.saldo - b.saldo,
              celula: x => x.saldo > 0.0001 ? <span className="ui-cel-num ui-cel-forte" style={{ color: '#c0651a' }}>{qtd(x.saldo)} {x.unidade}</span> : <span className="ui-badge ui-badge-realizada">Entregue</span> },
            { id: 'prog', titulo: 'Progresso', ocultar: 'celular', ordenar: (a, b) => (a.pedido ? a.entregue / a.pedido : 0) - (b.pedido ? b.entregue / b.pedido : 0),
              celula: x => <Progresso valor={x.entregue} total={x.pedido} /> },
          ]}
        />
      ) : (
      <Tabela
        linhas={lista}
        chave={p => p.id}
        href={p => `${base}/${p.id}?aba=pedido`}
        carregando={carregando}
        reiniciar={`${busca}|${situacao}|${pagamento}|${consultor}`}
        rotulo="pedidos"
        acoes={p => [
          { rotulo: 'Abrir pedido', icone: 'ver', href: `${base}/${p.id}?aba=pedido` },
          p.pedido_status !== 'cancelado' && p.saldos.some(s => s.saldo > 0.0001) && { rotulo: 'Registrar carga', icone: 'carga', href: `${base}/${p.id}?aba=pedido` },
          { rotulo: 'Imprimir pedido', icone: 'imprimir', href: `/imprimir/cotacao/${p.id}?doc=pedido`, novaAba: true },
        ]}
        vazio={<div className="ui-empty"><div className="ui-empty-title">{pedidos.length ? 'Nenhum pedido encontrado' : 'Nenhum pedido ainda'}</div><div className="ui-empty-text">Quando o cliente aprova um orçamento, ele aparece aqui como pedido.</div></div>}
        colunas={[
          { id: 'num', titulo: 'Pedido', largura: '120px', ordenar: (a, b) => a.numero.localeCompare(b.numero),
            celula: p => <><div className="ui-cel-forte ui-cel-num">{p.numero}</div><div className="ui-cel-sub">{dataBR(p.created_at)}</div></> },
          { id: 'cli', titulo: 'Cliente', ordenar: (a, b) => (a.cliente_nome ?? '').localeCompare(b.cliente_nome ?? ''),
            celula: p => <div className="ui-cel-txt"><div className="ui-cel-titulo">{p.cliente_nome || 'Sem cliente'}</div><div className="ui-cel-sub">{p.empresa_rural || '—'}</div></div> },
          ...(admin ? [{ id: 'autor', titulo: 'Consultor', ocultar: 'tablet' as const, ordenar: (a: Pedido, b: Pedido) => a.autor.localeCompare(b.autor), celula: (p: Pedido) => p.autor }] : []),
          { id: 'total', titulo: 'Total', alinhar: 'dir', ordenar: (a, b) => a.total - b.total, celula: p => <span className="ui-cel-num ui-cel-forte">{brl(p.total)}</span> },
          { id: 'sit', titulo: 'Faturamento', ordenar: (a, b) => situacaoDe(a).localeCompare(situacaoDe(b)),
            celula: p => <><span className={`ui-badge ${BADGE_PEDIDO[situacaoDe(p)]}`}>{PEDIDO_STATUS[situacaoDe(p)]}</span><div className="ui-cel-sub">{p.nota_fiscal ? `NF ${p.nota_fiscal}${p.faturado_em ? ` · ${dataBR(p.faturado_em)}` : ''}` : 'sem nota fiscal'}</div></> },
          { id: 'entrega', titulo: 'Entrega', ocultar: 'celular', ordenar: (a, b) => totaisPorUnidade(a.saldos).reduce((s, u) => s + u.saldo, 0) - totaisPorUnidade(b.saldos).reduce((s, u) => s + u.saldo, 0),
            celula: p => {
              const t = totaisPorUnidade(p.saldos)
              const pedido = t.reduce((s, u) => s + u.pedido, 0)
              const entregue = t.reduce((s, u) => s + Math.min(u.entregue, u.pedido), 0)
              const saldo = t.some(u => u.saldo > 0.0001)
              return <><Progresso valor={entregue} total={pedido} /><div className="ui-cel-sub">{saldo ? `saldo ${unidades(t, 'saldo')}` : p.entregue_em ? `entregue ${dataBR(p.entregue_em)}` : 'entregue'}</div></>
            } },
          { id: 'pagto', titulo: 'Pagamento', ordenar: (a, b) => (a.pagamento_status ?? '').localeCompare(b.pagamento_status ?? ''),
            celula: p => {
              const s = p.pagamento_status ?? 'em_aberto'
              const vencido = s !== 'pago' && p.vencimento && p.vencimento < hoje
              return <><span className={`ui-badge ${vencido ? 'ui-badge-cancelada' : BADGE_PAGTO[s]}`}>{vencido ? 'Vencido' : PAGAMENTO_STATUS[s]}</span><div className="ui-cel-sub">{s === 'pago' ? `pago ${dataBR(p.pago_em)}` : `falta ${brl(falta(p))}${p.vencimento ? ` · venc. ${dataBR(p.vencimento)}` : ''}`}</div></>
            } },
        ]}
      />
      )}
    </>
  )
}

function Progresso({ valor, total }: { valor: number; total: number }) {
  const p = total > 0 ? Math.min(1, valor / total) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '.45rem', minWidth: 110 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 999, background: '#f2efea', overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${p * 100}%`, background: p >= 1 ? '#1a7f4b' : '#E67E22', borderRadius: 999 }} />
      </div>
      <span style={{ fontSize: '.68rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{Math.round(p * 100)}%</span>
    </div>
  )
}

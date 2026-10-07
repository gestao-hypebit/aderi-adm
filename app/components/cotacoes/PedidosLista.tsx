'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Tabela from '@/app/components/Tabela'
import { baixarCsv } from '@/lib/csv'
import { hojeISO } from '@/lib/dateUtils'
import { PAGAMENTO_STATUS, PEDIDO_STATUS, brl, calcularTotais, itemDoBanco, parametrosDoBanco } from '@/lib/cotacao'

// Pedidos = cotações aprovadas pelo cliente. A lista acompanha faturamento, entrega e pagamento;
// o registro em si é editado na aba "Pedido" da cotação.

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
}

const BADGE_PEDIDO: Record<string, string> = { aguardando: 'ui-badge-agendada', faturado: 'ui-badge-neutro', entregue: 'ui-badge-realizada', cancelado: 'ui-badge-cancelada' }
const BADGE_PAGTO: Record<string, string> = { em_aberto: 'ui-badge-agendada', parcial: 'ui-badge-neutro', pago: 'ui-badge-realizada' }
const dataBR = (d: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '—')
const situacaoDe = (p: Pedido) => p.pedido_status ?? 'aguardando'
const faturado = (p: Pedido) => p.pedido_status === 'faturado' || p.pedido_status === 'entregue'

export default function PedidosLista({ base }: { base: string }) {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [admin, setAdmin] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [situacao, setSituacao] = useState('')
  const [pagamento, setPagamento] = useState('')
  const [consultor, setConsultor] = useState('')

  useEffect(() => {
    const supabase = createClient()
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      const [{ data: perfil }, { data }] = await Promise.all([
        supabase.from('profiles').select('role').eq('id', user?.id ?? '').single(),
        supabase.from('cotacoes')
          .select('id, numero, cliente_nome, empresa_rural, criado_por, created_at, pedido_status, pagamento_status, nota_fiscal, faturado_em, entregue_em, pago_em, ptax, juros_mes, aliquota_icms, aliquota_ir, autor:profiles!cotacoes_criado_por_fkey(nome_completo), itens:cotacao_itens(*)')
          .eq('status', 'aprovada')
          .order('created_at', { ascending: false }),
      ])
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
  const soma = (f: (p: Pedido) => boolean) => ativos.filter(f).reduce((s, p) => s + p.total, 0)
  const conta = (f: (p: Pedido) => boolean) => ativos.filter(f).length
  const hoje = hojeISO()

  function exportar() {
    baixarCsv(`pedidos-aderi-${hoje}`, ['Número', 'Data', 'Cliente', 'Consultor', 'Total (R$)', 'Situação', 'Nota fiscal', 'Faturado em', 'Entregue em', 'Pagamento', 'Pago em'],
      lista.map(p => [p.numero, dataBR(p.created_at), p.cliente_nome, p.autor, p.total.toFixed(2).replace('.', ','), PEDIDO_STATUS[situacaoDe(p)],
        p.nota_fiscal, dataBR(p.faturado_em), dataBR(p.entregue_em), PAGAMENTO_STATUS[p.pagamento_status ?? 'em_aberto'], dataBR(p.pago_em)]))
  }

  return (
    <>
      <div className="ui-page-header">
        <div>
          <div className="ui-title">Pedidos</div>
          <div className="ui-sub">Cotações aprovadas pelo cliente: o que já foi faturado, entregue e pago. Para atualizar, abra o pedido.</div>
        </div>
        <div className="ui-header-actions">
          <button className="ui-btn ui-btn-secondary" onClick={exportar} disabled={carregando || !lista.length}>Exportar CSV</button>
          <Link href={base} className="ui-btn ui-btn-ghost">Ver cotações</Link>
        </div>
      </div>

      <div className="ui-kpis">
        <div className="ui-kpi"><div className="ui-kpi-body"><div className="ui-kpi-label">Total em pedidos</div><div className="ui-kpi-num">{brl(soma(() => true))}</div><div className="ui-kpi-sub">{ativos.length} pedido{ativos.length !== 1 ? 's' : ''} ativo{ativos.length !== 1 ? 's' : ''}</div></div></div>
        <div className="ui-kpi"><div className="ui-kpi-body"><div className="ui-kpi-label">Faturado</div><div className="ui-kpi-num" style={{ color: '#1a7f4b' }}>{brl(soma(faturado))}</div><div className="ui-kpi-sub">{conta(faturado)} pedido{conta(faturado) !== 1 ? 's' : ''} com nota emitida</div></div></div>
        <div className="ui-kpi"><div className="ui-kpi-body"><div className="ui-kpi-label">A faturar</div><div className="ui-kpi-num">{brl(soma(p => situacaoDe(p) === 'aguardando'))}</div><div className="ui-kpi-sub">{conta(p => situacaoDe(p) === 'aguardando')} aguardando faturamento</div></div></div>
        <div className="ui-kpi"><div className="ui-kpi-body"><div className="ui-kpi-label">A receber</div><div className="ui-kpi-num">{brl(soma(p => p.pagamento_status !== 'pago'))}</div><div className="ui-kpi-sub">{conta(p => p.pagamento_status !== 'pago')} com pagamento em aberto</div></div></div>
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
        <div className="ui-segmented" role="tablist" aria-label="Situação do pedido" style={{ marginLeft: 'auto' }}>
          <button className={!situacao ? 'ativo' : ''} onClick={() => setSituacao('')}>Todos</button>
          {Object.entries(PEDIDO_STATUS).map(([k, v]) => (
            <button key={k} className={situacao === k ? 'ativo' : ''} onClick={() => setSituacao(k)}>{k === 'aguardando' ? 'A faturar' : v} <span className="ui-count">{pedidos.filter(p => situacaoDe(p) === k).length}</span></button>
          ))}
        </div>
      </div>

      <Tabela
        linhas={lista}
        chave={p => p.id}
        href={p => `${base}/${p.id}?aba=pedido`}
        carregando={carregando}
        reiniciar={`${busca}|${situacao}|${pagamento}|${consultor}`}
        rotulo="pedidos"
        vazio={<div className="ui-empty"><div className="ui-empty-title">{pedidos.length ? 'Nenhum pedido encontrado' : 'Nenhum pedido ainda'}</div><div className="ui-empty-text">Quando uma cotação é marcada como Aprovada, ela aparece aqui como pedido.</div></div>}
        colunas={[
          { id: 'num', titulo: 'Pedido', largura: '120px', ordenar: (a, b) => a.numero.localeCompare(b.numero),
            celula: p => <><div className="ui-cel-forte ui-cel-num">{p.numero}</div><div className="ui-cel-sub">{dataBR(p.created_at)}</div></> },
          { id: 'cli', titulo: 'Cliente', ordenar: (a, b) => (a.cliente_nome ?? '').localeCompare(b.cliente_nome ?? ''),
            celula: p => <div className="ui-cel-txt"><div className="ui-cel-titulo">{p.cliente_nome || 'Sem cliente'}</div><div className="ui-cel-sub">{p.empresa_rural || '—'}</div></div> },
          ...(admin ? [{ id: 'autor', titulo: 'Consultor', ocultar: 'tablet' as const, ordenar: (a: Pedido, b: Pedido) => a.autor.localeCompare(b.autor), celula: (p: Pedido) => p.autor }] : []),
          { id: 'total', titulo: 'Total', alinhar: 'dir', ordenar: (a, b) => a.total - b.total, celula: p => <span className="ui-cel-num ui-cel-forte">{brl(p.total)}</span> },
          { id: 'sit', titulo: 'Faturamento', ordenar: (a, b) => situacaoDe(a).localeCompare(situacaoDe(b)),
            celula: p => <><span className={`ui-badge ${BADGE_PEDIDO[situacaoDe(p)]}`}>{PEDIDO_STATUS[situacaoDe(p)]}</span><div className="ui-cel-sub">{p.nota_fiscal ? `NF ${p.nota_fiscal}${p.faturado_em ? ` · ${dataBR(p.faturado_em)}` : ''}` : 'sem nota fiscal'}</div></> },
          { id: 'entrega', titulo: 'Entrega', ocultar: 'celular', ordenar: (a, b) => (a.entregue_em ?? '').localeCompare(b.entregue_em ?? ''),
            celula: p => p.entregue_em ? <span className="ui-cel-num">{dataBR(p.entregue_em)}</span> : <span className="ui-cel-mudo">—</span> },
          { id: 'pagto', titulo: 'Pagamento', ordenar: (a, b) => (a.pagamento_status ?? '').localeCompare(b.pagamento_status ?? ''),
            celula: p => {
              const s = p.pagamento_status ?? 'em_aberto'
              const vencido = s !== 'pago' && p.vencimento && p.vencimento < hoje
              return <><span className={`ui-badge ${vencido ? 'ui-badge-cancelada' : BADGE_PAGTO[s]}`}>{vencido ? 'Vencido' : PAGAMENTO_STATUS[s]}</span><div className="ui-cel-sub">{s === 'pago' ? `pago ${dataBR(p.pago_em)}` : p.vencimento ? `venc. ${dataBR(p.vencimento)}` : ''}</div></>
            } },
        ]}
      />
    </>
  )
}

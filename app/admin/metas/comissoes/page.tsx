'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Tabela from '@/app/components/Tabela'
import { brl } from '@/lib/cotacao'
import { baixarArquivo } from '@/lib/pdf'
import { carregarCadastros, type DadosCadastro } from '@/lib/metas/cadastros'
import { montarRelatorioComissoes, periodoBR, type ConsultorComissao, type VendaComissao } from '@/lib/metas/comissoes'
import { dataBR } from '@/lib/csv'
import { gerarPdfComissoes } from '@/lib/metas/comissoesPdf'
import { buscarVendas, competenciaBR, type VendaRow } from '@/lib/metas/vendas'
import { Kpi, pct } from '../Comum'

// Comissão se paga depois do mês fechado: abre no mês anterior
function mesAnterior() {
  const [a, m] = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).split('-').map(Number)
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`
}

type LinhaVenda = VendaComissao & { consultor: string }

const qtdBR = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const soma = (vs: LinhaVenda[], f: (v: LinhaVenda) => number | null) => vs.reduce((s, v) => s + (f(v) ?? 0), 0)
const semCustoCel = <span style={{ color: 'var(--texto-4)' }}>—</span>

async function carregarLogo() {
  try {
    const blob = await (await fetch('/logo-aderi.png')).blob()
    return await new Promise<string>((ok, falha) => {
      const r = new FileReader()
      r.onload = () => ok(r.result as string)
      r.onerror = falha
      r.readAsDataURL(blob)
    })
  } catch { return undefined }
}

export default function ComissoesPage() {
  const supabase = createClient()
  const [dados, setDados] = useState<DadosCadastro | null>(null)
  const [de, setDe] = useState(mesAnterior)
  const [ate, setAte] = useState(mesAnterior)
  const [consultor, setConsultor] = useState('')
  const [detalhar, setDetalhar] = useState(true)
  const [vendas, setVendas] = useState<VendaRow[]>([])
  const [carregando, setCarregando] = useState(true)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => { carregarCadastros(supabase).then(setDados).catch(() => setErro('Não foi possível carregar os cadastros.')) }, [])

  useEffect(() => {
    if (!de || !ate) return
    let vivo = true
    buscarVendas(supabase, { de, ate, unidade: '', grupo: '', modalidade: '', tipo: '', cliente: '', custoPendente: false, aCompletar: false, canceladas: false })
      .then(v => { if (vivo) { setVendas(v); setErro('') } })
      .catch(() => vivo && setErro('Não foi possível carregar as vendas.'))
      .finally(() => vivo && setCarregando(false))
    return () => { vivo = false }
  }, [de, ate])

  const rel = useMemo(() => montarRelatorioComissoes(vendas, dados?.consultores ?? [], consultor), [vendas, dados, consultor])
  const t = rel.total
  const semCusto = t.realizado - t.faturamento_com_custo
  const pronto = !carregando && !!dados && rel.consultores.length > 0
  const nomeConsultor = dados?.consultores.find(c => c.id === consultor)?.nome
  const linhasVendas = useMemo<LinhaVenda[]>(() => rel.consultores.flatMap(c => c.vendas.map(v => ({ ...v, consultor: c.nome }))), [rel])
  const comCusto = linhasVendas.filter(v => !v.custo_pendente)

  function mudarPeriodo(novoDe: string, novoAte: string) {
    if (novoDe && novoAte) setCarregando(true)
    setDe(novoDe)
    setAte(novoAte)
  }

  async function gerarPdf() {
    setGerando(true)
    setErro('')
    try {
      const sufixo = de === ate ? de : `${de}-a-${ate}`
      baixarArquivo(await gerarPdfComissoes(rel, {
        periodo: periodoBR(de, ate),
        emitidoEm: new Date().toLocaleDateString('pt-BR'),
        consultor: nomeConsultor,
        detalhar,
        logo: await carregarLogo(),
        nomeArquivo: `comissoes-${sufixo}.pdf`,
      }))
    } catch { setErro('Não foi possível gerar o PDF.') } finally { setGerando(false) }
  }

  return (
    <>
      <div className="ui-page-header">
        <div>
          <div className="ui-title">Comissões</div>
          <div className="ui-sub">Quanto cada consultor vendeu e quanto tem a receber no período, pelo mês de referência da venda.</div>
        </div>
        <div className="ui-header-actions">
          <button className="ui-btn ui-btn-primary" onClick={gerarPdf} disabled={!pronto || !de || !ate || gerando}>{gerando ? 'Gerando...' : 'Gerar PDF'}</button>
        </div>
      </div>

      {erro && <div className="ui-alert ui-alert-erro">{erro}</div>}

      {!carregando && t.qtd_custo_pendente > 0 && (
        <div className="ui-alert ui-alert-erro">
          {t.qtd_custo_pendente} venda(s) somando {brl(semCusto)} estão sem custo e ainda não geram comissão, então o valor a pagar pode aumentar.{' '}
          <Link href={`/admin/metas/lancamentos?mes=${ate}&filtro=custo`} style={{ textDecoration: 'underline' }}>Ver lançamentos de {competenciaBR(`${ate}-01`)}</Link>
        </div>
      )}
      {!carregando && rel.aCompletar.qtd > 0 && (
        <div className="ui-alert ui-alert-erro">
          {rel.aCompletar.qtd} venda(s) somando {brl(rel.aCompletar.valor)} estão a completar e ficam fora do relatório.{' '}
          {rel.aCompletar.competencias.map(c => (
            <Link key={c} href={`/admin/metas/lancamentos?mes=${c.slice(0, 7)}&filtro=completar`} style={{ marginRight: '.5rem', textDecoration: 'underline' }}>{competenciaBR(c)}</Link>
          ))}
        </div>
      )}

      <div className="ui-card ui-card-pad" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0 .75rem' }}>
          <div className="ui-field">
            <label className="ui-label">De (mês ref.)</label>
            <input type="month" className="ui-input ui-input-sm" value={de} onChange={e => mudarPeriodo(e.target.value, ate)} />
          </div>
          <div className="ui-field">
            <label className="ui-label">Até</label>
            <input type="month" className="ui-input ui-input-sm" value={ate} onChange={e => mudarPeriodo(de, e.target.value)} />
          </div>
          <div className="ui-field">
            <label className="ui-label">Consultor</label>
            <select className="ui-select ui-select-sm" value={consultor} onChange={e => setConsultor(e.target.value)}>
              <option value="">Todos</option>
              {dados?.consultores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        </div>
        <label style={{ display: 'flex', gap: '.4rem', alignItems: 'center', fontSize: '.8rem' }}>
          <input type="checkbox" checked={detalhar} onChange={e => setDetalhar(e.target.checked)} /> Incluir no PDF a lista de vendas de cada consultor
        </label>
      </div>

      <div className="ui-kpis">
        <Kpi rotulo="Comissão a pagar" valor={brl(t.comissao)} sub={`${pct(t.faturamento_com_custo ? t.comissao / t.faturamento_com_custo : null, 2)} do vendido com custo`} cor="#1a7f4b" />
        <Kpi rotulo="Vendido no período" valor={brl(t.realizado)} sub={`${t.qtd_vendas} venda(s)`} />
        <Kpi rotulo="Sem custo informado" valor={String(t.qtd_custo_pendente)} sub={`${brl(semCusto)} fora da comissão`} />
      </div>

      <Tabela<ConsultorComissao>
        linhas={rel.consultores}
        chave={c => c.id}
        carregando={carregando}
        paginar={false}
        vazio="Nenhuma venda nesse período."
        colunas={[
          { id: 'nome', titulo: 'Consultor', celula: c => c.nome, ordenar: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR') },
          { id: 'qtd', titulo: 'Vendas', celula: c => c.resumo.qtd_vendas, alinhar: 'dir', ocultar: 'celular' },
          { id: 'vendido', titulo: 'Vendido', celula: c => brl(c.resumo.realizado), alinhar: 'dir', ordenar: (a, b) => a.resumo.realizado - b.resumo.realizado },
          { id: 'custo', titulo: 'Com custo', celula: c => brl(c.resumo.faturamento_com_custo), alinhar: 'dir', ocultar: 'tablet' },
          { id: 'margem', titulo: 'Margem líq.', celula: c => pct(c.resumo.margem_liquida), alinhar: 'dir', ocultar: 'tablet' },
          { id: 'pend', titulo: 'Sem custo', celula: c => c.resumo.qtd_custo_pendente, alinhar: 'dir', ocultar: 'celular' },
          { id: 'comissao', titulo: 'Comissão a pagar', celula: c => <strong>{brl(c.resumo.comissao)}</strong>, alinhar: 'dir', ordenar: (a, b) => a.resumo.comissao - b.resumo.comissao },
        ]}
      />

      <div className="ui-title" style={{ fontSize: '1rem', margin: '1.75rem 0 .75rem' }}>Vendas do período</div>
      <Tabela<LinhaVenda>
        linhas={linhasVendas}
        chave={v => v.id}
        carregando={carregando}
        paginar={false}
        reiniciar={`${de}|${ate}|${consultor}`}
        vazio="Nenhuma venda nesse período."
        colunas={[
          ...(consultor ? [] : [{ id: 'consultor', titulo: 'Consultor', celula: (v: LinhaVenda) => v.consultor, ordenar: (a: LinhaVenda, b: LinhaVenda) => a.consultor.localeCompare(b.consultor, 'pt-BR') }]),
          { id: 'cliente', titulo: 'Cliente', celula: v => v.cliente, ordenar: (a, b) => a.cliente.localeCompare(b.cliente, 'pt-BR') },
          { id: 'dav', titulo: 'DAV', celula: v => v.dav ?? '—', ordenar: (a, b) => (a.dav ?? '').localeCompare(b.dav ?? '', 'pt-BR', { numeric: true }) },
          { id: 'data', titulo: 'Data DAV', celula: v => dataBR(v.data), ordenar: (a, b) => a.data.localeCompare(b.data) },
          { id: 'produto', titulo: 'Produto', celula: v => v.produto, ordenar: (a, b) => a.produto.localeCompare(b.produto, 'pt-BR') },
          { id: 'qtd', titulo: 'Qtd.', celula: v => qtdBR(v.quantidade), alinhar: 'dir', ordenar: (a, b) => a.quantidade - b.quantidade },
          { id: 'bruto', titulo: 'Valor bruto', celula: v => brl(v.faturamento), alinhar: 'dir', ordenar: (a, b) => a.faturamento - b.faturamento },
          { id: 'custo', titulo: 'Custo total', celula: v => (v.custo_pendente ? <span style={{ color: 'var(--laranja)' }}>sem custo</span> : brl(v.custo_total ?? 0)), alinhar: 'dir', ordenar: (a, b) => (a.custo_total ?? -Infinity) - (b.custo_total ?? -Infinity) },
          { id: 'resultado', titulo: 'Resultado', celula: v => (v.custo_pendente ? semCustoCel : brl(v.resultado ?? 0)), alinhar: 'dir', ordenar: (a, b) => (a.resultado ?? -Infinity) - (b.resultado ?? -Infinity) },
          { id: 'margem', titulo: 'Margem', celula: v => (v.custo_pendente ? semCustoCel : pct(v.margem_liquida)), alinhar: 'dir', ordenar: (a, b) => (a.margem_liquida ?? -Infinity) - (b.margem_liquida ?? -Infinity) },
          { id: 'comissao', titulo: 'Comissão', celula: v => (v.custo_pendente ? semCustoCel : <strong>{brl(v.comissao ?? 0)}</strong>), alinhar: 'dir', ordenar: (a, b) => (a.comissao ?? -Infinity) - (b.comissao ?? -Infinity) },
        ]}
        rodape={
          <tr>
            <td colSpan={consultor ? 4 : 5}><strong>Total ({linhasVendas.length} venda(s))</strong></td>
            <td className="dir"><strong>{qtdBR(soma(linhasVendas, v => v.quantidade))}</strong></td>
            <td className="dir"><strong>{brl(soma(linhasVendas, v => v.faturamento))}</strong></td>
            <td className="dir"><strong>{brl(soma(comCusto, v => v.custo_total))}</strong></td>
            <td className="dir"><strong>{brl(soma(comCusto, v => v.resultado))}</strong></td>
            <td className="dir"><strong>{pct(t.margem_liquida)}</strong></td>
            <td className="dir"><strong>{brl(t.comissao)}</strong></td>
          </tr>
        }
      />
    </>
  )
}

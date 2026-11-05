'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Tabela from '@/app/components/Tabela'
import { brl } from '@/lib/cotacao'
import { baixarArquivo } from '@/lib/pdf'
import { carregarCadastros, type DadosCadastro } from '@/lib/metas/cadastros'
import { montarRelatorioComissoes, periodoBR, type ConsultorComissao } from '@/lib/metas/comissoes'
import { gerarPdfComissoes } from '@/lib/metas/comissoesPdf'
import { buscarVendas, competenciaBR, type VendaRow } from '@/lib/metas/vendas'
import { Kpi, pct } from '../Comum'

// Comissão se paga depois do mês fechado: abre no mês anterior
function mesAnterior() {
  const [a, m] = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).split('-').map(Number)
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`
}

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
    </>
  )
}

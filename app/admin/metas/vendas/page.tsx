'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Tabela from '@/app/components/Tabela'
import { brl } from '@/lib/cotacao'
import { baixarCsv, dataBR } from '@/lib/csv'
import { calcularVenda, resumirVendas } from '@/lib/metas/calculo'
import { carregarCadastros, type DadosCadastro } from '@/lib/metas/cadastros'
import { MODALIDADES, TIPOS } from '@/lib/metas/nomes'
import { Kpi, pct } from '../Comum'
import { buscarVendas, competenciaBR, MODALIDADE_ROTULO, type FiltrosVendas, type VendaRow } from '@/lib/metas/vendas'

function IconPlus() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function IconUpload() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
}
function IconDownload() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
}

const mesAtual = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 7)

export default function VendasPage() {
  const supabase = createClient()
  const [dados, setDados] = useState<DadosCadastro | null>(null)
  const [filtros, setFiltros] = useState<FiltrosVendas>(() => ({
    de: mesAtual().slice(0, 4) + '-01', ate: mesAtual(), unidade: '', consultor: '', grupo: '', modalidade: '', tipo: '', cliente: '', custoPendente: false, canceladas: false,
  }))
  const [vendas, setVendas] = useState<VendaRow[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => { carregarCadastros(supabase).then(setDados).catch(() => setErro('Não foi possível carregar os cadastros.')) }, [])

  useEffect(() => {
    // espera a digitação do cliente
    const t = setTimeout(() => {
      setCarregando(true)
      buscarVendas(supabase, filtros)
        .then(v => { setVendas(v); setErro('') })
        .catch(() => setErro('Não foi possível carregar as vendas.'))
        .finally(() => setCarregando(false))
    }, 300)
    return () => clearTimeout(t)
  }, [filtros])

  const f = <K extends keyof FiltrosVendas>(k: K, v: FiltrosVendas[K]) => setFiltros(x => ({ ...x, [k]: v }))
  const resumo = useMemo(() => resumirVendas(vendas), [vendas])
  const consultor = (id: string) => dados?.consultores.find(c => c.id === id)?.nome ?? ''
  const unidade = (id: number) => dados?.unidades.find(u => u.id === id)?.codigo ?? ''
  const grupo = (id: number) => dados?.grupos.find(g => g.id === id)?.nome ?? ''
  const consultoresFiltro = (dados?.consultores ?? []).filter(c => !filtros.unidade || c.unidade_id === Number(filtros.unidade))

  function exportar() {
    baixarCsv(`vendas-${filtros.de}-a-${filtros.ate}`,
      ['Data', 'Mês ref.', 'DAV', 'Cliente', 'Produto', 'Qtd', 'Unitário', 'Faturamento', 'Grupo', 'Consultor', 'Unidade', 'Modalidade', 'Tipo', 'Toneladas',
        'Custo unit.', 'Frete unit.', 'Desc. unit.', 'Custo total', 'Custo financeiro', 'Imposto', 'Comissão', 'Lucro', 'Margem líquida', 'Situação'],
      vendas.map(v => {
        const c = calcularVenda(v)
        const n = (x: number | null) => (x == null ? '' : x.toLocaleString('pt-BR', { maximumFractionDigits: 4 }))
        return [dataBR(v.data), competenciaBR(v.competencia), v.dav, v.cliente, v.produto, n(v.quantidade), n(v.preco_unitario), n(v.faturamento),
          grupo(v.grupo_id), consultor(v.consultor_id), unidade(v.unidade_id), MODALIDADE_ROTULO[v.modalidade], v.tipo, n(v.toneladas),
          n(v.custo_unitario), n(v.frete_unitario), n(v.desconto_unitario), n(c.custo_total), n(c.custo_financeiro), n(c.imposto), n(c.comissao), n(c.lucro),
          n(c.margem_liquida), v.cancelada ? 'Cancelada' : c.custo_pendente ? 'Custo pendente' : '']
      }))
  }

  return (
    <>
      <div className="ui-page-header">
        <div>
          <div className="ui-title">Vendas</div>
          <div className="ui-sub">Vendas faturadas, um registro por item. É o realizado das metas.</div>
        </div>
        <div className="ui-header-actions">
          <button className="ui-btn ui-btn-ghost" onClick={exportar} disabled={!vendas.length}><IconDownload /> Exportar</button>
          <Link href="/admin/metas/importar" className="ui-btn ui-btn-secondary"><IconUpload /> Importar</Link>
          <Link href="/admin/metas/vendas/nova" className="ui-btn ui-btn-primary"><IconPlus /> Nova venda</Link>
        </div>
      </div>

      {erro && <div className="ui-alert ui-alert-erro">{erro}</div>}

      <div className="ui-card ui-card-pad" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0 .75rem' }}>
          <div className="ui-field">
            <label className="ui-label">De (mês ref.)</label>
            <input type="month" className="ui-input ui-input-sm" value={filtros.de} onChange={e => f('de', e.target.value)} />
          </div>
          <div className="ui-field">
            <label className="ui-label">Até</label>
            <input type="month" className="ui-input ui-input-sm" value={filtros.ate} onChange={e => f('ate', e.target.value)} />
          </div>
          <div className="ui-field">
            <label className="ui-label">Unidade</label>
            <select className="ui-select ui-select-sm" value={filtros.unidade} onChange={e => setFiltros(x => ({ ...x, unidade: e.target.value, consultor: '' }))}>
              <option value="">Todas</option>
              {dados?.unidades.map(u => <option key={u.id} value={u.id}>{u.codigo} · {u.nome}</option>)}
            </select>
          </div>
          <div className="ui-field">
            <label className="ui-label">Consultor</label>
            <select className="ui-select ui-select-sm" value={filtros.consultor} onChange={e => f('consultor', e.target.value)}>
              <option value="">Todos</option>
              {consultoresFiltro.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="ui-field">
            <label className="ui-label">Grupo</label>
            <select className="ui-select ui-select-sm" value={filtros.grupo} onChange={e => f('grupo', e.target.value)}>
              <option value="">Todos</option>
              {dados?.grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          </div>
          <div className="ui-field">
            <label className="ui-label">Modalidade</label>
            <select className="ui-select ui-select-sm" value={filtros.modalidade} onChange={e => f('modalidade', e.target.value)}>
              <option value="">Todas</option>
              {MODALIDADES.map(m => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
            </select>
          </div>
          <div className="ui-field">
            <label className="ui-label">Tipo</label>
            <select className="ui-select ui-select-sm" value={filtros.tipo} onChange={e => f('tipo', e.target.value)}>
              <option value="">Todos</option>
              {TIPOS.map(t => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
            </select>
          </div>
          <div className="ui-field">
            <label className="ui-label">Cliente</label>
            <input className="ui-input ui-input-sm" value={filtros.cliente} onChange={e => f('cliente', e.target.value)} placeholder="Buscar..." />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '.8rem' }}>
          <label style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
            <input type="checkbox" checked={filtros.custoPendente} onChange={e => f('custoPendente', e.target.checked)} /> Só custo pendente
          </label>
          <label style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
            <input type="checkbox" checked={filtros.canceladas} onChange={e => f('canceladas', e.target.checked)} /> Mostrar canceladas
          </label>
        </div>
      </div>

      <div className="ui-kpis">
        <Kpi rotulo="Realizado" valor={brl(resumo.realizado)} sub={`${resumo.qtd_vendas} vendas`} />
        <Kpi rotulo="Custo pendente" valor={String(resumo.qtd_custo_pendente)} sub={brl(resumo.realizado - resumo.faturamento_com_custo)} />
        <Kpi rotulo="Lucro" valor={brl(resumo.lucro)} sub={`${pct(resumo.lucro_pct)} sobre ${brl(resumo.faturamento_com_custo)} com custo`} />
        <Kpi rotulo="Comissão" valor={brl(resumo.comissao)} sub={`margem líquida ${pct(resumo.margem_liquida)}`} />
      </div>

      <Tabela
        linhas={vendas}
        chave={v => v.id}
        href={v => `/admin/metas/vendas/${v.id}`}
        carregando={carregando}
        reiniciar={filtros}
        rotulo="vendas"
        porPagina={50}
        vazio="Nenhuma venda com esses filtros."
        colunas={[
          { id: 'data', titulo: 'Data', celula: v => <>{dataBR(v.data)}{v.data.slice(0, 7) !== v.competencia.slice(0, 7) && <div className="ui-cel-sub">ref. {competenciaBR(v.competencia)}</div>}</>, largura: '100px', ordenar: (a, b) => a.data.localeCompare(b.data) },
          { id: 'dav', titulo: 'DAV', celula: v => v.dav ?? '—', ocultar: 'celular', largura: '100px' },
          { id: 'cliente', titulo: 'Cliente', celula: v => <span className="ui-cel-txt">{v.cliente}</span>, ocultar: 'tablet', ordenar: (a, b) => a.cliente.localeCompare(b.cliente) },
          { id: 'produto', titulo: 'Produto', celula: v => <><span className="ui-cel-txt">{v.produto}</span><div className="ui-cel-sub">{grupo(v.grupo_id)} · {v.tipo} · {MODALIDADE_ROTULO[v.modalidade]}</div></> },
          { id: 'consultor', titulo: 'Consultor', celula: v => <>{consultor(v.consultor_id)}<div className="ui-cel-sub">Unidade {unidade(v.unidade_id)}</div></>, ocultar: 'celular' },
          { id: 'qtd', titulo: 'Qtd', celula: v => v.quantidade.toLocaleString('pt-BR'), alinhar: 'dir', ocultar: 'tablet' },
          { id: 'fat', titulo: 'Faturamento', celula: v => brl(v.faturamento), alinhar: 'dir', ordenar: (a, b) => a.faturamento - b.faturamento },
          { id: 'lucro', titulo: 'Lucro', alinhar: 'dir', ocultar: 'celular', celula: v => {
            const c = calcularVenda(v)
            if (v.cancelada) return <span className="ui-badge ui-badge-cancelada">Cancelada</span>
            if (c.custo_pendente) return <span className="ui-badge ui-badge-aguardando">Custo pendente</span>
            return <>{brl(c.lucro ?? 0)}<div className="ui-cel-sub">{pct(c.lucro_pct)}</div></>
          } },
        ]}
      />
    </>
  )
}

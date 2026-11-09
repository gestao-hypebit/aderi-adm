'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ConfirmDialog from '@/app/admin/_ui/ConfirmDialog'
import NumInput from '@/app/components/cotacoes/NumInput'
import { brl } from '@/lib/cotacao'
import { calcularVenda } from '@/lib/metas/calculo'
import type { DadosCadastro } from '@/lib/metas/cadastros'
import { dataBR } from '@/lib/csv'
import { baixarXlsx, type ColunaExcel } from '@/lib/metas/excel'
import { casaNumero, casaTexto, completarEdicao, dataPadrao, resumirMes, type CamposEditaveis } from '@/lib/metas/lancamento'
import { MODALIDADES, TIPOS, normalizar } from '@/lib/metas/nomes'
import { buscarTodas, competenciaBR, faltandoNaVenda, MODALIDADE_ROTULO, vendaDoBanco, type VendaRow } from '@/lib/metas/vendas'
import { Kpi, pct } from '../Comum'

// Lançamentos do mês no formato da planilha AD: uma linha por item, editável na própria
// célula e salva sozinha. As colunas calculadas seguem lib/metas/calculo.ts.

type Filtro = 'todas' | 'completar' | 'custo'
type Status = 'salvando' | 'erro'

const hojeSP = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
const SALVAR_APOS_MS = 700
const ultimoDia = (mes: string) => {
  const [a, m] = mes.split('-').map(Number)
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10)
}
const somarMes = (mes: string, n: number) => {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1 + n, 1))
  return d.toISOString().slice(0, 7)
}
const num = (n: number | null | undefined, casas = 2) => (n == null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }))

function IconChevron({ dir }: { dir: 'esq' | 'dir' }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">{dir === 'esq' ? <polyline points="15 18 9 12 15 6"/> : <polyline points="9 18 15 12 9 6"/>}</svg>
}
function IconPlus() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function IconUpload() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
}
function IconDownload() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
}
function IconCopy() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
}
function IconBan() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
}
function IconTrash() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
}
function IconOpen() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
}

// Texto: guarda ao sair da célula (ou Enter), não a cada letra
function TextoCel({ valor, onSalvar, largura, lista, nav }: { valor: string; onSalvar: (s: string) => void; largura: number; lista?: string; nav: string }) {
  const [txt, setTxt] = useState<string | null>(null)
  return (
    <input
      className="lc-in" style={{ width: largura }} list={lista} data-nav={nav}
      value={txt ?? valor}
      onFocus={() => setTxt(valor)}
      onChange={e => setTxt(e.target.value)}
      onBlur={() => { if (txt != null && txt.trim() !== valor) onSalvar(txt.trim()); setTxt(null) }}
    />
  )
}

function DataCel({ valor, onSalvar, nav, fora }: { valor: string | null; onSalvar: (s: string | null) => void; nav: string; fora?: boolean }) {
  return (
    <input
      type="date" className={`lc-in lc-data${fora ? ' lc-fora' : ''}`} data-nav={nav} value={valor ?? ''}
      title={fora ? 'Data fora do mês: soma neste mês mesmo assim (como na planilha)' : undefined}
      onChange={e => { const s = e.target.value; if (!s || /^\d{4}-\d{2}-\d{2}$/.test(s)) onSalvar(s || null) }}
    />
  )
}

function SelectCel({ valor, opcoes, onSalvar, nav, largura }: { valor: string | number | null; opcoes: { valor: string; rotulo: string }[]; onSalvar: (s: string | null) => void; nav: string; largura: number }) {
  return (
    <select className={`lc-in lc-sel${valor == null ? ' lc-falta' : ''}`} style={{ width: largura }} data-nav={nav} value={valor ?? ''} onChange={e => onSalvar(e.target.value || null)}>
      <option value="">—</option>
      {opcoes.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
    </select>
  )
}

type Opcoes = { grupos: { valor: string; rotulo: string }[]; consultores: { valor: string; rotulo: string }[]; modalidades: { valor: string; rotulo: string }[]; tipos: { valor: string; rotulo: string }[] }

// Colunas da grade, na ordem da tabela: título no cabeçalho e o filtro de cada uma
type Calculo = ReturnType<typeof calcularVenda>
type Coluna = {
  id: string
  titulo: string
  num?: boolean
  inicioGrupo?: boolean
  calculada?: boolean
  opcoes?: { valor: string; rotulo: string }[]
  casa: (v: VendaRow, c: Calculo, filtro: string) => boolean
}
type ExtraColuna = Pick<Coluna, 'inicioGrupo' | 'calculada'>
const SEM_VALOR = '__sem_valor'

const colTexto = (id: string, titulo: string, valor: (v: VendaRow) => string | null): Coluna =>
  ({ id, titulo, casa: (v, _, f) => casaTexto(valor(v), f) })
const colData = (id: string, titulo: string, valor: (v: VendaRow) => string | null) => colTexto(id, titulo, v => dataBR(valor(v)))
const colNum = (id: string, titulo: string, valor: (v: VendaRow, c: Calculo) => number | null, extra: ExtraColuna = {}): Coluna =>
  ({ id, titulo, num: true, ...extra, casa: (v, c, f) => casaNumero(valor(v, c), f) })
// Calculada: com custo pendente a célula fica "—", então não casa com nenhum número
const colCalc = (id: string, titulo: string, valor: (c: Calculo) => number | null, extra: ExtraColuna = {}) =>
  colNum(id, titulo, (_, c) => (c.custo_pendente ? null : valor(c)), { calculada: true, ...extra })
const colCalcPct = (id: string, titulo: string, valor: (c: Calculo) => number | null) =>
  colCalc(id, titulo, c => { const n = valor(c); return n == null ? null : n * 100 })
const colSelect = (id: string, titulo: string, valor: (v: VendaRow) => string | number | null, opcoes: Coluna['opcoes']): Coluna =>
  ({ id, titulo, opcoes, casa: (v, _, f) => (f === SEM_VALOR ? valor(v) == null : String(valor(v)) === f) })

function montarColunas(dados: DadosCadastro, opcoes: Opcoes): Coluna[] {
  return [
    colData('data', 'Data', v => v.data),
    colTexto('dav', 'DAV', v => v.dav),
    colTexto('cliente', 'Cliente', v => v.cliente),
    colTexto('produto', 'Produto', v => v.produto),
    colNum('qtd', 'Qtd.', v => v.quantidade),
    colNum('unit', 'Unit R$', v => v.preco_unitario),
    colNum('fat', 'Faturamento', v => v.faturamento),
    // inclui inativos: linha antiga também precisa ser achada
    colSelect('grupo', 'Grupo', v => v.grupo_id, dados.grupos.map(g => ({ valor: String(g.id), rotulo: g.nome }))),
    colSelect('consultor', 'Consultor', v => v.consultor_id, dados.consultores.map(c => ({ valor: c.id, rotulo: c.nome }))),
    colSelect('modalidade', 'Modalidade', v => v.modalidade, opcoes.modalidades),
    colSelect('tipo', 'D/C', v => v.tipo, opcoes.tipos),
    colNum('custo', 'Custo unit.', v => v.custo_unitario, { inicioGrupo: true }),
    colNum('frete', 'Frete unit.', v => v.frete_unitario),
    colNum('desc', 'Desc. unit.', v => v.desconto_unitario),
    colData('pgto', 'Pgto comp.', v => v.data_pagamento_compra),
    colData('receb', 'Pgto receb.', v => v.data_recebimento),
    colNum('imp', 'Imp. %', v => v.aliquota_imposto * 100),
    colNum('ton', 'Ton.', v => v.toneladas),
    colCalc('custoTotalUnit', 'Custo unit. total', c => c.custo_unit_total, { inicioGrupo: true }),
    colCalc('compra', 'Total compra', c => c.total_compra),
    colNum('dias', 'Dias', (_, c) => c.dias_financiamento, { calculada: true }),
    colCalc('fin', 'Total fin.', c => c.custo_financeiro),
    colCalc('total', 'Total R$', c => c.custo_total),
    colCalc('bruto', 'Result. bruto', c => c.resultado_bruto),
    colCalcPct('mBruta', 'Mar. bruta', c => c.margem_bruta),
    colCalc('imposto', 'Imposto', c => c.imposto),
    colCalc('result', 'Result.', c => c.resultado_apos_imposto),
    colCalcPct('mLiq', 'Marg. %', c => c.margem_liquida),
    colCalc('base', 'Base comiss.', c => c.base_comissao),
    colCalcPct('pctCom', 'Com. %', c => c.percentual_comissao),
    colCalc('com', 'Vlr com.', c => c.comissao),
    colCalc('lucro', 'Lucro', c => c.lucro),
    colCalcPct('pctLucro', '% cont.', c => c.lucro_pct),
  ]
}

function classeColuna(c: Coluna) {
  return [c.num && 'dir', c.calculada && 'lc-cab-calc', c.inicioGrupo && 'lc-grupo-ini'].filter(Boolean).join(' ') || undefined
}

type LinhaProps = {
  v: VendaRow
  i: number
  mes: string
  status: Status | undefined
  selecionada: boolean
  calculos: boolean
  fertilizantesId: number | null
  opcoes: Opcoes
  onEditar: (id: string, campos: Partial<CamposEditaveis>) => void
  onSelecionar: (id: string, i: number, shift: boolean) => void
  onDuplicar: (v: VendaRow) => void
  onExcluir: (v: VendaRow) => void
}

const Linha = memo(function Linha({ v, i, mes, status, selecionada, calculos, fertilizantesId, opcoes, onEditar, onSelecionar, onDuplicar, onExcluir }: LinhaProps) {
  const c = useMemo(() => calcularVenda(v), [v])
  const ed = (campos: Partial<CamposEditaveis>) => onEditar(v.id, campos)
  const nav = (col: number) => `${i}:${col}`
  const falta = faltandoNaVenda(v)
  const fatDifere = Math.abs(v.faturamento - v.quantidade * v.preco_unitario) > 0.005
  const ehFert = fertilizantesId != null && v.grupo_id === fertilizantesId
  const cls = ['lc-linha', v.cancelada && 'lc-cancelada', selecionada && 'lc-sel-linha', status === 'erro' && 'lc-erro'].filter(Boolean).join(' ')
  const vazio = <span className="lc-mudo">—</span>
  const calc = (n: number | null, tipo: 'brl' | 'pct' | 'num' = 'brl') => (c.custo_pendente || n == null ? vazio : tipo === 'pct' ? pct(n, 2) : tipo === 'num' ? n.toLocaleString('pt-BR') : num(n))

  return (
    <tr className={cls}>
      <td className="lc-fixa">
        <span className="lc-ctrl">
          <input type="checkbox" checked={selecionada} onChange={() => {}} onClick={e => onSelecionar(v.id, i, e.shiftKey)} aria-label="Selecionar linha" />
          <span
            className={`lc-dot ${status === 'erro' ? 'erro' : status === 'salvando' ? 'salvando' : falta.length ? 'falta' : c.custo_pendente ? 'custo' : 'ok'}`}
            title={status === 'erro' ? 'Não foi possível salvar esta linha' : status === 'salvando' ? 'Salvando...' : falta.length ? `A completar: ${falta.join(', ')}` : c.custo_pendente ? 'Custo pendente' : 'Completa'}
          />
        </span>
      </td>
      <td><DataCel valor={v.data} nav={nav(0)} fora={v.data.slice(0, 7) !== mes} onSalvar={s => s && ed({ data: s })} /></td>
      <td><TextoCel valor={v.dav ?? ''} largura={84} nav={nav(1)} onSalvar={s => ed({ dav: s || null })} /></td>
      <td><TextoCel valor={v.cliente} largura={210} lista="lc-clientes" nav={nav(2)} onSalvar={s => ed({ cliente: s })} /></td>
      <td><TextoCel valor={v.produto} largura={250} lista="lc-produtos" nav={nav(3)} onSalvar={s => ed({ produto: s })} /></td>
      <td><NumInput className="lc-in lc-num" valor={v.quantidade} casas={3} onChange={n => ed({ quantidade: n })} inputProps={{ 'data-nav': nav(4), style: { width: 72 } }} /></td>
      <td><NumInput className="lc-in lc-num" valor={v.preco_unitario} onChange={n => ed({ preco_unitario: n })} inputProps={{ 'data-nav': nav(5), style: { width: 92 } }} /></td>
      <td title={fatDifere ? 'Faturamento informado (difere de qtd × unitário)' : undefined}>
        <NumInput className={`lc-in lc-num lc-forte${fatDifere ? ' lc-informado' : ''}`} valor={v.faturamento} onChange={n => ed({ faturamento: n })} inputProps={{ 'data-nav': nav(6), style: { width: 108 } }} />
      </td>
      <td><SelectCel valor={v.grupo_id} opcoes={opcoes.grupos} largura={112} nav={nav(7)} onSalvar={s => ed({ grupo_id: s == null ? null : Number(s) })} /></td>
      <td><SelectCel valor={v.consultor_id} opcoes={opcoes.consultores} largura={112} nav={nav(8)} onSalvar={s => ed({ consultor_id: s })} /></td>
      <td><SelectCel valor={v.modalidade} opcoes={opcoes.modalidades} largura={104} nav={nav(9)} onSalvar={s => ed({ modalidade: s as VendaRow['modalidade'] })} /></td>
      <td><SelectCel valor={v.tipo} opcoes={opcoes.tipos} largura={68} nav={nav(10)} onSalvar={s => ed({ tipo: s as VendaRow['tipo'] })} /></td>
      <td className="lc-grupo-ini"><NumInput className={`lc-in lc-num${c.custo_pendente && !v.cancelada ? ' lc-falta' : ''}`} valor={v.custo_unitario ?? 0} casas={2} onChange={n => ed({ custo_unitario: n > 0 ? n : null })} inputProps={{ 'data-nav': nav(11), style: { width: 92 } }} /></td>
      <td><NumInput className="lc-in lc-num" valor={v.frete_unitario} onChange={n => ed({ frete_unitario: n })} inputProps={{ 'data-nav': nav(12), style: { width: 72 } }} /></td>
      <td><NumInput className="lc-in lc-num" valor={v.desconto_unitario} onChange={n => ed({ desconto_unitario: n })} inputProps={{ 'data-nav': nav(13), style: { width: 72 } }} /></td>
      <td><DataCel valor={v.data_pagamento_compra} nav={nav(14)} onSalvar={s => ed({ data_pagamento_compra: s })} /></td>
      <td><DataCel valor={v.data_recebimento} nav={nav(15)} onSalvar={s => ed({ data_recebimento: s })} /></td>
      <td><NumInput className="lc-in lc-num" valor={v.aliquota_imposto} pct onChange={n => ed({ aliquota_imposto: n })} inputProps={{ 'data-nav': nav(16), style: { width: 56 } }} /></td>
      <td>{ehFert
        ? <NumInput className="lc-in lc-num" valor={v.toneladas ?? 0} casas={3} onChange={n => ed({ toneladas: n || null })} inputProps={{ 'data-nav': nav(17), style: { width: 72 } }} />
        : vazio}</td>
      {calculos && <>
        <td className="lc-calc lc-grupo-ini">{calc(c.custo_unit_total)}</td>
        <td className="lc-calc">{calc(c.total_compra)}</td>
        <td className="lc-calc">{c.dias_financiamento}</td>
        <td className="lc-calc">{calc(c.custo_financeiro)}</td>
        <td className="lc-calc">{calc(c.custo_total)}</td>
        <td className="lc-calc">{calc(c.resultado_bruto)}</td>
        <td className="lc-calc">{calc(c.margem_bruta, 'pct')}</td>
        <td className="lc-calc">{calc(c.imposto)}</td>
        <td className="lc-calc">{calc(c.resultado_apos_imposto)}</td>
        <td className="lc-calc">{calc(c.margem_liquida, 'pct')}</td>
        <td className="lc-calc">{calc(c.base_comissao)}</td>
        <td className="lc-calc">{calc(c.percentual_comissao, 'pct')}</td>
        <td className="lc-calc">{calc(c.comissao)}</td>
        <td className="lc-calc lc-forte">{calc(c.lucro)}</td>
        <td className="lc-calc">{calc(c.lucro_pct, 'pct')}</td>
      </>}
      <td className="lc-acoes">
        <button type="button" title="Duplicar linha" onClick={() => onDuplicar(v)}><IconCopy /></button>
        <button type="button" title={v.cancelada ? 'Reativar' : 'Cancelar (fica na planilha, não conta)'} onClick={() => ed({ cancelada: !v.cancelada })}><IconBan /></button>
        <Link href={`/admin/metas/vendas/${v.id}`} title="Abrir venda"><IconOpen /></Link>
        <button type="button" title="Excluir linha" className="perigo" onClick={() => onExcluir(v)}><IconTrash /></button>
      </td>
    </tr>
  )
})

function Quadro({ titulo, fatias, total }: { titulo: string; fatias: { id: string; nome: string; valor: number }[]; total: number }) {
  return (
    <div className="lc-quadro">
      <div className="lc-quadro-titulo">{titulo}</div>
      {fatias.map(f => (
        <div key={f.id} className={`lc-quadro-linha${f.id === '—' ? ' lc-quadro-falta' : ''}`}>
          <span>{f.nome}</span><span>{total ? pct(f.valor / total) : '—'}</span><strong>{brl(f.valor)}</strong>
        </div>
      ))}
    </div>
  )
}

export default function Planilha({ dados, mesInicial, filtroInicial }: { dados: DadosCadastro; mesInicial: string; filtroInicial: Filtro }) {
  const supabase = useMemo(() => createClient(), [])
  const [mes, setMes] = useState(mesInicial)
  const [vendas, setVendas] = useState<VendaRow[]>([])
  const [carregadoMes, setCarregadoMes] = useState<string | null>(null)
  const carregando = carregadoMes !== mes
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState<Filtro>(filtroInicial)
  const [busca, setBusca] = useState('')
  const [filtrosColuna, setFiltrosColuna] = useState<Record<string, string>>({})
  const [calculos, setCalculos] = useState(true)
  const [status, setStatus] = useState<Record<string, Status>>({})
  const [selecao, setSelecao] = useState<Set<string>>(new Set())
  const [excluir, setExcluir] = useState<VendaRow[] | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [excluirMes, setExcluirMes] = useState(false)
  const [ok, setOk] = useState('')
  const [lote, setLote] = useState<Partial<Record<'grupo_id' | 'consultor_id' | 'modalidade' | 'tipo' | 'data_pagamento_compra' | 'data_recebimento', string>>>({})
  const [clientes, setClientes] = useState<string[]>([])
  const [produtos, setProdutos] = useState<string[]>([])

  const vendasRef = useRef(vendas)
  useEffect(() => { vendasRef.current = vendas }, [vendas])
  const pendentes = useRef(new Map<string, Partial<CamposEditaveis>>())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ultimaSelecao = useRef<number | null>(null)
  const focarNova = useRef<string | null>(null)

  const fertilizantesId = dados.grupos.find(g => normalizar(g.nome) === 'FERTILIZANTES')?.id ?? null
  const opcoes = useMemo<Opcoes>(() => ({
    grupos: dados.grupos.filter(g => g.ativo).map(g => ({ valor: String(g.id), rotulo: g.nome })),
    consultores: dados.consultores.filter(c => c.ativo).map(c => ({ valor: c.id, rotulo: c.nome })),
    modalidades: MODALIDADES.map(m => ({ valor: m.valor, rotulo: m.rotulo })),
    tipos: TIPOS.map(t => ({ valor: t.valor, rotulo: t.rotulo })),
  }), [dados])
  const unidadeDe = useCallback((consultorId: string | null) => dados.consultores.find(c => c.id === consultorId)?.unidade_id ?? null, [dados])

  // Carrega o mês (por competência, como a planilha)
  useEffect(() => {
    let vivo = true
    buscarTodas<Record<string, unknown>>((de, ate) => supabase.from('vendas').select('*')
      .gte('competencia', `${mes}-01`).lte('competencia', ultimoDia(mes))
      .order('data').order('dav').order('linha_origem').order('created_at').order('id').range(de, ate))
      .then(rs => { if (vivo) { setVendas(rs.map(vendaDoBanco)); setErro('') } })
      .catch(() => vivo && setErro('Não foi possível carregar os lançamentos.'))
      .finally(() => vivo && setCarregadoMes(mes))
    return () => { vivo = false }
  }, [mes, supabase])

  // Sugestões de cliente e produto já usados (autocompletar)
  useEffect(() => {
    buscarTodas<{ cliente: string; produto: string }>((de, ate) => supabase.from('vendas').select('cliente, produto').order('id').range(de, ate))
      .then(rs => {
        setClientes([...new Set(rs.map(r => r.cliente).filter(Boolean))].sort())
        setProdutos([...new Set(rs.map(r => r.produto).filter(Boolean))].sort())
      })
      .catch(() => {})
  }, [supabase])

  // Salva o que mudou, agrupado por linha, depois de uma pausa na digitação
  const salvarPendentes = useCallback(async () => {
    timer.current = null
    const fila = [...pendentes.current.entries()]
    pendentes.current.clear()
    if (!fila.length) return
    setStatus(s => ({ ...s, ...Object.fromEntries(fila.map(([id]) => [id, 'salvando' as Status])) }))
    await Promise.all(fila.map(async ([id, campos]) => {
      const { error } = await supabase.from('vendas').update(campos).eq('id', id)
      setStatus(s => {
        const n = { ...s }
        if (error) n[id] = 'erro'
        else if (!pendentes.current.has(id)) delete n[id]
        return n
      })
      // devolve para a fila: a próxima edição tenta de novo
      if (error) pendentes.current.set(id, { ...campos, ...pendentes.current.get(id) })
    }))
  }, [supabase])

  const agendar = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(salvarPendentes, SALVAR_APOS_MS)
  }, [salvarPendentes])

  // Antes de sair da página, não perder o que ainda não foi salvo
  useEffect(() => {
    const aviso = (e: BeforeUnloadEvent) => { if (pendentes.current.size) { e.preventDefault() } }
    window.addEventListener('beforeunload', aviso)
    return () => { window.removeEventListener('beforeunload', aviso); if (timer.current) { clearTimeout(timer.current); salvarPendentes() } }
  }, [salvarPendentes])

  const editarVarias = useCallback((ids: string[], campos: Partial<CamposEditaveis>) => {
    const porId = new Map(vendasRef.current.map(v => [v.id, v]))
    const patches = new Map<string, Partial<CamposEditaveis>>()
    for (const id of ids) {
      const v = porId.get(id)
      if (!v) continue
      const patch = completarEdicao(v, campos, fertilizantesId)
      patches.set(id, patch)
      pendentes.current.set(id, { ...pendentes.current.get(id), ...patch })
    }
    setVendas(vs => vs.map(v => {
      const p = patches.get(v.id)
      if (!p) return v
      const novo = { ...v, ...p }
      if ('consultor_id' in p) novo.unidade_id = unidadeDe(novo.consultor_id) // o trigger faz o mesmo no banco
      return novo
    }))
    agendar()
  }, [fertilizantesId, unidadeDe, agendar])

  const editar = useCallback((id: string, campos: Partial<CamposEditaveis>) => editarVarias([id], campos), [editarVarias])

  const colunas = useMemo(() => montarColunas(dados, opcoes), [dados, opcoes])
  const colunasVisiveis = useMemo(() => (calculos ? colunas : colunas.filter(c => !c.calculada)), [colunas, calculos])
  // Coluna escondida ("Mostrar cálculos" desligado) não filtra: seria um filtro invisível
  const colunasFiltradas = useMemo(() => colunasVisiveis.filter(c => filtrosColuna[c.id]?.trim()), [colunasVisiveis, filtrosColuna])

  const visiveis = useMemo(() => {
    const b = normalizar(busca)
    return vendas.filter(v => {
      if (filtro === 'completar' && (v.cancelada || !faltandoNaVenda(v).length)) return false
      if (filtro === 'custo' && (v.cancelada || !calcularVenda(v).custo_pendente)) return false
      if (b && !normalizar(`${v.cliente} ${v.produto} ${v.dav ?? ''}`).includes(b)) return false
      if (!colunasFiltradas.length) return true
      const c = calcularVenda(v)
      return colunasFiltradas.every(col => col.casa(v, c, filtrosColuna[col.id]))
    })
  }, [vendas, filtro, busca, colunasFiltradas, filtrosColuna])

  const visiveisRef = useRef(visiveis)
  useEffect(() => { visiveisRef.current = visiveis }, [visiveis])
  const selecionar = useCallback((id: string, i: number, shift: boolean) => {
    setSelecao(sel => {
      const n = new Set(sel)
      const marcar = !sel.has(id)
      if (shift && ultimaSelecao.current != null) {
        const [a, b] = [Math.min(ultimaSelecao.current, i), Math.max(ultimaSelecao.current, i)]
        for (let k = a; k <= b; k++) { const x = visiveisRef.current[k]; if (x) { if (marcar) n.add(x.id); else n.delete(x.id) } }
      } else if (marcar) n.add(id)
      else n.delete(id)
      return n
    })
    ultimaSelecao.current = i
  }, [])

  const novaLinha = useCallback(async (base?: VendaRow) => {
    setErro('')
    const linha: Record<string, unknown> = base
      ? {
          data: base.data, competencia: base.competencia, dav: base.dav, cliente: base.cliente, cliente_codigo: base.cliente_codigo,
          produto: base.produto, produto_codigo: base.produto_codigo, quantidade: base.quantidade, preco_unitario: base.preco_unitario,
          faturamento: base.faturamento, grupo_id: base.grupo_id, consultor_id: base.consultor_id, modalidade: base.modalidade, tipo: base.tipo,
          custo_unitario: base.custo_unitario, frete_unitario: base.frete_unitario, desconto_unitario: base.desconto_unitario,
          data_pagamento_compra: base.data_pagamento_compra, data_recebimento: base.data_recebimento, toneladas: base.toneladas,
          taxa_juros_mensal: base.taxa_juros_mensal, aliquota_imposto: base.aliquota_imposto, fator_comissao: base.fator_comissao,
          vendedor_codigo: base.vendedor_codigo,
        }
      : {
          data: dataPadrao(mes, hojeSP()), competencia: `${mes}-01`, cliente: '', produto: '', quantidade: 0, preco_unitario: 0, faturamento: 0,
          modalidade: 'VERDE_AGRO', taxa_juros_mensal: dados.config.taxa_juros_mensal, aliquota_imposto: dados.config.aliquota_imposto, fator_comissao: dados.config.fator_comissao,
        }
    const { data, error } = await supabase.from('vendas').insert(linha).select('*').single()
    if (error || !data) { setErro(`Não foi possível criar a linha. (${error?.message ?? ''})`); return }
    const nova = vendaDoBanco(data)
    setVendas(vs => {
      if (!base) return [...vs, nova]
      const i = vs.findIndex(v => v.id === base.id)
      return [...vs.slice(0, i + 1), nova, ...vs.slice(i + 1)]
    })
    if (!base) { setFiltro('todas'); setBusca(''); setFiltrosColuna({}); focarNova.current = nova.id }
  }, [mes, dados.config, supabase])
  const duplicar = useCallback((v: VendaRow) => { novaLinha(v) }, [novaLinha])
  const pedirExclusao = useCallback((v: VendaRow) => setExcluir([v]), [])

  // Foca a primeira célula da linha recém-criada
  useEffect(() => {
    if (!focarNova.current) return
    const i = visiveis.findIndex(v => v.id === focarNova.current)
    if (i < 0) return
    focarNova.current = null
    const el = document.querySelector<HTMLElement>(`[data-nav="${i}:2"]`)
    el?.focus()
    el?.scrollIntoView({ block: 'center' })
  }, [visiveis])

  function mudarMes(m: string) {
    setMes(m)
    setSelecao(new Set())
    setLote({})
  }

  // Importação que ficou sem nenhuma venda não tem mais o que mostrar: sai do histórico também
  async function limparImportacoesVazias(ids: string[]) {
    for (const id of new Set(ids)) {
      const { count } = await supabase.from('vendas').select('id', { count: 'exact', head: true }).eq('importacao_id', id)
      if (count === 0) await supabase.from('importacoes').delete().eq('id', id)
    }
  }

  async function confirmarExclusaoMes() {
    setExcluindo(true); setErro(''); setOk('')
    const importacoes = vendas.map(v => v.importacao_id).filter((x): x is string => !!x)
    const { error } = await supabase.from('vendas').delete().gte('competencia', `${mes}-01`).lte('competencia', ultimoDia(mes))
    if (error) { setExcluindo(false); setErro(`Não foi possível excluir os lançamentos do mês. (${error.message})`); return }
    await limparImportacoesVazias(importacoes)
    pendentes.current.clear()
    setOk(`${vendas.length} lançamento(s) de ${competenciaBR(`${mes}-01`)} excluído(s).`)
    setVendas([])
    setSelecao(new Set())
    setExcluindo(false)
    setExcluirMes(false)
  }

  async function confirmarExclusao() {
    if (!excluir) return
    setExcluindo(true)
    const ids = excluir.map(v => v.id)
    const { error } = await supabase.from('vendas').delete().in('id', ids)
    setExcluindo(false)
    if (error) { setErro('Não foi possível excluir.'); return }
    ids.forEach(id => pendentes.current.delete(id))
    await limparImportacoesVazias(excluir.map(v => v.importacao_id).filter((x): x is string => !!x))
    setVendas(vs => vs.filter(v => !ids.includes(v.id)))
    setSelecao(new Set())
    setExcluir(null)
  }

  function aplicarLote() {
    const campos: Partial<CamposEditaveis> = {}
    if (lote.grupo_id) campos.grupo_id = Number(lote.grupo_id)
    if (lote.consultor_id) campos.consultor_id = lote.consultor_id
    if (lote.modalidade) campos.modalidade = lote.modalidade as VendaRow['modalidade']
    if (lote.tipo) campos.tipo = lote.tipo as VendaRow['tipo']
    if (lote.data_pagamento_compra) campos.data_pagamento_compra = lote.data_pagamento_compra
    if (lote.data_recebimento) campos.data_recebimento = lote.data_recebimento
    if (!Object.keys(campos).length) return
    editarVarias([...selecao], campos)
    setLote({})
  }

  // Enter / Shift+Enter: mesma coluna, linha de baixo / de cima (como no Excel)
  function navegar(e: React.KeyboardEvent<HTMLTableSectionElement>) {
    if (e.key !== 'Enter') return
    const alvo = e.target as HTMLElement
    const pos = alvo.dataset.nav
    if (!pos) return
    const [i, col] = pos.split(':').map(Number)
    const prox = document.querySelector<HTMLElement>(`[data-nav="${i + (e.shiftKey ? -1 : 1)}:${col}"]`)
    if (!prox) return
    e.preventDefault()
    alvo.blur()
    prox.focus()
  }

  const resumo = useMemo(() => resumirMes(vendas, dados, fertilizantesId), [vendas, dados, fertilizantesId])
  const totaisVisiveis = useMemo(() => {
    const t = { qtd: 0, fat: 0, compra: 0, fin: 0, custo: 0, imposto: 0, comissao: 0, lucro: 0, ton: 0 }
    for (const v of visiveis) {
      if (v.cancelada) continue
      const c = calcularVenda(v)
      t.qtd += v.quantidade || 0
      t.fat += c.faturamento
      t.ton += v.toneladas ?? 0
      t.compra += c.total_compra ?? 0
      t.fin += c.custo_financeiro ?? 0
      t.custo += c.custo_total ?? 0
      t.imposto += c.imposto ?? 0
      t.comissao += c.comissao ?? 0
      t.lucro += c.lucro ?? 0
    }
    return t
  }, [visiveis])
  const qtdCusto = useMemo(() => vendas.filter(v => !v.cancelada && calcularVenda(v).custo_pendente).length, [vendas])
  const salvando = Object.values(status).includes('salvando')
  const comErro = Object.values(status).filter(s => s === 'erro').length

  async function exportar() {
    const nomeG = (id: number | null) => dados.grupos.find(g => g.id === id)?.nome ?? ''
    const nomeC = (id: string | null) => dados.consultores.find(c => c.id === id)?.nome ?? ''
    const col = (titulo: string, formato?: ColunaExcel['formato']): ColunaExcel => ({ titulo, formato })
    await baixarXlsx(`lancamentos-${mes}`, [{
      nome: `Lançamentos ${competenciaBR(`${mes}-01`)}`,
      colunas: [col('Data', 'data'), col('DAV'), col('Cliente'), col('Produto'), col('Qtd', 'num'), col('Unit R$', 'brl'), col('Faturamento', 'brl'), col('Grupo'), col('Consultor'),
        col('Modalidade'), col('D/C'), col('Custo unit.', 'brl'), col('Frete unit.', 'brl'), col('Desc. unit.', 'brl'), col('Pgto comp.', 'data'), col('Pgto receb.', 'data'),
        col('Custo unit. total', 'brl'), col('Total compra', 'brl'), col('Dias fin.', 'num'), col('Total fin.', 'brl'), col('Total R$', 'brl'), col('Result. bruto', 'brl'),
        col('Mar. bruta', 'pct'), col('Imposto %', 'pct'), col('Imposto', 'brl'), col('Result.', 'brl'), col('Marg. %', 'pct'), col('Base comiss.', 'brl'), col('Com. %', 'pct'),
        col('Vlr com.', 'brl'), col('Lucro', 'brl'), col('% cont.', 'pct'), col('Toneladas', 'num'), col('Situação')],
      linhas: vendas.map(v => {
        const c = calcularVenda(v)
        const falta = faltandoNaVenda(v)
        return [v.data, v.dav, v.cliente, v.produto, v.quantidade, v.preco_unitario, v.faturamento, nomeG(v.grupo_id), nomeC(v.consultor_id),
          v.modalidade ? MODALIDADE_ROTULO[v.modalidade] : '', v.tipo, v.custo_unitario, v.frete_unitario, v.desconto_unitario, v.data_pagamento_compra, v.data_recebimento,
          c.custo_unit_total, c.total_compra, c.dias_financiamento, c.custo_financeiro, c.custo_total, c.resultado_bruto, c.margem_bruta, v.aliquota_imposto, c.imposto,
          c.resultado_apos_imposto, c.margem_liquida, c.base_comissao, c.percentual_comissao, c.comissao, c.lucro, c.lucro_pct, v.toneladas,
          v.cancelada ? 'Cancelada' : falta.length ? `A completar: ${falta.join(', ')}` : c.custo_pendente ? 'Custo pendente' : '']
      }),
      total: ['Total', null, null, null, vendas.reduce((s, v) => s + (v.cancelada ? 0 : v.quantidade || 0), 0), null, resumo.total],
    }])
  }

  return (
    <>
      <style>{`
        .lc-quadros{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem;margin-bottom:1.25rem}
        .lc-quadro{background:var(--superficie);border:1px solid var(--borda-suave);border-radius:var(--raio-lg);box-shadow:var(--sombra);padding:.9rem 1.1rem}
        .lc-quadro-titulo{font-size:.64rem;font-weight:600;color:var(--texto-3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.5rem}
        .lc-quadro-linha{display:grid;grid-template-columns:1fr auto auto;gap:.75rem;font-size:.76rem;padding:.28rem 0;border-bottom:1px solid var(--borda-suave);color:var(--texto-2);font-variant-numeric:tabular-nums}
        .lc-quadro-linha:last-child{border-bottom:none}
        .lc-quadro-linha strong{color:var(--texto);font-weight:600;min-width:110px;text-align:right}
        .lc-quadro-falta{color:#b03a2e}
        .lc-barra{display:flex;gap:.75rem;align-items:center;flex-wrap:wrap;margin-bottom:.75rem}
        .lc-lote{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;background:var(--laranja-suave);border:1px solid var(--laranja-borda);border-radius:var(--raio);padding:.55rem .8rem;margin-bottom:.75rem;font-size:.76rem}
        .lc-wrap{background:var(--superficie);border:1px solid var(--borda-suave);border-radius:var(--raio-lg);box-shadow:var(--sombra);overflow:auto;max-height:72vh}
        .lc-tab{border-collapse:separate;border-spacing:0;font-size:.74rem;min-width:100%}
        .lc-tab thead{position:sticky;top:0;z-index:2}
        .lc-tab thead tr:first-child th{border-bottom:none;padding-bottom:.2rem}
        .lc-tab .lc-filtros th{padding:.15rem .2rem .4rem}
        .lc-filtro{display:block;width:100%;min-width:0;box-sizing:border-box;font-family:var(--fonte);font-size:.68rem;font-weight:400;text-transform:none;letter-spacing:0;color:var(--texto);background:#fff;border:1px solid var(--borda-suave);border-radius:5px;padding:.2rem .3rem;outline:none}
        .lc-filtro:focus{border-color:var(--laranja)}
        .lc-filtro.ativo{border-color:var(--laranja);background:var(--laranja-suave)}
        .lc-limpar{display:flex;align-items:center;justify-content:center;width:100%;height:22px;border:none;border-radius:5px;background:var(--laranja-suave);color:#b03a2e;font-size:.85rem;line-height:1;cursor:pointer}
        .lc-tab th{background:#faf8f5;text-align:left;font-size:.6rem;font-weight:600;color:var(--texto-3);text-transform:uppercase;letter-spacing:.06em;padding:.55rem .35rem;border-bottom:1px solid var(--borda);white-space:nowrap}
        .lc-tab td{padding:.12rem .2rem;border-bottom:1px solid var(--borda-suave);white-space:nowrap;vertical-align:middle;background:var(--superficie)}
        .lc-tab th.dir,.lc-tab td.lc-calc{text-align:right}
        .lc-tab .lc-fixa{position:sticky;left:0;z-index:1}
        .lc-tab th.lc-fixa{z-index:3}
        .lc-tab .lc-grupo-ini{border-left:2px solid var(--borda)}
        .lc-tab th.lc-cab-calc{background:#f3f0ea}
        .lc-tab td.lc-calc{color:var(--texto-2);font-variant-numeric:tabular-nums;padding:.12rem .5rem;background:#fcfbf9}
        .lc-tab tfoot td{position:sticky;bottom:0;background:#faf8f5;font-weight:600;color:var(--texto);border-top:1px solid var(--borda);padding:.5rem .5rem;font-variant-numeric:tabular-nums}
        .lc-in{font-family:var(--fonte);font-size:.74rem;color:var(--texto);background:transparent;border:1px solid transparent;border-radius:6px;padding:.32rem .4rem;outline:none;min-width:0}
        .lc-in:hover{border-color:var(--borda)}
        .lc-in:focus{border-color:var(--laranja);background:#fff;box-shadow:0 0 0 2px rgba(230,126,34,.15)}
        .lc-num{text-align:right;font-variant-numeric:tabular-nums}
        .lc-data{width:118px}
        .lc-sel{cursor:pointer}
        .lc-falta{background:#fff1e3;border-color:#f5d9bd}
        .lc-fora{color:#7a52b3}
        .lc-informado{color:#2c5c9e}
        .lc-forte{font-weight:600}
        .lc-mudo{color:var(--texto-4);padding:0 .4rem}
        .lc-ctrl{display:inline-flex;align-items:center;gap:.4rem;padding:0 .35rem}
        .lc-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0}
        .lc-dot.ok{background:#27ae60}.lc-dot.falta{background:var(--laranja)}.lc-dot.custo{background:#7a52b3}.lc-dot.salvando{background:#8f978f}.lc-dot.erro{background:#e74c3c}
        .lc-linha.lc-cancelada td{opacity:.45}
        .lc-linha.lc-cancelada td .lc-in{text-decoration:line-through}
        .lc-linha.lc-sel-linha td{background:#fffaf4}
        .lc-linha.lc-erro td{background:#fdeeec}
        .lc-acoes{padding-right:.6rem!important}
        .lc-acoes button,.lc-acoes a{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:6px;border:none;background:transparent;color:var(--texto-3);cursor:pointer}
        .lc-acoes button:hover,.lc-acoes a:hover{background:var(--fundo-2);color:var(--texto)}
        .lc-acoes button.perigo:hover{color:#c0392b;background:var(--erro-suave)}
        .lc-legenda{display:flex;gap:1rem;flex-wrap:wrap;font-size:.7rem;color:var(--texto-3);margin-top:.6rem}
        .lc-legenda span{display:inline-flex;align-items:center;gap:.35rem}
      `}</style>

      <div className="ui-page-header">
        <div>
          <div className="ui-title">Lançamentos</div>
          <div className="ui-sub">A planilha do mês: edite direto na célula, salva sozinho. Venda a completar não entra no painel de metas.</div>
        </div>
        <div className="ui-header-actions">
          <button className="ui-btn ui-btn-ghost" onClick={exportar} disabled={!vendas.length}><IconDownload /> Excel</button>
          <Link href={`/admin/metas/importar?mes=${mes}`} className="ui-btn ui-btn-secondary"><IconUpload /> Importar</Link>
          <button className="ui-btn ui-btn-primary" onClick={() => novaLinha()}><IconPlus /> Nova linha</button>
        </div>
      </div>

      {erro && <div className="ui-alert ui-alert-erro">{erro}</div>}
      {ok && <div className="ui-alert ui-alert-ok">{ok}</div>}
      {comErro > 0 && <div className="ui-alert ui-alert-erro">{comErro} linha(s) não foram salvas (marcadas em vermelho). Edite de novo para tentar outra vez, ou recarregue a página.</div>}

      <div className="lc-barra">
        <div className="ui-segmented">
          <button onClick={() => mudarMes(somarMes(mes, -1))} aria-label="Mês anterior"><IconChevron dir="esq" /></button>
          <input type="month" className="ui-input ui-input-sm" style={{ border: 'none', background: 'transparent', padding: '.3rem .4rem' }} value={mes} onChange={e => e.target.value && mudarMes(e.target.value)} />
          <button onClick={() => mudarMes(somarMes(mes, 1))} aria-label="Próximo mês"><IconChevron dir="dir" /></button>
        </div>
        <span className="ui-hint" style={{ margin: 0 }}>{carregando ? 'Carregando...' : salvando ? 'Salvando...' : 'Tudo salvo'}</span>
        {!carregando && vendas.length > 0 && (
          <button className="ui-btn ui-btn-ghost ui-btn-sm" style={{ marginLeft: 'auto', color: '#c0392b' }} onClick={() => setExcluirMes(true)}>
            <IconTrash /> Excluir lançamentos do mês
          </button>
        )}
      </div>

      <div className="ui-kpis">
        <Kpi rotulo={`Faturamento ${competenciaBR(`${mes}-01`)}`} valor={brl(resumo.total)} sub={`${resumo.linhas - resumo.canceladas} linhas${resumo.canceladas ? ` · ${resumo.canceladas} canceladas` : ''}`} />
        <Kpi rotulo="A completar" valor={String(resumo.a_completar.qtd)} sub={resumo.a_completar.qtd ? `${brl(resumo.a_completar.valor)} fora do painel` : 'tudo classificado'} cor={resumo.a_completar.qtd ? 'var(--laranja)' : undefined} />
        <Kpi rotulo="Custo pendente" valor={String(qtdCusto)} sub="fora de lucro e comissão" />
        <Kpi rotulo="Lucro" valor={brl(resumo.resultado.lucro)} sub={`${pct(resumo.resultado.lucro_pct)} · comissão ${brl(resumo.resultado.comissao)}`} />
      </div>

      <div className="lc-quadros">
        <Quadro titulo="Geral (grupo)" fatias={resumo.porGrupo} total={resumo.total} />
        <Quadro titulo="Unidade de negócios" fatias={resumo.porUnidade} total={resumo.total} />
        <div style={{ display: 'grid', gap: '1rem' }}>
          <Quadro titulo="Modalidade" fatias={resumo.porModalidade} total={resumo.total} />
          <Quadro titulo="DIF / CONV" fatias={resumo.porTipo} total={resumo.total} />
          <div className="lc-quadro">
            <div className="lc-quadro-titulo">Fertilizantes - toneladas</div>
            <div className="lc-quadro-linha"><span>Total</span><span /><strong>{resumo.toneladas.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} t</strong></div>
          </div>
        </div>
      </div>

      <div className="lc-barra">
        <div className="ui-segmented">
          {([['todas', 'Todas', vendas.length], ['completar', 'A completar', resumo.a_completar.qtd], ['custo', 'Custo pendente', qtdCusto]] as const).map(([id, rotulo, n]) => (
            <button key={id} className={filtro === id ? 'ativo' : ''} onClick={() => setFiltro(id)}>{rotulo} <span className="ui-count">{n}</span></button>
          ))}
        </div>
        <input className="ui-input ui-input-sm" style={{ width: 240 }} placeholder="Buscar cliente, produto ou DAV" value={busca} onChange={e => setBusca(e.target.value)} />
        <label style={{ display: 'flex', gap: '.4rem', alignItems: 'center', fontSize: '.76rem' }}>
          <input type="checkbox" checked={calculos} onChange={e => setCalculos(e.target.checked)} /> Mostrar cálculos
        </label>
      </div>

      {selecao.size > 0 && (
        <div className="lc-lote">
          <strong>{selecao.size} selecionada(s):</strong>
          <select className="ui-select ui-select-sm" value={lote.consultor_id ?? ''} onChange={e => setLote(l => ({ ...l, consultor_id: e.target.value }))}>
            <option value="">Consultor...</option>
            {opcoes.consultores.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </select>
          <select className="ui-select ui-select-sm" value={lote.grupo_id ?? ''} onChange={e => setLote(l => ({ ...l, grupo_id: e.target.value }))}>
            <option value="">Grupo...</option>
            {opcoes.grupos.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </select>
          <select className="ui-select ui-select-sm" value={lote.modalidade ?? ''} onChange={e => setLote(l => ({ ...l, modalidade: e.target.value }))}>
            <option value="">Modalidade...</option>
            {opcoes.modalidades.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </select>
          <select className="ui-select ui-select-sm" value={lote.tipo ?? ''} onChange={e => setLote(l => ({ ...l, tipo: e.target.value }))}>
            <option value="">D/C...</option>
            {opcoes.tipos.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </select>
          <label title="Pagamento da compra">Pgto comp. <input type="date" className="ui-input ui-input-sm" value={lote.data_pagamento_compra ?? ''} onChange={e => setLote(l => ({ ...l, data_pagamento_compra: e.target.value }))} /></label>
          <label title="Recebimento do cliente">Receb. <input type="date" className="ui-input ui-input-sm" value={lote.data_recebimento ?? ''} onChange={e => setLote(l => ({ ...l, data_recebimento: e.target.value }))} /></label>
          <button className="ui-btn ui-btn-primary ui-btn-sm" onClick={aplicarLote} disabled={!Object.values(lote).some(Boolean)}>Aplicar</button>
          <button className="ui-btn ui-btn-ghost ui-btn-sm" style={{ color: '#c0392b' }} onClick={() => setExcluir(vendas.filter(v => selecao.has(v.id)))}><IconTrash /> Excluir selecionadas</button>
          <button className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => { setSelecao(new Set()); setLote({}) }}>Limpar seleção</button>
        </div>
      )}

      <datalist id="lc-clientes">{clientes.map(c => <option key={c} value={c} />)}</datalist>
      <datalist id="lc-produtos">{produtos.map(p => <option key={p} value={p} />)}</datalist>

      {carregando ? <div className="ui-skeleton" style={{ height: 360 }} /> : (
        <div className="lc-wrap">
          <table className="lc-tab">
            <thead>
              <tr>
                <th className="lc-fixa">
                  <span className="lc-ctrl">
                    <input
                      type="checkbox" aria-label="Selecionar todas"
                      checked={visiveis.length > 0 && visiveis.every(v => selecao.has(v.id))}
                      onChange={e => setSelecao(e.target.checked ? new Set(visiveis.map(v => v.id)) : new Set())}
                    />
                  </span>
                </th>
                {colunasVisiveis.map(c => <th key={c.id} className={classeColuna(c)}>{c.titulo}</th>)}
                <th />
              </tr>
              <tr className="lc-filtros">
                <th className="lc-fixa">
                  {colunasFiltradas.length > 0 && <button type="button" className="lc-limpar" title="Limpar filtros das colunas" aria-label="Limpar filtros das colunas" onClick={() => setFiltrosColuna({})}>×</button>}
                </th>
                {colunasVisiveis.map(c => {
                  const valor = filtrosColuna[c.id] ?? ''
                  const mudar = (s: string) => setFiltrosColuna(f => ({ ...f, [c.id]: s }))
                  const cls = `lc-filtro${valor.trim() ? ' ativo' : ''}`
                  return (
                    <th key={c.id} className={classeColuna(c)}>
                      {c.opcoes ? (
                        <select className={cls} value={valor} onChange={e => mudar(e.target.value)} aria-label={`Filtrar ${c.titulo}`}>
                          <option value="">Todos</option>
                          <option value={SEM_VALOR}>(em branco)</option>
                          {c.opcoes.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
                        </select>
                      ) : (
                        <input
                          className={cls} size={1} value={valor} onChange={e => mudar(e.target.value)} placeholder="Filtrar" aria-label={`Filtrar ${c.titulo}`}
                          title={c.num ? 'Digite um valor ou use >, <, = (ex.: >1000)' : undefined}
                        />
                      )}
                    </th>
                  )
                })}
                <th />
              </tr>
            </thead>
            <tbody onKeyDown={navegar}>
              {visiveis.map((v, i) => (
                <Linha
                  key={v.id} v={v} i={i} mes={mes} status={status[v.id]} selecionada={selecao.has(v.id)} calculos={calculos}
                  fertilizantesId={fertilizantesId} opcoes={opcoes} onEditar={editar} onSelecionar={selecionar} onDuplicar={duplicar} onExcluir={pedirExclusao}
                />
              ))}
              {!visiveis.length && (
                <tr><td colSpan={40} style={{ padding: '2rem', textAlign: 'center', color: 'var(--texto-3)' }}>
                  {vendas.length ? 'Nenhuma linha com esse filtro.' : <>Nenhum lançamento em {competenciaBR(`${mes}-01`)}. Use <strong>Importar</strong> (relatório do ERP ou planilha AD) ou <strong>Nova linha</strong>.</>}
                </td></tr>
              )}
            </tbody>
            {visiveis.length > 0 && (
              <tfoot>
                <tr>
                  <td className="lc-fixa" /><td colSpan={4}>Total {visiveis.length !== vendas.length ? `(${visiveis.length} linhas filtradas)` : ''}</td>
                  <td style={{ textAlign: 'right' }}>{totaisVisiveis.qtd.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</td><td />
                  <td style={{ textAlign: 'right' }}>{num(totaisVisiveis.fat)}</td>
                  <td colSpan={10} /><td style={{ textAlign: 'right' }}>{totaisVisiveis.ton ? totaisVisiveis.ton.toLocaleString('pt-BR', { maximumFractionDigits: 3 }) : ''}</td>
                  {calculos && <>
                    <td /><td style={{ textAlign: 'right' }}>{num(totaisVisiveis.compra)}</td><td /><td style={{ textAlign: 'right' }}>{num(totaisVisiveis.fin)}</td>
                    <td style={{ textAlign: 'right' }}>{num(totaisVisiveis.custo)}</td><td colSpan={2} /><td style={{ textAlign: 'right' }}>{num(totaisVisiveis.imposto)}</td>
                    <td colSpan={4} /><td style={{ textAlign: 'right' }}>{num(totaisVisiveis.comissao)}</td><td style={{ textAlign: 'right' }}>{num(totaisVisiveis.lucro)}</td><td />
                  </>}
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      <div className="lc-legenda">
        <span><i className="lc-dot ok" /> completa</span>
        <span><i className="lc-dot falta" /> a completar (consultor, grupo, modalidade ou D/C)</span>
        <span><i className="lc-dot custo" /> custo pendente</span>
        <span><span className="lc-informado">azul</span> faturamento informado, diferente de qtd × unitário</span>
        <span><span className="lc-fora">roxo</span> data fora do mês (soma neste mês)</span>
        <span>Enter desce na mesma coluna · Shift+clique seleciona um intervalo</span>
        <span>Filtro de número aceita &gt;, &lt; e = (ex.: &gt;1000)</span>
      </div>

      <ConfirmDialog
        aberto={!!excluir}
        titulo={excluir && excluir.length > 1 ? `Excluir ${excluir.length} linhas?` : 'Excluir esta linha?'}
        confirmarTexto="Excluir"
        perigo
        carregando={excluindo}
        onConfirmar={confirmarExclusao}
        onCancelar={() => setExcluir(null)}
      >
        {excluir && excluir.length > 1 ? `${excluir.length} linhas (${brl(excluir.reduce((s, v) => s + v.faturamento, 0))}) saem do sistema.` : 'A venda sai do sistema.'}{' '}
        Para manter o histórico, prefira cancelar (o ícone de bloqueio na linha).
      </ConfirmDialog>

      <ConfirmDialog
        aberto={excluirMes}
        titulo={`Excluir todos os lançamentos de ${competenciaBR(`${mes}-01`)}?`}
        confirmarTexto={`Excluir ${vendas.length} lançamentos`}
        perigo
        carregando={excluindo}
        onConfirmar={confirmarExclusaoMes}
        onCancelar={() => setExcluirMes(false)}
      >
        {vendas.length} linha(s) somando {brl(vendas.reduce((s, v) => s + v.faturamento, 0))} saem do sistema, inclusive custos e ajustes feitos à mão,
        e o mês some do painel de metas. Não dá para desfazer; para refazer, importe a planilha ou o relatório do ERP de novo.
      </ConfirmDialog>
    </>
  )
}

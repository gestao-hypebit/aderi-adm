'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { brl } from '@/lib/cotacao'
import { carregarCadastros, type DadosCadastro } from '@/lib/metas/cadastros'
import { faixaAtingimento, montarPainel, type Faixa, type LinhaMeta, type ValorMensal } from '@/lib/metas/painel'
import { buscarTodas, MESES_CURTOS, vendaDoBanco, type VendaRow } from '@/lib/metas/vendas'
import { Kpi, pct } from './Comum'
import { EvolucaoMensal, ToneladasMes } from './GraficosMetas'

type Visao = 'ano' | 'ciclo' | 'ciclo1'
type EmPedido = { id: string; numero: string; cliente: string; valor: number; unidade_id: number | null; consultor_id: string | null }

// Status reservados (dataviz/palette.md): sempre com rótulo, nunca só a cor
const FAIXA: Record<Faixa, { cor: string; fundo: string; texto: string; rotulo: string }> = {
  vermelho: { cor: '#d03b3b', fundo: '#fbeaea', texto: '#9a2525', rotulo: 'Abaixo' },
  amarelo: { cor: '#fab219', fundo: '#fff4dc', texto: '#7a5200', rotulo: 'Atenção' },
  verde: { cor: '#0ca30c', fundo: '#e5f5e5', texto: '#006300', rotulo: 'Atingida' },
}

const hojeSP = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })

export default function PainelMetasPage() {
  const supabase = createClient()
  const anoAtual = Number(hojeSP().slice(0, 4))
  const [dados, setDados] = useState<DadosCadastro | null>(null)
  const [ano, setAno] = useState(anoAtual)
  const [mesRef, setMesRef] = useState(Number(hojeSP().slice(5, 7)))
  const [unidade, setUnidade] = useState('')
  const [consultor, setConsultor] = useState('')
  const [grupo, setGrupo] = useState('')
  const [visao, setVisao] = useState<Visao>('ano')
  const [porUnidade, setPorUnidade] = useState(false)

  const [metas, setMetas] = useState<ValorMensal[]>([])
  const [anterior, setAnterior] = useState<ValorMensal[]>([])
  const [vendas, setVendas] = useState<VendaRow[]>([])
  const [pedidos, setPedidos] = useState<EmPedido[]>([])
  const [anos, setAnos] = useState<number[]>([anoAtual])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    carregarCadastros(supabase).then(setDados).catch(() => setErro('Não foi possível carregar os cadastros.'))
    supabase.from('metas').select('ano').then(({ data }) => setAnos(xs => [...new Set([...xs, ...(data ?? []).map(d => d.ano as number)])].sort((a, b) => b - a)))
  }, [])

  useEffect(() => {
    let vivo = true
    const num = (xs: Record<string, unknown>[] | null) => (xs ?? []).map(x => ({ unidade_id: Number(x.unidade_id), grupo_id: Number(x.grupo_id), mes: Number(x.mes), valor: Number(x.valor) }))
    const vendasDoAno = (a: number) => buscarTodas<Record<string, unknown>>((de, ate) =>
      supabase.from('vendas').select('*').eq('cancelada', false).gte('competencia', `${a}-01-01`).lte('competencia', `${a}-12-01`).order('id').range(de, ate))
    Promise.all([
      supabase.from('metas').select('unidade_id, grupo_id, mes, valor').eq('ano', ano),
      supabase.from('realizado_historico').select('unidade_id, grupo_id, mes, valor').eq('ano', ano - 1),
      vendasDoAno(ano),
      // "Em pedido": pedido fechado (cotação efetivada) ainda não faturado e sem venda vinculada.
      // TODO(cliente): confirmar se é essa a regra de "pedido fechado".
      supabase.from('cotacoes').select('id, numero, cliente_nome, criado_por, pedido_status, itens:cotacao_itens(quantidade, preco_cliente)')
        .eq('status', 'efetivada').in('pedido_status', ['aguardando', 'parcial']),
      supabase.from('vendas').select('cotacao_id').not('cotacao_id', 'is', null),
    ]).then(async ([m, h, v, c, vinculadas]) => {
      if (!vivo) return
      if (m.error || h.error) { setErro('Não foi possível carregar as metas.'); return }
      setMetas(num(m.data))
      // Ano anterior: totais importados; sem eles, as vendas lançadas daquele ano
      if (h.data?.length) setAnterior(num(h.data))
      else {
        const va = (await vendasDoAno(ano - 1)).map(vendaDoBanco)
        if (vivo) setAnterior(va.map(x => ({ unidade_id: x.unidade_id, grupo_id: x.grupo_id, mes: Number(x.competencia.slice(5, 7)), valor: x.faturamento })))
      }
      setVendas(v.map(vendaDoBanco))
      const usadas = new Set((vinculadas.data ?? []).map(x => x.cotacao_id as string))
      setPedidos((c.data ?? []).filter(p => !usadas.has(p.id)).map(p => ({
        id: p.id, numero: p.numero, cliente: p.cliente_nome ?? '',
        valor: ((p.itens ?? []) as { quantidade: number; preco_cliente: number }[]).reduce((s, i) => s + Number(i.quantidade) * Number(i.preco_cliente), 0),
        unidade_id: null, consultor_id: p.criado_por as string,
      })))
      setErro('')
    }).catch(() => vivo && setErro('Não foi possível carregar o painel.')).finally(() => vivo && setCarregando(false))
    return () => { vivo = false }
  }, [ano])

  const painel = useMemo(() => dados && montarPainel({
    filtro: { ano, mes_ref: mesRef, unidade: unidade ? Number(unidade) : undefined, consultor: consultor || undefined, grupo: grupo ? Number(grupo) : undefined },
    metas, vendas, anterior,
    grupos: dados.grupos.map(g => ({ id: g.id, nome: g.nome })),
    unidades: dados.unidades.map(u => ({ id: u.id, nome: `${u.codigo} · ${u.nome}` })),
    consultores: dados.consultores.map(c => ({ id: c.id, nome: c.nome, unidade_id: c.unidade_id })),
  }), [dados, ano, mesRef, unidade, consultor, grupo, metas, vendas, anterior])

  // Pedido em aberto → consultor (pelo usuário que criou a cotação) → unidade
  const emPedido = useMemo(() => {
    if (!dados) return { valor: 0, qtd: 0 }
    const unidadeFiltro = consultor ? dados.consultores.find(c => c.id === consultor)?.unidade_id : unidade ? Number(unidade) : null
    const lista = pedidos.filter(p => {
      const c = dados.consultores.find(x => x.profile_id === p.consultor_id)
      if (consultor) return c?.id === consultor
      return unidadeFiltro == null || c?.unidade_id === unidadeFiltro
    })
    return { valor: lista.reduce((s, p) => s + p.valor, 0), qtd: lista.length }
  }, [pedidos, dados, unidade, consultor])

  const lim = dados?.config
  const faixa = (p: number | null) => faixaAtingimento(p, lim?.limite_amarelo, lim?.limite_verde)
  const mesNome = MESES_CURTOS[mesRef - 1]
  const mesSeguinte = MESES_CURTOS[Math.min(12, mesRef + 1) - 1]
  const consultoresFiltro = (dados?.consultores ?? []).filter(c => !unidade || c.unidade_id === Number(unidade))

  if (erro) return <div className="ui-alert ui-alert-erro">{erro}</div>

  const t = painel?.total
  const linhasTabela = painel ? (porUnidade ? painel.porUnidade : painel.porGrupo) : []

  return (
    <>
      <style>{`
        .mt-tabela{width:100%;border-collapse:collapse;font-size:.78rem}
        .mt-tabela th{text-align:right;font-size:.62rem;font-weight:600;color:#8f978f;text-transform:uppercase;letter-spacing:.06em;padding:.55rem .6rem;border-bottom:1px solid #f2efea;white-space:nowrap}
        .mt-tabela td{text-align:right;padding:.55rem .6rem;border-bottom:1px solid #f7f5f1;color:#162a1e;font-variant-numeric:tabular-nums;white-space:nowrap}
        .mt-tabela th:first-child,.mt-tabela td:first-child{text-align:left}
        .mt-tabela tfoot td{font-weight:600;border-top:1px solid #eae5de;border-bottom:none}
        .mt-grade{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:1.25rem;margin-bottom:1.25rem}
        .mt-faixa{display:inline-flex;align-items:center;gap:.3rem;font-size:.66rem;font-weight:600;padding:.12rem .45rem;border-radius:999px}
        .mt-barra{height:8px;border-radius:4px;background:#f2efea;overflow:hidden;display:flex;gap:2px}
        .mt-barra > span{display:block;height:100%;border-radius:4px}
        .mt-rank{display:grid;grid-template-columns:minmax(110px,1.3fr) 2fr auto;gap:.75rem;align-items:center;padding:.5rem 0;border-bottom:1px solid #f7f5f1;font-size:.78rem}
        .mt-filtros{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:0 .75rem}
      `}</style>

      <div className="ui-page-header">
        <div>
          <div className="ui-title">Metas comerciais</div>
          <div className="ui-sub">Realizado = vendas faturadas por mês de referência, de janeiro até {mesNome}/{ano}.</div>
        </div>
        <div className="ui-header-actions">
          <Link href="/admin/metas/vendas" className="ui-btn ui-btn-secondary">Vendas</Link>
        </div>
      </div>

      <div className="ui-card ui-card-pad" style={{ marginBottom: '1.25rem', paddingBottom: '.25rem' }}>
        <div className="mt-filtros">
          <div className="ui-field">
            <label className="ui-label">Ano</label>
            <select className="ui-select ui-select-sm" value={ano} onChange={e => { setCarregando(true); setAno(Number(e.target.value)) }}>
              {anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="ui-field">
            <label className="ui-label">Mês de referência</label>
            <select className="ui-select ui-select-sm" value={mesRef} onChange={e => setMesRef(Number(e.target.value))}>
              {MESES_CURTOS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div className="ui-field">
            <label className="ui-label">Unidade</label>
            <select className="ui-select ui-select-sm" value={unidade} onChange={e => { setUnidade(e.target.value); setConsultor('') }}>
              <option value="">Todas</option>
              {dados?.unidades.map(u => <option key={u.id} value={u.id}>{u.codigo} · {u.nome}</option>)}
            </select>
          </div>
          <div className="ui-field">
            <label className="ui-label">Consultor</label>
            <select className="ui-select ui-select-sm" value={consultor} onChange={e => setConsultor(e.target.value)}>
              <option value="">Todos</option>
              {consultoresFiltro.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="ui-field">
            <label className="ui-label">Grupo</label>
            <select className="ui-select ui-select-sm" value={grupo} onChange={e => setGrupo(e.target.value)}>
              <option value="">Todos</option>
              {dados?.grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          </div>
        </div>
        {consultor && <div className="ui-hint" style={{ marginBottom: '.75rem' }}>A meta é da unidade do consultor; o realizado é só o dele.</div>}
      </div>

      {carregando || !painel || !t ? <div className="ui-skeleton" style={{ height: 420 }} /> : (
        <>
          <div className="ui-kpis">
            <Kpi rotulo={`Meta ${ano}`} valor={brl(t.meta_ano)} sub={`ciclo jan–${mesNome}: ${brl(t.meta_ciclo)}`} />
            <Kpi rotulo={`Realizado até ${mesNome}`} valor={brl(t.realizado)} sub={`${pct(t.pct)} da meta do ano`} cor={FAIXA[faixa(t.pct) ?? 'vermelho'].cor} />
            <Kpi rotulo="Desvio do ciclo" valor={brl(t.desvio_ciclo)} sub={`${pct(t.pct_desvio_ciclo)} sobre a meta jan–${mesNome}`} />
            <Kpi rotulo={`Para fechar jan–${mesSeguinte}`} valor={brl(t.precisa_proximo_mes)} sub={`meta acumulada ${brl(t.meta_ciclo_mais_1)}`} />
            <Kpi rotulo="Em pedido" valor={brl(emPedido.valor)} sub={`${emPedido.qtd} pedido(s) fechado(s), fora do realizado`} />
          </div>

          <div className="ui-card" style={{ marginBottom: '1.25rem' }}>
            <div className="ui-card-header" style={{ flexWrap: 'wrap' }}>
              <div className="ui-card-title">Meta × realizado</div>
              <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                <Segmentado valor={visao} onChange={setVisao} opcoes={[['ano', `Ano ${ano}`], ['ciclo', `Ciclo jan–${mesNome}`], ['ciclo1', `Ciclo + 1 (jan–${mesSeguinte})`]]} />
                <Segmentado valor={porUnidade ? 'u' : 'g'} onChange={v => setPorUnidade(v === 'u')} opcoes={[['g', 'Por grupo'], ['u', 'Por unidade']]} />
              </div>
            </div>
            <div style={{ overflowX: 'auto', padding: '0 .8rem .4rem' }}>
              <TabelaMeta linhas={linhasTabela} total={t} visao={visao} faixa={faixa} rotulo={porUnidade ? 'Unidade' : 'Grupo'} />
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}><EvolucaoMensal mensal={painel.mensal} ano={ano} mesRef={mesRef} /></div>

          <div className="mt-grade">
            <Divisao titulo="Mix DIF × CONV" partes={[['DIF (diferenciado)', painel.mix.DIF, '#1a7f4b'], ['CONV (convencional)', painel.mix.CONV, '#E67E22']]} />
            <Divisao titulo="Verde Agro × Venda Direta" partes={[['Verde Agro', painel.modalidade.VERDE_AGRO, '#1a7f4b'], ['Venda Direta', painel.modalidade.VENDA_DIRETA, '#E67E22']]} />
          </div>

          <div className="mt-grade">
            <ToneladasMes toneladas={painel.toneladas} />
            <div className="ui-card ui-card-pad">
              <div className="ui-card-title" style={{ marginBottom: '.6rem' }}>Ranking por % da meta do ano</div>
              {painel.ranking.map((r, i) => {
                const fx = faixa(r.pct)
                return (
                  <div key={r.id} className="mt-rank">
                    <span><strong>{i + 1}.</strong> {r.nome}</span>
                    <div className="mt-barra"><span style={{ width: `${Math.min(100, (r.pct ?? 0) * 100)}%`, background: fx ? FAIXA[fx].cor : '#ccc' }} /></div>
                    <span>{pct(r.pct)} <SeloFaixa faixa={fx} /></span>
                  </div>
                )
              })}
              {painel.consultores.length > 0 && (
                <>
                  <div className="ui-section-label" style={{ margin: '1rem 0 .4rem' }}>Consultores</div>
                  {painel.consultores.map(c => (
                    <div key={c.id} className="mt-rank" style={{ gridTemplateColumns: '1fr auto auto' }}>
                      <span>{c.nome}</span>
                      <span>{brl(c.realizado)}</span>
                      <span className="ui-cel-mudo" title="sobre a meta da unidade">{pct(c.pct_meta_unidade)} da unidade</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          <div className="mt-grade">
            <TabelaResultado titulo="Resultado por consultor" linhas={painel.resultadoPorConsultor} />
            <TabelaResultado titulo="Resultado por grupo" linhas={painel.resultadoPorGrupo} />
          </div>
        </>
      )}
    </>
  )
}

function Segmentado<T extends string>({ valor, onChange, opcoes }: { valor: T; onChange: (v: T) => void; opcoes: [T, string][] }) {
  return (
    <div className="ui-segmented">
      {opcoes.map(([v, r]) => <button key={v} type="button" className={v === valor ? 'ativo' : ''} onClick={() => onChange(v)}>{r}</button>)}
    </div>
  )
}

function SeloFaixa({ faixa }: { faixa: Faixa | null }) {
  if (!faixa) return null
  const f = FAIXA[faixa]
  return <span className="mt-faixa" style={{ background: f.fundo, color: f.texto }}><span className="mt-dot" style={{ background: f.cor, width: 6, height: 6, borderRadius: '50%', display: 'inline-block' }} />{f.rotulo}</span>
}

function TabelaMeta({ linhas, total, visao, faixa, rotulo }: { linhas: LinhaMeta[]; total: LinhaMeta; visao: Visao; faixa: (p: number | null) => Faixa | null; rotulo: string }) {
  const cols: { titulo: string; valor: (l: LinhaMeta) => React.ReactNode }[] =
    visao === 'ano' ? [
      { titulo: 'Meta', valor: l => brl(l.meta_ano) },
      { titulo: 'Realizado', valor: l => brl(l.realizado) },
      { titulo: '% realizado', valor: l => <>{pct(l.pct)} <SeloFaixa faixa={faixa(l.pct)} /></> },
      { titulo: 'Falta', valor: l => brl(l.falta) },
      { titulo: '% falta', valor: l => pct(l.pct_falta) },
    ] : visao === 'ciclo' ? [
      { titulo: 'Meta do ciclo', valor: l => brl(l.meta_ciclo) },
      { titulo: 'Realizado', valor: l => brl(l.realizado) },
      { titulo: 'Desvio', valor: l => brl(l.desvio_ciclo) },
      { titulo: '% desvio', valor: l => pct(l.pct_desvio_ciclo) },
      { titulo: 'Atingimento', valor: l => { const p = l.meta_ciclo ? l.realizado / l.meta_ciclo : null; return <>{pct(p)} <SeloFaixa faixa={faixa(p)} /></> } },
    ] : [
      { titulo: 'Meta ciclo + 1', valor: l => brl(l.meta_ciclo_mais_1) },
      { titulo: 'Realizado', valor: l => brl(l.realizado) },
      { titulo: 'Desvio', valor: l => brl(l.desvio_ciclo_mais_1) },
      { titulo: '% desvio', valor: l => pct(l.pct_desvio_ciclo_mais_1) },
      { titulo: 'Precisa vender', valor: l => brl(l.precisa_proximo_mes) },
    ]
  return (
    <table className="mt-tabela">
      <thead><tr><th>{rotulo}</th>{cols.map(c => <th key={c.titulo}>{c.titulo}</th>)}</tr></thead>
      <tbody>{linhas.map(l => <tr key={l.id}><td>{l.nome}</td>{cols.map(c => <td key={c.titulo}>{c.valor(l)}</td>)}</tr>)}</tbody>
      <tfoot><tr><td>Total</td>{cols.map(c => <td key={c.titulo}>{c.valor(total)}</td>)}</tr></tfoot>
    </table>
  )
}

function Divisao({ titulo, partes }: { titulo: string; partes: [string, number, string][] }) {
  const total = partes.reduce((s, p) => s + p[1], 0)
  return (
    <div className="ui-card ui-card-pad">
      <div className="ui-card-title" style={{ marginBottom: '.8rem' }}>{titulo}</div>
      <div className="mt-barra" style={{ height: 12, marginBottom: '.9rem' }}>
        {partes.map(([r, v, cor]) => v > 0 && <span key={r} style={{ width: `${(v / (total || 1)) * 100}%`, background: cor }} title={`${r}: ${brl(v)}`} />)}
      </div>
      <table className="mt-tabela">
        <tbody>
          {partes.map(([r, v, cor]) => (
            <tr key={r}><td><span className="mt-dot" style={{ background: cor, width: 8, height: 8, borderRadius: '50%', display: 'inline-block', marginRight: 6 }} />{r}</td><td>{brl(v)}</td><td>{pct(total ? v / total : null)}</td></tr>
          ))}
        </tbody>
        <tfoot><tr><td>Total</td><td>{brl(total)}</td><td /></tr></tfoot>
      </table>
    </div>
  )
}

function TabelaResultado({ titulo, linhas }: { titulo: string; linhas: { id: string | number; nome: string; resumo: import('@/lib/metas/calculo').ResumoVendas }[] }) {
  return (
    <div className="ui-card ui-card-pad" style={{ overflowX: 'auto' }}>
      <div className="ui-card-title" style={{ marginBottom: '.2rem' }}>{titulo}</div>
      <div className="ui-hint" style={{ marginBottom: '.6rem' }}>Só vendas com custo informado entram em lucro, comissão e margem.</div>
      <table className="mt-tabela">
        <thead><tr><th>Nome</th><th>Com custo</th><th>Lucro</th><th>Lucro %</th><th>Comissão</th><th>Margem líq.</th><th>Pendentes</th></tr></thead>
        <tbody>
          {linhas.map(l => (
            <tr key={l.id}>
              <td>{l.nome}</td><td>{brl(l.resumo.faturamento_com_custo)}</td><td>{brl(l.resumo.lucro)}</td><td>{pct(l.resumo.lucro_pct)}</td>
              <td>{brl(l.resumo.comissao)}</td><td>{pct(l.resumo.margem_liquida)}</td><td>{l.resumo.qtd_custo_pendente}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

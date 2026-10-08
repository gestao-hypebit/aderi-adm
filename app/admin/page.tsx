import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { defaultFiltros, descreverPeriodo, ehDesdeInicio, hojeISO, somarDias } from '@/lib/dateUtils'
import { calcularTotais, itemDoBanco, parametrosDoBanco, STATUS_COTACAO } from '@/lib/cotacao'
import AdminFiltersBar from './AdminFiltersBar'
import AdminCharts, { type DadosColaborador } from './AdminCharts'
import EquipeTabela from './EquipeTabela'

type SearchParams = Promise<{ inicio?: string; fim?: string; func?: string }>
type Rel<T> = T | T[] | null
type VisitaLista = { id: string; data_visita: string; hora_visita?: string | null; status: string; cliente: Rel<{ nome: string; nome_fazenda: string | null }>; funcionario: Rel<{ nome_completo: string | null }> }

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const STATUS_LABEL: Record<string, string> = { agendada: 'Agendada', realizada: 'Realizada', cancelada: 'Cancelada', atrasada: 'Atrasada' }

const um = <T,>(r: Rel<T>) => (Array.isArray(r) ? r[0] ?? null : r)
const moeda = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
function compacto(n: number) {
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (Math.abs(n) >= 10_000) return `R$ ${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`
  return moeda(n)
}

function IconPlus() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function IconCalendar() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function IconCheck() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
}
function IconUsers() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}
function IconRoute() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/></svg>
}
function IconDoc() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>
}
function IconAlert() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
}
function IconSun() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
}
function IconArrow() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
}

// variação contra o período anterior de mesma duração (subir é bom nos indicadores usados)
function Delta({ atual, anterior, total }: { atual: number; anterior: number; total?: boolean }) {
  if (total) return <span className="pn-delta neutro">total acumulado</span>
  if (!anterior && !atual) return <span className="pn-delta neutro">sem dados no período anterior</span>
  if (!anterior) return <span className="pn-delta sobe">novo no período</span>
  const v = Math.round(((atual - anterior) / anterior) * 100)
  if (v === 0) return <span className="pn-delta neutro">igual ao período anterior</span>
  return <span className={`pn-delta ${v > 0 ? 'sobe' : 'desce'}`}>{v > 0 ? '▲' : '▼'} {Math.abs(v)}% vs. período anterior</span>
}

export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const defaults = defaultFiltros()
  const inicio = params.inicio ?? defaults.dataInicio
  const fim = params.fim ?? defaults.dataFim
  const func = params.func ?? ''

  // período anterior com a mesma quantidade de dias
  // ("Desde o início" não tem período anterior: os indicadores mostram o total acumulado)
  const tudo = ehDesdeInicio(inicio, fim)
  const dias = Math.round((Date.parse(fim) - Date.parse(inicio)) / 86400000) + 1
  const antFim = tudo ? '1999-12-31' : somarDias(inicio, -1)
  const antIni = tudo ? '1999-12-31' : somarDias(antFim, -(dias - 1))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const hoje = hojeISO()
  const [anoHoje, mesHoje] = hoje.split('-').map(Number)
  const chaveMes = (i: number) => { const d = new Date(Date.UTC(anoHoje, mesHoje - 1 - i, 1)); return d.toISOString().slice(0, 7) }
  const seisAtras = chaveMes(5) + '-01'

  // match({}) não filtra nada: sem consultor selecionado, traz a equipe toda
  const porFunc = func ? { funcionario_id: func } : {}
  const porAutor = func ? { criado_por: func } : {}
  const camposVisita = 'id, data_visita, hora_visita, status, cliente:clientes(nome, nome_fazenda), funcionario:profiles(nome_completo)'

  const [
    { data: meuPerfil },
    { data: colaboradores },
    { data: clientes },
    { data: visitas },
    { data: visitasAnt },
    { data: kms },
    { data: abastecimentos },
    { data: historico },
    { data: hojeVisitas },
    { data: proximas },
    { data: atrasadas, count: totalAtrasadas },
    { data: realizadasPorCliente },
    { data: cotacoes },
    { data: cotacoesAnt },
    { data: aprovacoes },
  ] = await Promise.all([
    supabase.from('profiles').select('nome_completo').eq('id', user?.id ?? '').single(),
    supabase.from('profiles').select('id, nome_completo').eq('role', 'colaborador').eq('ativo', true).order('nome_completo'),
    supabase.from('clientes').select('id, nome').order('nome'),
    supabase.from('visitas').select('status, funcionario_id, cliente_id').gte('data_visita', inicio).lte('data_visita', fim).match(porFunc),
    supabase.from('visitas').select('status, cliente_id').gte('data_visita', antIni).lte('data_visita', antFim).match(porFunc),
    supabase.from('km_diario').select('funcionario_id, km_inicial, km_final').gte('data', inicio).lte('data', fim).match(porFunc),
    supabase.from('abastecimentos').select('funcionario_id, litros, valor_total').gte('data', inicio).lte('data', fim).match(porFunc),
    supabase.from('visitas').select('data_visita, status').gte('data_visita', seisAtras).match(porFunc),
    supabase.from('visitas').select(camposVisita).eq('data_visita', hoje).order('hora_visita', { nullsFirst: false }).match(porFunc),
    supabase.from('visitas').select(camposVisita).eq('status', 'agendada').gt('data_visita', hoje).order('data_visita').limit(5).match(porFunc),
    supabase.from('visitas').select(camposVisita, { count: 'exact' }).eq('status', 'agendada').lt('data_visita', hoje).order('data_visita').limit(3).match(porFunc),
    supabase.from('visitas').select('cliente_id, data_visita').eq('status', 'realizada').order('data_visita', { ascending: false }),
    supabase.from('cotacoes').select('status, criado_por, ptax, juros_mes, aliquota_icms, aliquota_ir, itens:cotacao_itens(*)').gte('created_at', inicio).lte('created_at', fim + 'T23:59:59').match(porAutor),
    supabase.from('cotacoes').select('status, ptax, juros_mes, aliquota_icms, aliquota_ir, itens:cotacao_itens(*)').eq('status', 'efetivada').gte('created_at', antIni).lte('created_at', antFim + 'T23:59:59').match(porAutor),
    supabase.from('cotacoes').select('id, numero, cliente_nome, autor:profiles!cotacoes_criado_por_fkey(nome_completo)').eq('aprovacao_status', 'pendente').order('updated_at', { ascending: false }).limit(5).match(porAutor),
  ])

  const colab = colaboradores ?? []
  const clientesLista = clientes ?? []

  // ── métricas por consultor ──
  const porColab = new Map<string, DadosColaborador & { clientes: Set<string>; vendido: number }>()
  colab.forEach(c => porColab.set(c.id, { id: c.id, nome: c.nome_completo ?? 'Sem nome', realizadas: 0, agendadas: 0, canceladas: 0, km: 0, litros: 0, gasto: 0, clientes: new Set(), vendido: 0 }))
  ;(visitas ?? []).forEach(v => {
    const m = porColab.get(v.funcionario_id); if (!m) return
    if (v.status === 'realizada') { m.realizadas++; m.clientes.add(v.cliente_id) }
    else if (v.status === 'agendada') m.agendadas++
    else if (v.status === 'cancelada') m.canceladas++
  })
  ;(kms ?? []).forEach(k => {
    const m = porColab.get(k.funcionario_id)
    if (m && k.km_inicial != null && k.km_final != null) m.km += Number(k.km_final) - Number(k.km_inicial)
  })
  ;(abastecimentos ?? []).forEach(a => {
    const m = porColab.get(a.funcionario_id); if (!m) return
    m.litros += Number(a.litros) || 0
    m.gasto += Number(a.valor_total) || 0
  })

  // ── cotações ──
  const valorCot = (c: Record<string, unknown>) =>
    calcularTotais(((c.itens ?? []) as Record<string, unknown>[]).map(itemDoBanco), parametrosDoBanco(c)).venda
  const funil = Object.keys(STATUS_COTACAO).map(s => ({ status: s, qtd: 0, valor: 0 }))
  ;(cotacoes ?? []).forEach(c => {
    const v = valorCot(c)
    const f = funil.find(x => x.status === c.status); if (f) { f.qtd++; f.valor += v }
    if (c.status === 'efetivada') { const m = porColab.get(c.criado_por); if (m) m.vendido += v }
  })
  const efetivado = funil.find(f => f.status === 'efetivada')!
  const decididas = efetivado.qtd + (funil.find(f => f.status === 'perdida')?.qtd ?? 0)
  const conversao = decididas ? Math.round((efetivado.qtd / decididas) * 100) : null
  const efetivadoAnt = (cotacoesAnt ?? []).reduce((s, c) => s + valorCot(c), 0)
  const maiorFunil = Math.max(...funil.map(f => f.valor), 1)
  const totalCotacoes = funil.reduce((s, f) => s + f.qtd, 0)

  // ── indicadores ──
  const equipe = [...porColab.values()]
  const lista = visitas ?? []
  const realizadas = lista.filter(v => v.status === 'realizada').length
  const agendadas = lista.filter(v => v.status === 'agendada').length
  const realizadasAnt = (visitasAnt ?? []).filter(v => v.status === 'realizada').length
  const clientesAtendidos = new Set(lista.filter(v => v.status === 'realizada').map(v => v.cliente_id)).size
  const clientesAnt = new Set((visitasAnt ?? []).filter(v => v.status === 'realizada').map(v => v.cliente_id)).size
  const totalKm = (kms ?? []).reduce((s, k) => s + (k.km_inicial != null && k.km_final != null ? Number(k.km_final) - Number(k.km_inicial) : 0), 0)
  const totalGasto = equipe.reduce((s, c) => s + c.gasto, 0)
  const taxa = realizadas + agendadas > 0 ? Math.round((realizadas / (realizadas + agendadas)) * 100) : 0

  // ── atenção ──
  const limite60 = somarDias(hoje, -60)
  const ultimaPorCliente = new Map<string, string>()
  ;(realizadasPorCliente ?? []).forEach(v => { if (!ultimaPorCliente.has(v.cliente_id)) ultimaPorCliente.set(v.cliente_id, v.data_visita) })
  const esquecidos = clientesLista
    .map(c => ({ ...c, ultima: ultimaPorCliente.get(c.id) ?? null }))
    .filter(c => !c.ultima || c.ultima < limite60)
    .sort((a, b) => (a.ultima ?? '').localeCompare(b.ultima ?? ''))
  const parados = equipe.filter(c => c.agendadas > 0 && c.realizadas === 0)
  const pendentesAprovacao = (aprovacoes ?? []) as { id: string; numero: string; cliente_nome: string | null; autor: Rel<{ nome_completo: string | null }> }[]
  const qtdAtencao = (totalAtrasadas ?? 0) + esquecidos.length + parados.length + pendentesAprovacao.length

  // ── histórico 6 meses ──
  const meses: Record<string, { realizadas: number; agendadas: number }> = {}
  for (let i = 5; i >= 0; i--) meses[chaveMes(i)] = { realizadas: 0, agendadas: 0 }
  ;(historico ?? []).forEach(v => {
    const m = meses[v.data_visita.slice(0, 7)]
    if (m && v.status === 'realizada') m.realizadas++
    if (m && v.status === 'agendada') m.agendadas++
  })
  const visitasPorMes = Object.entries(meses).map(([k, v]) => ({ mes: MESES_ABREV[parseInt(k.split('-')[1]) - 1], ...v }))

  // ── textos ──
  const horaBR = Number(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }))
  const saudacao = horaBR < 12 ? 'Bom dia' : horaBR < 18 ? 'Boa tarde' : 'Boa noite'
  const primeiroNome = (meuPerfil?.nome_completo ?? '').split(' ')[0]
  const fmtCurta = (d: string) => new Date(d + 'T12:00').toLocaleDateString('pt-BR')
  const nomePeriodo = descreverPeriodo(inicio, fim)
  const colabFiltrado = func ? colab.find(c => c.id === func) : null
  const hojeLista = (hojeVisitas ?? []) as VisitaLista[]
  const hojeFeitas = hojeLista.filter(v => v.status === 'realizada').length
  const dataHoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' })
  const ranking = [...equipe].sort((a, b) => b.realizadas - a.realizadas || b.vendido - a.vendido)
  const atrasadasLista = (atrasadas ?? []) as VisitaLista[]

  return (
    <>
      <style>{`
        .pn-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1rem;margin-bottom:1.2rem}
        .pn-kpi{padding:1.1rem 1.15rem;display:flex;flex-direction:column;gap:.15rem;min-width:0;text-decoration:none}
        .pn-kpi-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:.55rem;min-height:32px}
        .pn-kpi-l{font-size:.74rem;font-weight:500;color:#5b6660}
        .pn-kpi-ico{width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center}
        .pn-kpi-n{font-size:1.65rem;font-weight:600;color:#162a1e;line-height:1.15;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .pn-kpi-n small{font-size:.8rem;font-weight:500;color:#8f978f;margin-left:.3rem;letter-spacing:0}
        .pn-kpi-s{font-size:.7rem;color:#8f978f;margin-top:.3rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .pn-delta{font-size:.68rem;font-weight:600;margin-top:.35rem}
        .pn-delta.sobe{color:#1e8a4c}.pn-delta.desce{color:#c0392b}.pn-delta.neutro{color:#b8bdb6;font-weight:500}
        .pn-meter{height:6px;border-radius:999px;background:#eaf2ec;overflow:hidden;margin-top:.55rem}
        .pn-meter span{display:block;height:100%;border-radius:999px;background:#1a7f4b}

        .pn-grid{display:grid;gap:1.1rem;margin-bottom:1.2rem}
        .pn-g-main{grid-template-columns:minmax(0,1.65fr) minmax(0,1fr)}
        .pn-g-3{grid-template-columns:repeat(3,minmax(0,1fr))}
        .pn-card{display:flex;flex-direction:column;min-width:0}
        .pn-sec-h{display:flex;align-items:center;gap:.6rem;margin:.4rem 0 .8rem}
        .pn-card-h{display:flex;align-items:center;gap:.6rem;padding:1.05rem 1.25rem .8rem}
        .pn-card-t{font-size:.9rem;font-weight:600;color:#162a1e;display:flex;align-items:center;gap:.5rem}
        .pn-card-t svg{color:#E67E22}
        .pn-card-sub{font-size:.7rem;color:#8f978f}
        .pn-card-link{margin-left:auto;font-size:.72rem;font-weight:600;color:#8f978f;text-decoration:none;display:inline-flex;align-items:center;gap:.3rem;white-space:nowrap}
        .pn-card-link:hover{color:#E67E22}
        .pn-vazio{padding:1.6rem 1.25rem;text-align:center;font-size:.76rem;color:#8f978f;line-height:1.6;margin:auto 0}
        .pn-vazio b{display:block;color:#5b6660;font-size:.82rem;font-weight:600}

        .pn-hoje-prog{display:flex;align-items:center;gap:.7rem;padding:0 1.25rem .8rem;font-size:.7rem;color:#8f978f}
        .pn-hoje-prog .pn-meter{flex:1;margin:0}
        .pn-vis{display:flex;align-items:center;gap:.8rem;padding:.65rem 1.25rem;border-top:1px solid #f4f1ec;text-decoration:none;transition:background .15s}
        .pn-vis:hover{background:#fcfaf7}
        .pn-hora{width:48px;flex-shrink:0;font-size:.74rem;font-weight:600;color:#162a1e;font-variant-numeric:tabular-nums}
        .pn-hora small{display:block;font-size:.6rem;font-weight:500;color:#8f978f}
        .pn-vis-main{flex:1;min-width:0}
        .pn-vis-t{font-size:.8rem;font-weight:600;color:#162a1e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .pn-vis-m{font-size:.68rem;color:#8f978f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:.1rem}
        .pn-vis-m em{font-style:normal;color:#E67E22;font-weight:600}

        .pn-at-sec{padding:.75rem 1.25rem;border-top:1px solid #f4f1ec}
        .pn-at-h{display:flex;align-items:center;gap:.5rem;font-size:.76rem;font-weight:600;color:#162a1e;margin-bottom:.35rem}
        .pn-at-n{min-width:22px;height:20px;border-radius:999px;font-size:.66rem;font-weight:600;display:inline-flex;align-items:center;justify-content:center;padding:0 .4rem}
        .pn-at-n.r{background:#fdeeec;color:#c0392b}.pn-at-n.a{background:#fdf3e9;color:#c0651a}.pn-at-n.z{background:#f2efea;color:#8f978f}
        .pn-at-h a{margin-left:auto;font-size:.68rem;color:#8f978f;text-decoration:none;font-weight:600}
        .pn-at-h a:hover{color:#E67E22}
        .pn-at-li{display:flex;justify-content:space-between;gap:.6rem;font-size:.72rem;padding:.22rem 0 .22rem 1.85rem;text-decoration:none}
        .pn-at-li span:first-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500;color:#162a1e}
        .pn-at-li span:last-child{color:#8f978f;white-space:nowrap}
        a.pn-at-li:hover span:first-child{color:#E67E22}
        .pn-ok{font-size:.7rem;color:#1e8a4c;padding-left:1.85rem}

        .pn-funil{padding:.2rem 1.25rem 1rem;display:flex;flex-direction:column;gap:.8rem}
        .pn-funil-l{display:flex;justify-content:space-between;align-items:baseline;font-size:.76rem;margin-bottom:.35rem}
        .pn-funil-l span{color:#5b6660;font-weight:500;display:inline-flex;align-items:center;gap:.45rem}
        .pn-funil-l b{font-weight:600;color:#162a1e;font-variant-numeric:tabular-nums}
        .pn-funil-l small{color:#8f978f;font-weight:500}
        .pn-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0}
        .pn-funil-bar{height:8px;border-radius:999px;background:#f4f1ec;overflow:hidden}
        .pn-funil-bar span{display:block;height:100%;border-radius:999px;min-width:4px}
        .pn-conv{display:flex;justify-content:space-between;align-items:center;margin:auto 1.25rem 1.1rem;padding:.7rem .85rem;background:#faf8f5;border-radius:10px;font-size:.72rem;color:#5b6660}
        .pn-conv b{font-size:1rem;color:#162a1e}


        @media(max-width:1280px){.pn-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.pn-g-3{grid-template-columns:1fr 1fr}.pn-g-3>:last-child{grid-column:1/-1}}
        @media(max-width:1000px){.pn-g-main{grid-template-columns:1fr}}
        @media(max-width:700px){.pn-kpis{grid-template-columns:1fr 1fr}.pn-g-3{grid-template-columns:1fr}.pn-kpi-n{font-size:1.35rem}}
      `}</style>

      <div className="ui-page-header">
        <div>
          <div className="ui-eyebrow" style={{ textTransform: 'none', letterSpacing: 0 }}>{dataHoje.charAt(0).toUpperCase() + dataHoje.slice(1)}</div>
          <div className="ui-title">{saudacao}{primeiroNome ? `, ${primeiroNome}` : ''}</div>
          <div className="ui-sub">
            {colabFiltrado ? `Dados de ${colabFiltrado.nome_completo}` : `Equipe de ${colab.length} consultor${colab.length !== 1 ? 'es' : ''}`} · {nomePeriodo}
          </div>
        </div>
        <div className="ui-header-actions">
          <Link href="/admin/cotacoes/nova" className="ui-btn ui-btn-secondary"><IconDoc /> Nova cotação</Link>
          <Link href="/admin/visitas/novo" className="ui-btn ui-btn-primary"><IconPlus /> Nova visita</Link>
        </div>
      </div>

      <Suspense fallback={null}>
        <AdminFiltersBar clientes={clientesLista} funcionarios={colab.map(c => ({ id: c.id, nome_completo: c.nome_completo ?? '' }))} inicio={inicio} fim={fim} funcionarioId={func} />
      </Suspense>

      {/* ── Indicadores ── */}
      <div className="pn-kpis">
        <Link href="/admin/visitas" className="ui-card ui-card-hover pn-kpi">
          <div className="pn-kpi-top"><span className="pn-kpi-l">Visitas realizadas</span><span className="pn-kpi-ico" style={{ background: '#eaf7ef', color: '#1a7f4b' }}><IconCheck /></span></div>
          <div className="pn-kpi-n">{realizadas}</div>
          <Delta atual={realizadas} anterior={realizadasAnt} total={tudo} />
        </Link>
        <div className="ui-card pn-kpi">
          <div className="pn-kpi-top"><span className="pn-kpi-l">Conclusão da agenda</span></div>
          <div className="pn-kpi-n">{taxa}<small>%</small></div>
          <div className="pn-meter" role="meter" aria-valuenow={taxa} aria-valuemin={0} aria-valuemax={100} aria-label="Taxa de conclusão"><span style={{ width: `${taxa}%`, background: taxa >= 70 ? '#1a7f4b' : '#E67E22' }} /></div>
          <div className="pn-kpi-s">{agendadas} ainda agendada{agendadas !== 1 ? 's' : ''}</div>
        </div>
        <Link href="/admin/clientes" className="ui-card ui-card-hover pn-kpi">
          <div className="pn-kpi-top"><span className="pn-kpi-l">Clientes atendidos</span><span className="pn-kpi-ico" style={{ background: '#fdf3e9', color: '#E67E22' }}><IconUsers /></span></div>
          <div className="pn-kpi-n">{clientesAtendidos}<small>de {clientesLista.length}</small></div>
          <Delta atual={clientesAtendidos} anterior={clientesAnt} total={tudo} />
        </Link>
        <Link href="/admin/relatorios/km" className="ui-card ui-card-hover pn-kpi">
          <div className="pn-kpi-top"><span className="pn-kpi-l">KM rodado</span><span className="pn-kpi-ico" style={{ background: '#eef1ef', color: '#162a1e' }}><IconRoute /></span></div>
          <div className="pn-kpi-n">{totalKm.toLocaleString('pt-BR')}<small>km</small></div>
          <div className="pn-kpi-s">{moeda(totalGasto)} em combustível{totalKm > 0 ? ` · ${(totalGasto / totalKm).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/km` : ''}</div>
        </Link>
        <Link href="/admin/cotacoes" className="ui-card ui-card-hover pn-kpi">
          <div className="pn-kpi-top"><span className="pn-kpi-l">Vendas efetivadas</span><span className="pn-kpi-ico" style={{ background: '#eaf7ef', color: '#1a7f4b' }}><IconDoc /></span></div>
          <div className="pn-kpi-n" title={moeda(efetivado.valor)}>{compacto(efetivado.valor)}</div>
          <Delta atual={efetivado.valor} anterior={efetivadoAnt} total={tudo} />
        </Link>
      </div>

      {/* ── Tendência + Hoje ── */}
      <div className="pn-grid pn-g-main">
        <AdminCharts visitasPorMes={visitasPorMes} />

        <div className="ui-card pn-card">
          <div className="pn-card-h">
            <span className="pn-card-t"><IconSun /> Hoje</span>
            <Link href="/admin/agenda" className="pn-card-link">Agenda <IconArrow /></Link>
          </div>
          {hojeLista.length > 0 && (
            <div className="pn-hoje-prog">
              <span>{hojeFeitas} de {hojeLista.length} feitas</span>
              <div className="pn-meter"><span style={{ width: `${Math.round((hojeFeitas / hojeLista.length) * 100)}%` }} /></div>
            </div>
          )}
          {hojeLista.length === 0 ? (
            <div className="pn-vazio"><b>Nenhuma visita hoje</b>A agenda do dia da equipe aparece aqui.</div>
          ) : hojeLista.slice(0, 6).map(v => <LinhaVisita key={v.id} v={v} hora />)}
          {hojeLista.length > 6 && <Link href="/admin/agenda" className="pn-vis" style={{ justifyContent: 'center', fontSize: '.72rem', color: '#8f978f', fontWeight: 600 }}>+{hojeLista.length - 6} visitas hoje</Link>}
        </div>
      </div>

      {/* ── Atenção · Cotações · Próximas ── */}
      <div className="pn-grid pn-g-3">
        <div className="ui-card pn-card">
          <div className="pn-card-h">
            <span className="pn-card-t" style={qtdAtencao ? { color: '#c0392b' } : undefined}><IconAlert /> Precisa de atenção</span>
          </div>
          {pendentesAprovacao.length > 0 && (
            <div className="pn-at-sec">
              <div className="pn-at-h"><span className="pn-at-n a">{pendentesAprovacao.length}</span>Preços aguardando sua aprovação<Link href="/admin/cotacoes">Cotações</Link></div>
              {pendentesAprovacao.map(c => (
                <Link key={c.id} href={`/admin/cotacoes/${c.id}`} className="pn-at-li"><span>Nº {c.numero} · {c.cliente_nome ?? '—'}</span><span>{um(c.autor)?.nome_completo ?? ''}</span></Link>
              ))}
            </div>
          )}
          <div className="pn-at-sec">
            <div className="pn-at-h"><span className={`pn-at-n ${(totalAtrasadas ?? 0) ? 'r' : 'z'}`}>{totalAtrasadas ?? 0}</span>Visitas atrasadas<Link href="/admin/visitas?status=atrasada">Resolver</Link></div>
            {atrasadasLista.length ? atrasadasLista.map(v => (
              <Link key={v.id} href={`/admin/visitas/${v.id}`} className="pn-at-li"><span>{um(v.cliente)?.nome ?? 'Cliente removido'}</span><span>{fmtCurta(v.data_visita)}</span></Link>
            )) : <div className="pn-ok">Nenhuma visita pendente de finalizar.</div>}
          </div>
          <div className="pn-at-sec">
            <div className="pn-at-h"><span className={`pn-at-n ${esquecidos.length ? 'a' : 'z'}`}>{esquecidos.length}</span>Clientes sem visita há 60+ dias<Link href="/admin/clientes">Carteira</Link></div>
            {esquecidos.length ? esquecidos.slice(0, 3).map(c => (
              <Link key={c.id} href={`/admin/visitas/novo?cliente=${c.id}`} className="pn-at-li" title="Agendar visita"><span>{c.nome}</span><span>{c.ultima ? fmtCurta(c.ultima) : 'nunca visitado'}</span></Link>
            )) : <div className="pn-ok">Carteira em dia.</div>}
          </div>
          <div className="pn-at-sec">
            <div className="pn-at-h"><span className={`pn-at-n ${parados.length ? 'a' : 'z'}`}>{parados.length}</span>Consultores sem visita realizada</div>
            {parados.length ? parados.slice(0, 3).map(c => (
              <Link key={c.id} href={`/admin/consultores/${c.id}`} className="pn-at-li"><span>{c.nome}</span><span>{c.agendadas} agendada{c.agendadas !== 1 ? 's' : ''}</span></Link>
            )) : <div className="pn-ok">Toda a equipe com visitas realizadas.</div>}
          </div>
        </div>

        <div className="ui-card pn-card">
          <div className="pn-card-h">
            <span className="pn-card-t"><IconDoc /> Cotações</span>
            <span className="pn-card-sub">{totalCotacoes} no período</span>
            <Link href="/admin/cotacoes" className="pn-card-link">Ver todas <IconArrow /></Link>
          </div>
          {totalCotacoes === 0 ? (
            <div className="pn-vazio"><b>Nenhuma cotação no período</b><Link href="/admin/cotacoes/nova" style={{ color: '#E67E22', fontWeight: 600 }}>Criar cotação</Link></div>
          ) : (
            <>
              <div className="pn-funil">
                {funil.map(f => (
                  <div key={f.status}>
                    <div className="pn-funil-l">
                      <span><i className="pn-dot" style={{ background: STATUS_COTACAO[f.status].cor }} />{STATUS_COTACAO[f.status].label} <small>· {f.qtd}</small></span>
                      <b>{compacto(f.valor)}</b>
                    </div>
                    <div className="pn-funil-bar"><span style={{ width: `${(f.valor / maiorFunil) * 100}%`, background: STATUS_COTACAO[f.status].cor }} /></div>
                  </div>
                ))}
              </div>
              <div className="pn-conv"><span>Conversão (efetivadas ÷ decididas)</span><b>{conversao == null ? '—' : `${conversao}%`}</b></div>
            </>
          )}
        </div>

        <div className="ui-card pn-card">
          <div className="pn-card-h">
            <span className="pn-card-t"><IconCalendar /> Próximas visitas</span>
            <Link href="/admin/agenda" className="pn-card-link">Agenda <IconArrow /></Link>
          </div>
          {!(proximas ?? []).length ? (
            <div className="pn-vazio"><b>Nada agendado</b>As próximas visitas da equipe aparecem aqui.</div>
          ) : (proximas as VisitaLista[]).map(v => <LinhaVisita key={v.id} v={v} />)}
        </div>
      </div>

      {/* ── Equipe ── */}
      <div className="pn-sec-h">
        <span className="pn-card-t"><IconUsers /> Desempenho da equipe</span>
        <span className="pn-card-sub">{nomePeriodo}</span>
        <Link href="/admin/consultores" className="pn-card-link">Consultores <IconArrow /></Link>
      </div>
      <EquipeTabela linhas={ranking.map(c => ({
        id: c.id, nome: c.nome, realizadas: c.realizadas, agendadas: c.agendadas, clientes: c.clientes.size,
        km: c.km, litros: c.litros, gasto: c.gasto, vendido: c.vendido,
      }))} />
    </>
  )
}

function LinhaVisita({ v, hora = false }: { v: VisitaLista; hora?: boolean }) {
  const cli = um(v.cliente)
  const fun = um(v.funcionario)
  const d = new Date(v.data_visita + 'T12:00')
  return (
    <Link href={`/admin/visitas/${v.id}`} className="pn-vis">
      <div className="pn-hora">
        {hora
          ? (v.hora_visita ? v.hora_visita.slice(0, 5) : <small>sem hora</small>)
          : <>{String(d.getDate()).padStart(2, '0')}/{String(d.getMonth() + 1).padStart(2, '0')}<small>{d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</small></>}
      </div>
      <div className="pn-vis-main">
        <div className="pn-vis-t">{cli?.nome ?? 'Cliente removido'}</div>
        <div className="pn-vis-m">{cli?.nome_fazenda && <><em>{cli.nome_fazenda}</em> · </>}{fun?.nome_completo ?? '—'}</div>
      </div>
      <span className={`ui-badge ui-badge-${v.status}`}>{STATUS_LABEL[v.status] ?? v.status}</span>
    </Link>
  )
}

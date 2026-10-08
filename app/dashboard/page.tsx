import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ATALHO_PADRAO, calcRange, descreverPeriodo, hojeISO, somarDias } from '@/lib/dateUtils'
import { ETAPAS, etapaDe, calcularTotais, itemDoBanco, parametrosDoBanco } from '@/lib/cotacao'
import AdminCharts from '@/app/admin/AdminCharts'
import DashboardPeriodoBar from './DashboardPeriodoBar'
import FunilCotacoes from '@/app/components/cotacoes/FunilCotacoes'

type SearchParams = Promise<{ inicio?: string; fim?: string }>
type Rel<T> = T | T[] | null
type VisitaLista = { id: string; data_visita: string; hora_visita: string | null; status: string; checkin_em: string | null; cliente: Rel<{ nome: string; nome_fazenda: string | null; latitude: number | null }> }
type Cot = { id: string; numero: string; status: string; created_at: string; cliente_nome: string | null; aprovacao_status: string | null; enviada_em: string | null; validade: string | null; pedido_status: string | null; motivo_perda: string | null }

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const STATUS_VISITA: Record<string, string> = { agendada: 'Agendada', realizada: 'Realizada', cancelada: 'Cancelada' }
const um = <T,>(r: Rel<T>) => (Array.isArray(r) ? r[0] ?? null : r)
const moeda = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const dataBR = (d: string) => d.slice(0, 10).split('-').reverse().join('/')
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(ate.slice(0, 10)) - Date.parse(de.slice(0, 10))) / 86400000)

function Ic({ d, size = 16 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" dangerouslySetInnerHTML={{ __html: d }} />
}
const D = {
  mais: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  rota: '<circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  alerta: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  seta: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  mapa: '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
}

export default async function DashboardHome({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const eu = user.id

  const hoje = hojeISO()
  const padrao = calcRange(ATALHO_PADRAO)
  const inicio = params.inicio ?? padrao.inicio
  const fim = params.fim ?? padrao.fim
  const [ano, mes] = hoje.split('-').map(Number)
  const chaveMes = (i: number) => new Date(Date.UTC(ano, mes - 1 - i, 1)).toISOString().slice(0, 7)

  // todas as consultas filtram o próprio usuário (um admin abrindo o app também vê só o que é dele)
  const camposVisita = 'id, data_visita, hora_visita, status, checkin_em, cliente:clientes(nome, nome_fazenda, latitude)'
  const [
    { data: perfil },
    { data: visitasPeriodo },
    { data: hojeVis },
    { data: proximas },
    { data: atrasadas, count: totalAtrasadas },
    { data: historico },
    { data: kms },
    { data: cotacoes },
    { data: carteira },
    { data: realizadasCarteira },
    { data: cfg },
  ] = await Promise.all([
    supabase.from('profiles').select('nome_completo').eq('id', eu).single(),
    supabase.from('visitas').select('status, cliente_id').eq('funcionario_id', eu).gte('data_visita', inicio).lte('data_visita', fim),
    supabase.from('visitas').select(camposVisita).eq('funcionario_id', eu).eq('data_visita', hoje).neq('status', 'cancelada').order('hora_visita', { nullsFirst: false }),
    supabase.from('visitas').select(camposVisita).eq('funcionario_id', eu).eq('status', 'agendada').gt('data_visita', hoje).order('data_visita').limit(5),
    supabase.from('visitas').select(camposVisita, { count: 'exact' }).eq('funcionario_id', eu).eq('status', 'agendada').lt('data_visita', hoje).order('data_visita').limit(3),
    supabase.from('visitas').select('data_visita, status').eq('funcionario_id', eu).gte('data_visita', chaveMes(5) + '-01'),
    supabase.from('km_diario').select('km_inicial, km_final').eq('funcionario_id', eu).gte('data', inicio).lte('data', fim),
    supabase.from('cotacoes').select('id, numero, status, created_at, cliente_nome, aprovacao_status, enviada_em, validade, pedido_status, motivo_perda, ptax, juros_mes, aliquota_icms, aliquota_ir, itens:cotacao_itens(*)').eq('criado_por', eu).order('created_at', { ascending: false }),
    supabase.from('clientes').select('id, nome').eq('responsavel_id', eu),
    supabase.from('visitas').select('cliente_id, data_visita').eq('status', 'realizada').order('data_visita', { ascending: false }),
    supabase.from('configuracoes').select('dias_followup').eq('id', 1).maybeSingle(),
  ])

  // ── indicadores do período ──
  const vp = visitasPeriodo ?? []
  const realizadas = vp.filter(v => v.status === 'realizada').length
  const agendadas = vp.filter(v => v.status === 'agendada').length
  const taxa = realizadas + agendadas ? Math.round((realizadas / (realizadas + agendadas)) * 100) : 0
  const clientesAtendidos = new Set(vp.filter(v => v.status === 'realizada').map(v => v.cliente_id)).size
  const km = (kms ?? []).reduce((s, k) => s + (k.km_inicial != null && k.km_final != null ? Number(k.km_final) - Number(k.km_inicial) : 0), 0)
  const cots = (cotacoes ?? []).map(c => ({ ...c, venda: calcularTotais(((c.itens ?? []) as Record<string, unknown>[]).map(itemDoBanco), parametrosDoBanco(c)).venda })) as (Cot & { venda: number })[]
  const noPeriodo = (d: string) => d.slice(0, 10) >= inicio && d.slice(0, 10) <= fim
  const vendido = cots.filter(c => c.status === 'efetivada' && noPeriodo(c.created_at)).reduce((s, c) => s + c.venda, 0)

  // ── atenção ──
  const diasFollow = cfg?.dias_followup ?? 3
  const aguardando = cots.filter(c => c.aprovacao_status === 'pendente')
  const reprovadas = cots.filter(c => c.aprovacao_status === 'reprovada' && c.status === 'rascunho')
  const paraEnviar = cots.filter(c => c.status === 'aprovada')
  const paradas = cots.filter(c => c.status === 'enviada' && c.enviada_em && diasEntre(c.enviada_em, hoje) >= diasFollow)
  const vencendo = cots.filter(c => (c.status === 'rascunho' || c.status === 'aprovada' || c.status === 'enviada') && c.validade && diasEntre(hoje, c.validade) <= 2)
  const ultimaPorCliente = new Map<string, string>()
  ;(realizadasCarteira ?? []).forEach(v => { if (!ultimaPorCliente.has(v.cliente_id)) ultimaPorCliente.set(v.cliente_id, v.data_visita) })
  const limite60 = somarDias(hoje, -60)
  const esquecidos = (carteira ?? []).map(c => ({ ...c, ultima: ultimaPorCliente.get(c.id) ?? null })).filter(c => !c.ultima || c.ultima < limite60)
    .sort((a, b) => (a.ultima ?? '').localeCompare(b.ultima ?? ''))
  const qtdAtencao = (totalAtrasadas ?? 0) + aguardando.length + reprovadas.length + paraEnviar.length + paradas.length + vencendo.length + esquecidos.length

  // ── histórico ──
  const meses: Record<string, { realizadas: number; agendadas: number }> = {}
  for (let i = 5; i >= 0; i--) meses[chaveMes(i)] = { realizadas: 0, agendadas: 0 }
  ;(historico ?? []).forEach(v => {
    const m = meses[v.data_visita.slice(0, 7)]
    if (m && v.status === 'realizada') m.realizadas++
    if (m && v.status === 'agendada') m.agendadas++
  })
  const visitasPorMes = Object.entries(meses).map(([k, v]) => ({ mes: MESES[Number(k.slice(5)) - 1], ...v }))

  const hojeLista = (hojeVis ?? []) as VisitaLista[]
  const feitas = hojeLista.filter(v => v.status === 'realizada').length
  const horaBR = Number(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }))
  const saudacao = horaBR < 12 ? 'Bom dia' : horaBR < 18 ? 'Boa tarde' : 'Boa noite'
  const primeiroNome = (perfil?.nome_completo ?? '').split(' ')[0]
  const dataHoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' })
  const periodo = descreverPeriodo(inicio, fim)

  return (
    <>
      <style>{`
        .dh-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1rem;margin-bottom:1.2rem}
        .dh-kpi{padding:1.05rem 1.1rem;text-decoration:none;display:block}
        .dh-kpi-l{font-size:.74rem;font-weight:500;color:#5b6660;display:flex;justify-content:space-between;align-items:center}
        .dh-kpi-l span:last-child{color:#E67E22;display:flex}
        .dh-kpi-n{font-size:1.6rem;font-weight:600;color:#162a1e;margin-top:.35rem;letter-spacing:-.02em;white-space:nowrap}
        .dh-kpi-n small{font-size:.8rem;font-weight:500;color:#8f978f;margin-left:.3rem}
        .dh-kpi-s{font-size:.7rem;color:#8f978f;margin-top:.25rem}
        .dh-meter{height:6px;border-radius:999px;background:#eaf2ec;overflow:hidden;margin-top:.55rem}
        .dh-meter span{display:block;height:100%;border-radius:999px;background:#1a7f4b}
        .dh-grid{display:grid;gap:1.1rem;margin-bottom:1.2rem}
        .dh-g2{grid-template-columns:minmax(0,1.3fr) minmax(0,1fr)}
        .dh-card{display:flex;flex-direction:column;min-width:0;overflow:hidden}
        .dh-card-h{display:flex;align-items:center;gap:.6rem;padding:1.05rem 1.25rem .8rem}
        .dh-card-t{font-size:.9rem;font-weight:600;color:#162a1e;display:flex;align-items:center;gap:.5rem}
        .dh-card-t svg{color:#E67E22}
        .dh-link{margin-left:auto;font-size:.72rem;font-weight:600;color:#8f978f;text-decoration:none;display:inline-flex;align-items:center;gap:.3rem}
        .dh-link:hover{color:#E67E22}
        .dh-vazio{padding:1.5rem 1.25rem;text-align:center;font-size:.76rem;color:#8f978f;line-height:1.6}
        .dh-vazio b{display:block;color:#5b6660;font-size:.82rem;font-weight:600}
        .dh-prog{display:flex;align-items:center;gap:.7rem;padding:0 1.25rem .8rem;font-size:.7rem;color:#8f978f}
        .dh-prog .dh-meter{flex:1;margin:0}
        .dh-vis{display:flex;align-items:center;gap:.8rem;padding:.65rem 1.25rem;border-top:1px solid #f4f1ec;text-decoration:none}
        .dh-vis:hover{background:#fcfaf7}
        .dh-hora{width:48px;flex-shrink:0;font-size:.74rem;font-weight:600;color:#162a1e;font-variant-numeric:tabular-nums}
        .dh-hora small{display:block;font-size:.6rem;font-weight:500;color:#8f978f}
        .dh-vis-main{flex:1;min-width:0}
        .dh-vis-t{font-size:.8rem;font-weight:600;color:#162a1e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .dh-vis-m{font-size:.68rem;color:#8f978f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:.1rem}
        .dh-vis-m em{font-style:normal;color:#E67E22;font-weight:600}
        .dh-ck{font-size:.62rem;font-weight:600;color:#1e8a4c;background:#eaf7ef;border-radius:999px;padding:.12rem .45rem;margin-left:.35rem}
        .dh-at-sec{padding:.7rem 1.25rem;border-top:1px solid #f4f1ec}
        .dh-at-h{display:flex;align-items:center;gap:.5rem;font-size:.76rem;font-weight:600;color:#162a1e}
        .dh-at-h a{margin-left:auto;font-size:.68rem;color:#8f978f;text-decoration:none}
        .dh-at-h a:hover{color:#E67E22}
        .dh-at-n{min-width:22px;height:20px;border-radius:999px;font-size:.66rem;font-weight:600;display:inline-flex;align-items:center;justify-content:center;padding:0 .4rem}
        .dh-at-n.r{background:#fdeeec;color:#c0392b}.dh-at-n.a{background:#fdf3e9;color:#c0651a}.dh-at-n.z{background:#f2efea;color:#8f978f}
        .dh-at-li{display:flex;justify-content:space-between;gap:.6rem;font-size:.72rem;padding:.22rem 0 .22rem 1.85rem;text-decoration:none}
        .dh-at-li span:first-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500;color:#162a1e}
        .dh-at-li span:last-child{color:#8f978f;white-space:nowrap}
        a.dh-at-li:hover span:first-child{color:#E67E22}
        .dh-ok{padding:1.2rem 1.25rem;font-size:.78rem;color:#1e8a4c;display:flex;align-items:center;gap:.5rem}
        .dh-cot{display:flex;align-items:center;gap:.7rem;padding:.6rem 1.25rem;border-top:1px solid #f4f1ec;text-decoration:none}
        .dh-cot:hover{background:#fcfaf7}
        @media(max-width:1200px){.dh-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
        @media(max-width:900px){.dh-g2{grid-template-columns:1fr}}
        @media(max-width:600px){.dh-kpis{grid-template-columns:1fr 1fr}.dh-kpi-n{font-size:1.3rem}}
      `}</style>

      <div className="ui-page-header">
        <div>
          <div className="ui-eyebrow" style={{ textTransform: 'none', letterSpacing: 0 }}>{dataHoje.charAt(0).toUpperCase() + dataHoje.slice(1)}</div>
          <div className="ui-title">{saudacao}{primeiroNome ? `, ${primeiroNome}` : ''}</div>
          <div className="ui-sub">{hojeLista.length ? `Você tem ${hojeLista.length} visita${hojeLista.length > 1 ? 's' : ''} hoje` : 'Nenhuma visita marcada para hoje'}{qtdAtencao ? ` · ${qtdAtencao} ite${qtdAtencao > 1 ? 'ns' : 'm'} pedindo atenção` : ''}</div>
        </div>
        <div className="ui-header-actions">
          <Link href="/dashboard/cotacoes/nova" className="ui-btn ui-btn-secondary"><Ic d={D.doc} size={15} /> Nova cotação</Link>
          <Link href="/dashboard/visitas/novo" className="ui-btn ui-btn-primary"><Ic d={D.mais} size={15} /> Nova visita</Link>
        </div>
      </div>

      <Suspense fallback={null}><DashboardPeriodoBar inicio={inicio} fim={fim} /></Suspense>

      <div className="dh-kpis">
        <Link href="/dashboard/visitas" className="ui-card ui-card-hover dh-kpi">
          <div className="dh-kpi-l"><span>Visitas realizadas</span><span><Ic d={D.check} /></span></div>
          <div className="dh-kpi-n">{realizadas}</div>
          <div className="dh-kpi-s">{periodo}</div>
        </Link>
        <div className="ui-card dh-kpi">
          <div className="dh-kpi-l"><span>Conclusão da agenda</span></div>
          <div className="dh-kpi-n">{taxa}<small>%</small></div>
          <div className="dh-meter"><span style={{ width: `${taxa}%`, background: taxa >= 70 ? '#1a7f4b' : '#E67E22' }} /></div>
          <div className="dh-kpi-s">{agendadas} ainda agendada{agendadas !== 1 ? 's' : ''}</div>
        </div>
        <Link href="/dashboard/clientes" className="ui-card ui-card-hover dh-kpi">
          <div className="dh-kpi-l"><span>Clientes atendidos</span><span><Ic d={D.users} /></span></div>
          <div className="dh-kpi-n">{clientesAtendidos}<small>de {(carteira ?? []).length} na carteira</small></div>
          <div className="dh-kpi-s">{periodo}</div>
        </Link>
        <Link href="/dashboard/cotacoes" className="ui-card ui-card-hover dh-kpi">
          <div className="dh-kpi-l"><span>Vendas efetivadas</span><span><Ic d={D.doc} /></span></div>
          <div className="dh-kpi-n">{moeda(vendido)}</div>
          <div className="dh-kpi-s">{cots.filter(c => c.status === 'efetivada' && noPeriodo(c.created_at)).length} cotações efetivadas</div>
        </Link>
        <Link href="/dashboard/km" className="ui-card ui-card-hover dh-kpi">
          <div className="dh-kpi-l"><span>KM rodado</span><span><Ic d={D.rota} /></span></div>
          <div className="dh-kpi-n">{km.toLocaleString('pt-BR')}<small>km</small></div>
          <div className="dh-kpi-s">{periodo}</div>
        </Link>
      </div>

      <div className="dh-grid dh-g2">
        <div className="ui-card dh-card">
          <div className="dh-card-h">
            <span className="dh-card-t"><Ic d={D.sol} /> Hoje</span>
            {hojeLista.length > 0 && <Link href="/dashboard/agendamento?visao=dia" className="dh-link"><Ic d={D.mapa} size={12} /> Rota no mapa</Link>}
          </div>
          {hojeLista.length > 0 && (
            <div className="dh-prog"><span>{feitas} de {hojeLista.length} feitas</span><div className="dh-meter"><span style={{ width: `${Math.round((feitas / hojeLista.length) * 100)}%` }} /></div></div>
          )}
          {hojeLista.length === 0
            ? <div className="dh-vazio"><b>Agenda livre hoje</b>Aproveite para visitar um cliente da lista de atenção.</div>
            : hojeLista.map(v => <LinhaVisita key={v.id} v={v} hora />)}
        </div>

        <div className="ui-card dh-card">
          <div className="dh-card-h"><span className="dh-card-t" style={qtdAtencao ? { color: '#c0392b' } : undefined}><Ic d={D.alerta} /> Precisa de atenção</span></div>
          {qtdAtencao === 0 ? (
            <div className="dh-ok"><Ic d={D.check} /> Tudo em dia. Nenhuma pendência agora.</div>
          ) : (
            <>
              {(totalAtrasadas ?? 0) > 0 && (
                <ItemAtencao n={totalAtrasadas ?? 0} cls="r" titulo="Visitas atrasadas para finalizar" href="/dashboard/visitas">
                  {((atrasadas ?? []) as VisitaLista[]).map(v => <Link key={v.id} href={`/dashboard/visitas/${v.id}`} className="dh-at-li"><span>{um(v.cliente)?.nome ?? 'Cliente'}</span><span>{dataBR(v.data_visita)}</span></Link>)}
                </ItemAtencao>
              )}
              {aguardando.length > 0 && (
                <ItemAtencao n={aguardando.length} cls="a" titulo="Cotações aguardando aprovação da gestão">
                  {aguardando.slice(0, 3).map(c => <Link key={c.id} href={`/dashboard/cotacoes/${c.id}`} className="dh-at-li"><span>Nº {c.numero} · {c.cliente_nome}</span><span>{moeda(c.venda)}</span></Link>)}
                </ItemAtencao>
              )}
              {reprovadas.length > 0 && (
                <ItemAtencao n={reprovadas.length} cls="r" titulo="Reprovadas pela gestão para revisar">
                  {reprovadas.slice(0, 3).map(c => <Link key={c.id} href={`/dashboard/cotacoes/${c.id}`} className="dh-at-li"><span>Nº {c.numero} · {c.cliente_nome}</span><span>revisar</span></Link>)}
                </ItemAtencao>
              )}
              {paraEnviar.length > 0 && (
                <ItemAtencao n={paraEnviar.length} cls="a" titulo="Aprovadas pela gestão: enviar orçamento ao cliente">
                  {paraEnviar.slice(0, 3).map(c => <Link key={c.id} href={`/dashboard/cotacoes/${c.id}`} className="dh-at-li"><span>Nº {c.numero} · {c.cliente_nome}</span><span>{moeda(c.venda)}</span></Link>)}
                </ItemAtencao>
              )}
              {paradas.length > 0 && (
                <ItemAtencao n={paradas.length} cls="a" titulo="Orçamentos enviados sem resposta">
                  {paradas.slice(0, 3).map(c => <Link key={c.id} href={`/dashboard/cotacoes/${c.id}`} className="dh-at-li"><span>Nº {c.numero} · {c.cliente_nome}</span><span>há {diasEntre(c.enviada_em!, hoje)} dias</span></Link>)}
                </ItemAtencao>
              )}
              {vencendo.length > 0 && (
                <ItemAtencao n={vencendo.length} cls="a" titulo="Cotações com validade vencendo">
                  {vencendo.slice(0, 3).map(c => { const d = diasEntre(hoje, c.validade!); return <Link key={c.id} href={`/dashboard/cotacoes/${c.id}`} className="dh-at-li"><span>Nº {c.numero} · {c.cliente_nome}</span><span>{d < 0 ? 'vencida' : d === 0 ? 'vence hoje' : `vence em ${d}d`}</span></Link> })}
                </ItemAtencao>
              )}
              {esquecidos.length > 0 && (
                <ItemAtencao n={esquecidos.length} cls="a" titulo="Clientes da carteira sem visita há 60+ dias" href="/dashboard/clientes">
                  {esquecidos.slice(0, 3).map(c => <Link key={c.id} href={`/dashboard/visitas/novo?cliente=${c.id}`} className="dh-at-li" title="Agendar visita"><span>{c.nome}</span><span>{c.ultima ? dataBR(c.ultima) : 'nunca visitado'}</span></Link>)}
                </ItemAtencao>
              )}
            </>
          )}
        </div>
      </div>

      {/* acompanhamento das próprias cotações: quantas foram enviadas, efetivadas e perdidas no período */}
      <FunilCotacoes cotacoes={cots.filter(c => noPeriodo(c.created_at)).map(c => ({ status: c.status, enviada_em: c.enviada_em, venda: c.venda, motivo_perda: c.motivo_perda, aprovacao_status: c.aprovacao_status }))} periodo={`Minhas cotações · ${periodo}`} />

      <div className="dh-grid dh-g2">
        <AdminCharts visitasPorMes={visitasPorMes} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <div className="ui-card dh-card">
            <div className="dh-card-h"><span className="dh-card-t"><Ic d={D.cal} /> Próximas visitas</span><Link href="/dashboard/agendamento" className="dh-link">Agenda <Ic d={D.seta} size={12} /></Link></div>
            {!(proximas ?? []).length ? <div className="dh-vazio"><b>Nada agendado</b><Link href="/dashboard/visitas/novo" style={{ color: '#E67E22', fontWeight: 600 }}>Agendar visita</Link></div>
              : ((proximas ?? []) as VisitaLista[]).map(v => <LinhaVisita key={v.id} v={v} />)}
          </div>
          <div className="ui-card dh-card">
            <div className="dh-card-h"><span className="dh-card-t"><Ic d={D.doc} /> Cotações recentes</span><Link href="/dashboard/cotacoes" className="dh-link">Ver todas <Ic d={D.seta} size={12} /></Link></div>
            {cots.length === 0 ? <div className="dh-vazio"><b>Nenhuma cotação ainda</b><Link href="/dashboard/cotacoes/nova" style={{ color: '#E67E22', fontWeight: 600 }}>Criar cotação</Link></div>
              : cots.slice(0, 4).map(c => {
                const st = ETAPAS[etapaDe(c)]
                return (
                  <Link key={c.id} href={`/dashboard/cotacoes/${c.id}`} className="dh-cot">
                    <div className="dh-vis-main"><div className="dh-vis-t">{c.cliente_nome || 'Sem cliente'}</div><div className="dh-vis-m">Nº {c.numero} · {moeda(c.venda)}</div></div>
                    <span className={`ui-badge ${st.badge}`}>{st.label}</span>
                  </Link>
                )
              })}
          </div>
        </div>
      </div>
    </>
  )
}

function ItemAtencao({ n, cls, titulo, href, children }: { n: number; cls: string; titulo: string; href?: string; children?: React.ReactNode }) {
  return (
    <div className="dh-at-sec">
      <div className="dh-at-h"><span className={`dh-at-n ${n ? cls : 'z'}`}>{n}</span>{titulo}{href && n > 0 && <Link href={href}>Ver</Link>}</div>
      {children}
    </div>
  )
}

function LinhaVisita({ v, hora = false }: { v: VisitaLista; hora?: boolean }) {
  const cli = um(v.cliente)
  return (
    <Link href={`/dashboard/visitas/${v.id}`} className="dh-vis">
      <div className="dh-hora">
        {hora ? (v.hora_visita ? v.hora_visita.slice(0, 5) : <small>sem hora</small>)
          : <>{dataBR(v.data_visita).slice(0, 5)}<small>{new Date(v.data_visita + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</small></>}
      </div>
      <div className="dh-vis-main">
        <div className="dh-vis-t">{cli?.nome ?? 'Cliente removido'}{hora && v.checkin_em && <span className="dh-ck">check-in feito</span>}</div>
        <div className="dh-vis-m">{cli?.nome_fazenda ? <em>{cli.nome_fazenda}</em> : 'Sem fazenda'}{hora && cli?.latitude == null && ' · sem localização'}</div>
      </div>
      <span className={`ui-badge ui-badge-${v.status}`}>{STATUS_VISITA[v.status] ?? v.status}</span>
    </Link>
  )
}

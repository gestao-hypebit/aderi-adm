import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { calcRange, defaultFiltros } from '@/lib/dateUtils'
import AdminFiltersBar from './AdminFiltersBar'
import AdminCharts, { type DadosColaborador } from './AdminCharts'
import Link from 'next/link'

type SearchParams = Promise<{ inicio?: string; fim?: string; func?: string }>

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const STATUS_LABEL: Record<string, string> = { agendada: 'Agendada', realizada: 'Realizada', cancelada: 'Cancelada' }

function IconPlus() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function IconCalendar() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function IconCheck() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
}
function IconTarget() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
}
function IconRoute() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/></svg>
}
function IconFuel() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 22V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17"/><line x1="2" y1="22" x2="16" y2="22"/><line x1="6" y1="9" x2="12" y2="9"/><path d="M15 12h2a2 2 0 0 1 2 2v3a2 2 0 0 0 4 0V9l-3-3"/></svg>
}
function IconActivity() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
}
function IconUsers() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}
function IconAlert() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
}

export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const defaults = defaultFiltros('este-mes')
  const inicio = params.inicio ?? defaults.dataInicio
  const fim = params.fim ?? defaults.dataFim
  const funcionarioFiltro = params.func ?? ''

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: meuPerfil } = user
    ? await supabase.from('profiles').select('nome_completo').eq('id', user.id).single()
    : { data: null }
  const hoje = new Date().toISOString().split('T')[0]

  // Lista de colaboradores e clientes para o filter bar
  const [{ data: colaboradores }, { data: clientes }] = await Promise.all([
    supabase.from('profiles').select('id, nome_completo').eq('role', 'colaborador').eq('ativo', true).order('nome_completo'),
    supabase.from('clientes').select('id, nome').order('nome'),
  ])

  const colab = colaboradores ?? []
  const clientesLista = clientes ?? []

  // Query base de visitas no período
  let visitasQuery = supabase
    .from('visitas')
    .select('id, status, funcionario_id, data_visita')
    .gte('data_visita', inicio)
    .lte('data_visita', fim)

  if (funcionarioFiltro) visitasQuery = visitasQuery.eq('funcionario_id', funcionarioFiltro)

  // Query KM no período
  let kmQuery = supabase
    .from('km_diario')
    .select('funcionario_id, km_inicial, km_final, data')
    .gte('data', inicio)
    .lte('data', fim)

  if (funcionarioFiltro) kmQuery = kmQuery.eq('funcionario_id', funcionarioFiltro)

  // Query abastecimentos no período
  let abastQuery = supabase
    .from('abastecimentos')
    .select('funcionario_id, litros, valor_total, data')
    .gte('data', inicio)
    .lte('data', fim)

  if (funcionarioFiltro) abastQuery = abastQuery.eq('funcionario_id', funcionarioFiltro)

  // Histórico 6 meses (sempre, independente do filtro de período)
  const seisAtras = new Date()
  seisAtras.setMonth(seisAtras.getMonth() - 5)
  seisAtras.setDate(1)
  const inicioHistorico = seisAtras.toISOString().slice(0, 10)

  let historicoQuery = supabase
    .from('visitas')
    .select('data_visita, status')
    .gte('data_visita', inicioHistorico)

  if (funcionarioFiltro) historicoQuery = historicoQuery.eq('funcionario_id', funcionarioFiltro)

  let proximasQuery = supabase
    .from('visitas')
    .select('id, data_visita, status, cliente:clientes(nome, nome_fazenda), funcionario:profiles(nome_completo)')
    .eq('status', 'agendada')
    .gte('data_visita', hoje)
    .order('data_visita')
    .limit(5)

  if (funcionarioFiltro) proximasQuery = proximasQuery.eq('funcionario_id', funcionarioFiltro)

  let ultimasQuery = supabase
    .from('visitas')
    .select('id, data_visita, status, cliente:clientes(nome, nome_fazenda), funcionario:profiles(nome_completo)')
    .order('created_at', { ascending: false })
    .limit(5)

  if (funcionarioFiltro) ultimasQuery = ultimasQuery.eq('funcionario_id', funcionarioFiltro)

  const [
    { data: visitas },
    { data: kms },
    { data: abastecimentos },
    { data: historico },
    { data: proximasVisitas },
    { data: ultimasVisitas },
    { data: atrasadas, count: totalAtrasadas },
    { data: ultimasPorCliente },
  ] = await Promise.all([
    visitasQuery, kmQuery, abastQuery, historicoQuery, proximasQuery, ultimasQuery,
    supabase
      .from('visitas')
      .select('id, data_visita, cliente:clientes(nome, nome_fazenda), funcionario:profiles(nome_completo)', { count: 'exact' })
      .eq('status', 'agendada')
      .lt('data_visita', hoje)
      .order('data_visita')
      .limit(5),
    supabase.from('visitas').select('cliente_id, data_visita').eq('status', 'realizada').order('data_visita', { ascending: false }),
  ])

  // Clientes sem visita realizada há mais de 60 dias (ou nunca visitados)
  const limite60 = new Date()
  limite60.setDate(limite60.getDate() - 60)
  const limite60ISO = limite60.toISOString().slice(0, 10)
  const ultimaPorCliente = new Map<string, string>()
  ;(ultimasPorCliente ?? []).forEach((v: any) => { if (!ultimaPorCliente.has(v.cliente_id)) ultimaPorCliente.set(v.cliente_id, v.data_visita) })
  const esquecidos = clientesLista
    .map(c => ({ ...c, ultima: ultimaPorCliente.get(c.id) ?? null }))
    .filter(c => !c.ultima || c.ultima < limite60ISO)
    .sort((a, b) => (a.ultima ?? '').localeCompare(b.ultima ?? ''))

  const visitasList = visitas ?? []
  const kmList = kms ?? []
  const abastList = abastecimentos ?? []
  const historicoList = historico ?? []

  // Agrega métricas por colaborador
  const metricasMap = new Map<string, DadosColaborador>()

  for (const c of colab) {
    metricasMap.set(c.id, {
      id: c.id,
      nome: c.nome_completo ?? 'Sem nome',
      realizadas: 0, agendadas: 0, canceladas: 0,
      km: 0, litros: 0, gasto: 0,
    })
  }

  visitasList.forEach((v: any) => {
    const m = metricasMap.get(v.funcionario_id)
    if (!m) return
    if (v.status === 'realizada') m.realizadas++
    else if (v.status === 'agendada') m.agendadas++
    else if (v.status === 'cancelada') m.canceladas++
  })

  kmList.forEach((k: any) => {
    const m = metricasMap.get(k.funcionario_id)
    if (!m) return
    if (k.km_inicial != null && k.km_final != null) {
      m.km += Number(k.km_final) - Number(k.km_inicial)
    }
  })

  abastList.forEach((a: any) => {
    const m = metricasMap.get(a.funcionario_id)
    if (!m) return
    m.litros += Number(a.litros) || 0
    m.gasto += Number(a.valor_total) || 0
  })

  const dadosColaboradores = Array.from(metricasMap.values())

  // KPIs totais
  const totalRealizadas = dadosColaboradores.reduce((s, c) => s + c.realizadas, 0)
  const totalAgendadas = dadosColaboradores.reduce((s, c) => s + c.agendadas, 0)
  const totalKm = dadosColaboradores.reduce((s, c) => s + c.km, 0)
  const totalGasto = dadosColaboradores.reduce((s, c) => s + c.gasto, 0)
  const totalLitros = dadosColaboradores.reduce((s, c) => s + c.litros, 0)
  const totalVisitas = totalRealizadas + totalAgendadas
  const taxaConclusao = totalVisitas > 0 ? Math.round((totalRealizadas / totalVisitas) * 100) : 0

  // Visitas por mês para o chart histórico
  const mesesMap: Record<string, { realizadas: number; agendadas: number }> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    mesesMap[key] = { realizadas: 0, agendadas: 0 }
  }
  historicoList.forEach((v: any) => {
    const key = v.data_visita.slice(0, 7)
    if (mesesMap[key]) {
      if (v.status === 'realizada') mesesMap[key].realizadas++
      if (v.status === 'agendada') mesesMap[key].agendadas++
    }
  })
  const visitasPorMes = Object.entries(mesesMap).map(([key, val]) => ({
    mes: MESES_ABREV[parseInt(key.split('-')[1]) - 1],
    realizadas: val.realizadas,
    agendadas: val.agendadas,
  }))

  const nomePeriodo = inicio === fim
    ? new Date(inicio + 'T12:00').toLocaleDateString('pt-BR')
    : `${new Date(inicio + 'T12:00').toLocaleDateString('pt-BR')} – ${new Date(fim + 'T12:00').toLocaleDateString('pt-BR')}`

  const colabFiltrado = funcionarioFiltro
    ? colab.find(c => c.id === funcionarioFiltro)
    : null

  const horaBR = Number(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }))
  const saudacao = horaBR < 12 ? 'Bom dia' : horaBR < 18 ? 'Boa tarde' : 'Boa noite'
  const primeiroNome = (meuPerfil?.nome_completo ?? '').split(' ')[0]
  const alertas = dadosColaboradores.filter(c => c.agendadas > 0 && c.realizadas === 0)
  const fmtMoeda = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

  return (
    <>
      <style>{`
        .adm-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:1.1rem;margin-bottom:1.4rem}
        .adm-colab-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1.1rem;margin-bottom:1.4rem}
        .adm-colab-card{padding:1.25rem 1.3rem;display:flex;flex-direction:column;gap:1rem}
        .adm-colab-header{display:flex;align-items:center;gap:.75rem}
        .adm-colab-nome{font-weight:700;font-size:.95rem;color:#162a1e}
        .adm-colab-sub{font-size:.7rem;color:#8f978f;margin-top:.15rem}
        .adm-taxa-row{display:flex;justify-content:space-between;align-items:baseline;font-size:.7rem;color:#8f978f;font-weight:700;margin-bottom:.4rem}
        .adm-taxa-row b{font-size:.85rem;color:#162a1e}
        .adm-stats{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #f2efea;border-radius:12px;overflow:hidden}
        .adm-stat{padding:.7rem .75rem;border-right:1px solid #f2efea;min-width:0}
        .adm-stat:last-child{border-right:none}
        .adm-stat-num{font-size:1rem;font-weight:700;color:#162a1e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .adm-stat-label{font-size:.6rem;font-weight:700;color:#8f978f;text-transform:uppercase;letter-spacing:.06em;margin-top:.2rem}
        .adm-stat-sub{font-size:.62rem;color:#b8bdb6;margin-top:.1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .adm-colab-footer{display:flex;justify-content:space-between;align-items:center;gap:.5rem;margin-top:auto}
        .adm-alerta{display:flex;align-items:center;gap:.6rem;background:#fdf3e9;border:1px solid #f5d9bd;color:#a85a14;border-radius:12px;padding:.75rem 1rem;font-size:.78rem;font-weight:700;margin-bottom:1.4rem}
        @media(max-width:900px){.adm-grid-2{grid-template-columns:1fr}}
      `}</style>

      <div className="ui-page-header">
        <div>
          <div className="ui-eyebrow">Painel do administrador</div>
          <div className="ui-title">{saudacao}{primeiroNome ? `, ${primeiroNome}` : ''}</div>
          <div className="ui-sub">
            {colabFiltrado ? `Exibindo dados de ${colabFiltrado.nome_completo}` : `Visão da equipe · ${colab.length} consultor${colab.length !== 1 ? 'es' : ''}`}
            {' · '}{nomePeriodo}
          </div>
        </div>
        <div className="ui-header-actions">
          <Link href="/admin/agenda" className="ui-btn ui-btn-secondary"><IconCalendar /> Agenda</Link>
          <Link href="/admin/visitas/novo" className="ui-btn ui-btn-primary"><IconPlus /> Nova visita</Link>
        </div>
      </div>

      <Suspense fallback={null}>
        <AdminFiltersBar
          clientes={clientesLista}
          funcionarios={colab}
          inicio={inicio}
          fim={fim}
          funcionarioId={funcionarioFiltro}
        />
      </Suspense>

      {/* KPIs */}
      <div className="ui-kpis">
        <div className="ui-kpi">
          <div className="ui-kpi-icon" style={{ background: '#eaf7ef', color: '#27ae60' }}><IconCheck /></div>
          <div className="ui-kpi-body">
            <div className="ui-kpi-label">Visitas realizadas</div>
            <div className="ui-kpi-num">{totalRealizadas}</div>
            <div className="ui-kpi-sub">{totalAgendadas} ainda agendada{totalAgendadas !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div className="ui-kpi">
          <div className="ui-kpi-icon" style={{ background: '#e8ece9', color: '#162a1e' }}><IconTarget /></div>
          <div className="ui-kpi-body">
            <div className="ui-kpi-label">Taxa de conclusão</div>
            <div className="ui-kpi-num">{taxaConclusao}<small>%</small></div>
            <div className="ui-progress" style={{ marginTop: '.5rem', width: 120 }}><span style={{ width: `${taxaConclusao}%` }} /></div>
          </div>
        </div>
        <div className="ui-kpi">
          <div className="ui-kpi-icon" style={{ background: '#e8ece9', color: '#162a1e' }}><IconRoute /></div>
          <div className="ui-kpi-body">
            <div className="ui-kpi-label">KM rodado</div>
            <div className="ui-kpi-num">{totalKm.toLocaleString('pt-BR')}<small>km</small></div>
            <div className="ui-kpi-sub">no período</div>
          </div>
        </div>
        <div className="ui-kpi">
          <div className="ui-kpi-icon" style={{ background: '#fdf3e9', color: '#E67E22' }}><IconFuel /></div>
          <div className="ui-kpi-body">
            <div className="ui-kpi-label">Combustível</div>
            <div className="ui-kpi-num">{fmtMoeda(totalGasto)}</div>
            <div className="ui-kpi-sub">{totalLitros.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} litros abastecidos</div>
          </div>
        </div>
      </div>

      {/* Pendências */}
      <div className="adm-grid-2">
        <div className="ui-card">
          <div className="ui-card-header">
            <div className="ui-card-title" style={{ color: (totalAtrasadas ?? 0) > 0 ? '#c0392b' : undefined }}>
              <IconAlert /> Visitas atrasadas
              {(totalAtrasadas ?? 0) > 0 && <span className="ui-badge ui-badge-cancelada">{totalAtrasadas}</span>}
            </div>
            <Link href="/admin/visitas?status=atrasada" className="ui-card-link">Resolver →</Link>
          </div>
          {!atrasadas?.length ? (
            <div className="ui-empty" style={{ padding: '1.8rem 1rem' }}>
              <div className="ui-empty-title">Nenhuma visita atrasada</div>
              <div className="ui-empty-text">Toda visita agendada com data passada aparece aqui para ser finalizada ou reagendada.</div>
            </div>
          ) : atrasadas.map((v: any) => <LinhaVisita key={v.id} v={{ ...v, status: 'atrasada' }} />)}
        </div>

        <div className="ui-card">
          <div className="ui-card-header">
            <div className="ui-card-title"><IconUsers /> Clientes sem visita há 60+ dias
              {esquecidos.length > 0 && <span className="ui-badge ui-badge-agendada">{esquecidos.length}</span>}
            </div>
            <Link href="/admin/clientes" className="ui-card-link">Ver carteira →</Link>
          </div>
          {esquecidos.length === 0 ? (
            <div className="ui-empty" style={{ padding: '1.8rem 1rem' }}>
              <div className="ui-empty-title">Carteira em dia</div>
              <div className="ui-empty-text">Todos os clientes receberam visita nos últimos 60 dias.</div>
            </div>
          ) : esquecidos.slice(0, 5).map(c => (
            <div key={c.id} className="ui-row">
              <div className="ui-avatar" style={{ borderRadius: 10, background: '#fdf3e9', color: '#E67E22' }}>{c.nome.charAt(0).toUpperCase()}</div>
              <Link href={`/admin/clientes/${c.id}`} className="ui-row-main" style={{ textDecoration: 'none' }}>
                <div className="ui-row-title">{c.nome}</div>
                <div className="ui-row-meta">{c.ultima ? `Última visita em ${new Date(c.ultima + 'T12:00').toLocaleDateString('pt-BR')}` : 'Nunca visitado'}</div>
              </Link>
              <Link href={`/admin/visitas/novo?cliente=${c.id}`} className="ui-btn ui-btn-secondary ui-btn-sm"><IconPlus /> Agendar</Link>
            </div>
          ))}
        </div>
      </div>

      {alertas.length > 0 && (
        <div className="adm-alerta">
          <IconAlert />
          {alertas.length === 1
            ? `${alertas[0].nome} tem visitas agendadas e nenhuma realizada no período.`
            : `${alertas.length} consultores têm visitas agendadas e nenhuma realizada no período.`}
        </div>
      )}

      {/* Próximas visitas + Últimas atividades */}
      <div className="adm-grid-2">
        <div className="ui-card">
          <div className="ui-card-header">
            <div className="ui-card-title"><IconCalendar /> Próximas visitas</div>
            <Link href="/admin/agenda" className="ui-card-link">Ver agenda →</Link>
          </div>
          {!proximasVisitas?.length ? (
            <div className="ui-empty">
              <div className="ui-empty-icon"><IconCalendar /></div>
              <div className="ui-empty-title">Nenhuma visita agendada</div>
              <div className="ui-empty-text">As próximas visitas da equipe aparecem aqui.</div>
            </div>
          ) : proximasVisitas.map((v: any) => <LinhaVisita key={v.id} v={v} />)}
        </div>

        <div className="ui-card">
          <div className="ui-card-header">
            <div className="ui-card-title"><IconActivity /> Últimas atividades</div>
            <Link href="/admin/visitas" className="ui-card-link">Ver todas →</Link>
          </div>
          {!ultimasVisitas?.length ? (
            <div className="ui-empty">
              <div className="ui-empty-icon"><IconActivity /></div>
              <div className="ui-empty-title">Nenhuma atividade ainda</div>
              <div className="ui-empty-text">Visitas registradas pela equipe aparecem aqui.</div>
            </div>
          ) : ultimasVisitas.map((v: any) => <LinhaVisita key={v.id} v={v} />)}
        </div>
      </div>

      {/* Equipe */}
      <div className="ui-section-label">Desempenho da equipe</div>
      {dadosColaboradores.length === 0 ? (
        <div className="ui-card">
          <div className="ui-empty">
            <div className="ui-empty-icon"><IconUsers /></div>
            <div className="ui-empty-title">Nenhum consultor cadastrado</div>
            <div className="ui-empty-text">Quando um colaborador criar a conta, ele aparece aqui.</div>
          </div>
        </div>
      ) : (
        <div className="adm-colab-grid">
          {dadosColaboradores.map(c => {
            const total = c.realizadas + c.agendadas
            const taxa = total > 0 ? Math.round((c.realizadas / total) * 100) : 0
            const consumo = c.litros > 0 ? (c.km / c.litros) : null
            return (
              <div key={c.id} className="ui-card adm-colab-card">
                <div className="adm-colab-header">
                  <div className="ui-avatar ui-avatar-lg">{c.nome.charAt(0).toUpperCase()}</div>
                  <div style={{ minWidth: 0 }}>
                    <Link href={`/admin/consultores/${c.id}`} className="adm-colab-nome" style={{ textDecoration: 'none', display: 'block' }}>{c.nome}</Link>
                    <div className="adm-colab-sub">{total} visita{total !== 1 ? 's' : ''} no período</div>
                  </div>
                </div>

                <div>
                  <div className="adm-taxa-row"><span>Conclusão</span><b>{taxa}%</b></div>
                  <div className="ui-progress">
                    <span style={{ width: `${taxa}%`, background: taxa >= 70 ? '#27ae60' : '#E67E22' }} />
                  </div>
                </div>

                <div className="adm-stats">
                  <div className="adm-stat">
                    <div className="adm-stat-num">{c.realizadas}</div>
                    <div className="adm-stat-label">Realizadas</div>
                    <div className="adm-stat-sub">{c.agendadas} agend. · {c.canceladas} canc.</div>
                  </div>
                  <div className="adm-stat">
                    <div className="adm-stat-num">{c.km.toLocaleString('pt-BR')}</div>
                    <div className="adm-stat-label">KM</div>
                    <div className="adm-stat-sub">{consumo != null ? `${consumo.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km/L` : '—'}</div>
                  </div>
                  <div className="adm-stat">
                    <div className="adm-stat-num">{fmtMoeda(c.gasto)}</div>
                    <div className="adm-stat-label">Combustível</div>
                    <div className="adm-stat-sub">{c.litros.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L</div>
                  </div>
                </div>

                <div className="adm-colab-footer">
                  <Link href={`/admin/agenda?func=${c.id}`} className="ui-btn ui-btn-secondary ui-btn-sm">Ver agenda</Link>
                  <Link href={`/admin/visitas/novo?funcionario=${c.id}`} className="ui-btn ui-btn-ghost ui-btn-sm"><IconPlus /> Agendar</Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Charts */}
      <div className="ui-section-label">Tendências</div>
      <AdminCharts visitasPorMes={visitasPorMes} colaboradores={dadosColaboradores} />
    </>
  )
}

function LinhaVisita({ v }: { v: any }) {
  const d = new Date(v.data_visita + 'T12:00:00')
  return (
    <Link href={`/admin/visitas/${v.id}`} className="ui-row">
      <div className="ui-date">
        <div className="ui-date-dia">{String(d.getDate()).padStart(2, '0')}</div>
        <div className="ui-date-mes">{d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</div>
      </div>
      <div className="ui-row-main">
        <div className="ui-row-title">{v.cliente?.nome ?? 'Cliente removido'}</div>
        <div className="ui-row-meta">
          {v.cliente?.nome_fazenda && <><span className="ui-fazenda">{v.cliente.nome_fazenda}</span><span className="ui-dot-sep" /></>}
          {v.funcionario?.nome_completo && <span>{v.funcionario.nome_completo}</span>}
        </div>
      </div>
      {v.status === 'atrasada'
        ? <span className="ui-badge ui-badge-cancelada">Atrasada</span>
        : <span className={`ui-badge ui-badge-${v.status}`}>{STATUS_LABEL[v.status] ?? v.status}</span>}
    </Link>
  )
}

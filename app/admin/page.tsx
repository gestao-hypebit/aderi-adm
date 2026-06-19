import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { calcRange, defaultFiltros } from '@/lib/dateUtils'
import AdminFiltersBar from './AdminFiltersBar'
import AdminCharts, { type DadosColaborador } from './AdminCharts'
import Link from 'next/link'

type SearchParams = Promise<{ inicio?: string; fim?: string; func?: string }>

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const defaults = defaultFiltros('este-mes')
  const inicio = params.inicio ?? defaults.dataInicio
  const fim = params.fim ?? defaults.dataFim
  const funcionarioFiltro = params.func ?? ''

  const supabase = await createClient()
  const hoje = new Date().toISOString().split('T')[0]

  // Lista de colaboradores e clientes para o filter bar
  const [{ data: colaboradores }, { data: clientes }] = await Promise.all([
    supabase.from('profiles').select('id, nome_completo').eq('role', 'colaborador').order('nome_completo'),
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
  ] = await Promise.all([visitasQuery, kmQuery, abastQuery, historicoQuery, proximasQuery, ultimasQuery])

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

  return (
    <>
      <style>{`
        .adm-page-header{margin-bottom:1.4rem}
        .adm-page-title{font-size:1.4rem;font-weight:700;color:#162a1e}
        .adm-page-sub{font-size:.8rem;color:#aaa;margin-top:.2rem}
        .adm-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:1rem;margin-bottom:1.2rem}
        .adm-kpi{background:#fff;border-radius:12px;padding:1.1rem 1.2rem;box-shadow:0 2px 8px rgba(0,0,0,.05);border-top:3px solid}
        .adm-kpi-num{font-size:1.8rem;font-weight:900;color:#162a1e;line-height:1.1}
        .adm-kpi-label{font-size:.7rem;font-weight:700;color:#aaa;margin-top:.3rem;text-transform:uppercase;letter-spacing:.04em}
        .adm-kpi-sub{font-size:.7rem;color:#aaa;margin-top:.25rem}
        .adm-colab-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.2rem;margin-bottom:1.2rem}
        .adm-colab-card{background:#fff;border-radius:14px;padding:1.3rem}
        .adm-colab-header{display:flex;align-items:center;gap:.7rem;margin-bottom:1.1rem}
        .adm-colab-avatar{width:42px;height:42px;border-radius:50%;background:#162a1e;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.05rem;flex-shrink:0}
        .adm-colab-nome{font-weight:700;font-size:1rem;color:#162a1e}
        .adm-colab-taxa{font-size:.72rem;color:#aaa;margin-top:.1rem}
        .adm-bloco{margin-bottom:1rem}
        .adm-bloco-titulo{font-size:.65rem;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.3rem}
        .adm-bloco-num{font-size:1.4rem;font-weight:700;color:#162a1e;line-height:1}
        .adm-bloco-sub{font-size:.72rem;color:#888;margin-top:.2rem}
        .adm-alert{margin-top:.6rem;padding:.6rem .8rem;background:#fdf3e9;border:1px solid #f5d9bd;border-radius:8px;font-size:.75rem;color:#b5651d}
        .adm-empty{color:#aaa;text-align:center;padding:2rem}
        .adm-link-visitas{display:inline-flex;align-items:center;gap:.4rem;font-size:.72rem;color:#E67E22;font-weight:700;text-decoration:none;margin-top:.8rem}
        .adm-link-visitas:hover{text-decoration:underline}
        .adm-atalhos{display:flex;gap:.8rem;margin-bottom:1.2rem;flex-wrap:wrap}
        .adm-atalho{display:inline-flex;align-items:center;gap:.5rem;background:#fff;border-radius:10px;padding:.65rem 1.1rem;font-size:.78rem;font-weight:700;color:#162a1e;text-decoration:none;box-shadow:0 2px 6px rgba(0,0,0,.05);border:1.5px solid transparent;transition:all .15s}
        .adm-atalho:hover{border-color:#E67E22;color:#E67E22}
        .adm-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.2rem}
        .adm-secao-card{background:#fff;border-radius:12px;padding:1.2rem 1.4rem;box-shadow:0 2px 8px rgba(0,0,0,.05)}
        .adm-secao-titulo{font-size:.82rem;font-weight:700;color:#162a1e;margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between}
        .adm-secao-titulo a{font-size:.72rem;color:#E67E22;text-decoration:none;font-weight:700}
        .adm-visita-row{display:flex;align-items:center;gap:.8rem;padding:.55rem 0;border-bottom:1px solid #f5f3ef;text-decoration:none}
        .adm-visita-row:last-child{border-bottom:none}
        .adm-data-mini{background:#f0ede8;border-radius:6px;padding:.25rem .5rem;text-align:center;min-width:36px;flex-shrink:0}
        .adm-dia-mini{font-size:.88rem;font-weight:900;color:#162a1e;line-height:1}
        .adm-mes-mini{font-size:.58rem;font-weight:700;color:#aaa;text-transform:uppercase}
        .adm-info-mini{flex:1;min-width:0}
        .adm-nome-mini{font-size:.82rem;font-weight:700;color:#162a1e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .adm-fazenda-mini{font-size:.7rem;color:#E67E22;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .adm-colab-mini{font-size:.68rem;color:#aaa;margin-top:.1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .adm-status-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
        .adm-vazio-mini{text-align:center;padding:1.2rem;color:#aaa;font-size:.8rem}
        @media(max-width:768px){.adm-grid-2{grid-template-columns:1fr}}
      `}</style>

      <div className="adm-page-header">
        <div className="adm-page-title">Painel do Administrador</div>
        <div className="adm-page-sub">
          {colabFiltrado ? colabFiltrado.nome_completo : `${colab.length} colaborador(es)`}
          {' · '}{nomePeriodo}
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

      <div className="adm-atalhos">
        <Link href="/admin/visitas" className="adm-atalho">Lista de visitas →</Link>
        <Link href="/admin/relatorios" className="adm-atalho">Relatórios →</Link>
      </div>

      {/* KPIs */}
      <div className="adm-kpis">
        <div className="adm-kpi" style={{ borderTopColor: '#27ae60' }}>
          <div className="adm-kpi-num">{totalRealizadas}</div>
          <div className="adm-kpi-label">Visitas realizadas</div>
          <div className="adm-kpi-sub">{totalAgendadas} agendadas</div>
        </div>
        <div className="adm-kpi" style={{ borderTopColor: '#3498db' }}>
          <div className="adm-kpi-num">{taxaConclusao}%</div>
          <div className="adm-kpi-label">Taxa de conclusão</div>
          <div className="adm-kpi-sub">{totalVisitas} visitas no período</div>
        </div>
        <div className="adm-kpi" style={{ borderTopColor: '#162a1e' }}>
          <div className="adm-kpi-num" style={{ fontSize: '1.4rem' }}>
            {totalKm.toLocaleString('pt-BR')} km
          </div>
          <div className="adm-kpi-label">KM rodado</div>
          <div className="adm-kpi-sub">no período</div>
        </div>
        <div className="adm-kpi" style={{ borderTopColor: '#E67E22' }}>
          <div className="adm-kpi-num" style={{ fontSize: '1.3rem' }}>
            R$ {totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div className="adm-kpi-label">Gasto em combustível</div>
          <div className="adm-kpi-sub">
            {totalLitros.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} litros
          </div>
        </div>
      </div>

      {/* Próximas visitas + Últimas atividades */}
      <div className="adm-grid-2">
        <div className="adm-secao-card">
          <div className="adm-secao-titulo">
            Próximas visitas
            <Link href="/admin/agenda">Ver agenda →</Link>
          </div>
          {!proximasVisitas?.length ? (
            <div className="adm-vazio-mini">Nenhuma visita agendada</div>
          ) : proximasVisitas.map((v: any) => {
            const d = new Date(v.data_visita + 'T12:00:00')
            return (
              <Link key={v.id} href={`/admin/visitas/${v.id}`} className="adm-visita-row">
                <div className="adm-data-mini">
                  <div className="adm-dia-mini">{String(d.getDate()).padStart(2, '0')}</div>
                  <div className="adm-mes-mini">{d.toLocaleDateString('pt-BR', { month: 'short' })}</div>
                </div>
                <div className="adm-info-mini">
                  <div className="adm-nome-mini">{v.cliente?.nome}</div>
                  {v.cliente?.nome_fazenda && <div className="adm-fazenda-mini">{v.cliente.nome_fazenda}</div>}
                  {v.funcionario?.nome_completo && <div className="adm-colab-mini">{v.funcionario.nome_completo}</div>}
                </div>
                <div className="adm-status-dot" style={{ background: '#E67E22' }} />
              </Link>
            )
          })}
        </div>

        <div className="adm-secao-card">
          <div className="adm-secao-titulo">
            Últimas atividades
            <Link href="/admin/visitas">Ver todas →</Link>
          </div>
          {!ultimasVisitas?.length ? (
            <div className="adm-vazio-mini">Nenhuma atividade ainda</div>
          ) : ultimasVisitas.map((v: any) => {
            const d = new Date(v.data_visita + 'T12:00:00')
            const statusCor: Record<string, string> = { agendada: '#E67E22', realizada: '#27ae60', cancelada: '#e74c3c' }
            return (
              <Link key={v.id} href={`/admin/visitas/${v.id}`} className="adm-visita-row">
                <div className="adm-data-mini">
                  <div className="adm-dia-mini">{String(d.getDate()).padStart(2, '0')}</div>
                  <div className="adm-mes-mini">{d.toLocaleDateString('pt-BR', { month: 'short' })}</div>
                </div>
                <div className="adm-info-mini">
                  <div className="adm-nome-mini">{v.cliente?.nome}</div>
                  {v.cliente?.nome_fazenda && <div className="adm-fazenda-mini">{v.cliente.nome_fazenda}</div>}
                  {v.funcionario?.nome_completo && <div className="adm-colab-mini">{v.funcionario.nome_completo}</div>}
                </div>
                <div className="adm-status-dot" style={{ background: statusCor[v.status] || '#aaa' }} />
              </Link>
            )
          })}
        </div>
      </div>

      {/* Charts */}
      <AdminCharts visitasPorMes={visitasPorMes} colaboradores={dadosColaboradores} />

      {/* Cards por colaborador */}
      {dadosColaboradores.length === 0 ? (
        <div className="adm-empty">Nenhum colaborador cadastrado.</div>
      ) : (
        <div className="adm-colab-grid">
          {dadosColaboradores.map(c => {
            const taxa = (c.realizadas + c.agendadas) > 0
              ? Math.round((c.realizadas / (c.realizadas + c.agendadas)) * 100)
              : 0
            const consumo = c.litros > 0 ? (c.km / c.litros) : null
            return (
              <div key={c.id} className="adm-colab-card">
                <div className="adm-colab-header">
                  <div className="adm-colab-avatar">{c.nome.charAt(0).toUpperCase()}</div>
                  <div>
                    <div className="adm-colab-nome">{c.nome}</div>
                    <div className="adm-colab-taxa" style={{ color: taxa >= 70 ? '#27ae60' : '#E67E22' }}>
                      {taxa}% de conclusão
                    </div>
                  </div>
                </div>

                <div className="adm-bloco">
                  <div className="adm-bloco-titulo">Visitas</div>
                  <div className="adm-bloco-num">{c.realizadas} <span style={{ fontSize: '.85rem', color: '#888', fontWeight: 400 }}>realizadas</span></div>
                  <div className="adm-bloco-sub">{c.agendadas} agendadas · {c.canceladas} canceladas</div>
                </div>

                <div className="adm-bloco">
                  <div className="adm-bloco-titulo">KM rodado</div>
                  <div className="adm-bloco-num">{c.km.toLocaleString('pt-BR')} km</div>
                </div>

                <div className="adm-bloco" style={{ marginBottom: 0 }}>
                  <div className="adm-bloco-titulo">Combustível</div>
                  <div className="adm-bloco-num" style={{ fontSize: '1.2rem' }}>
                    R$ {c.gasto.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                  <div className="adm-bloco-sub">
                    {c.litros.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} litros
                    {consumo != null && (
                      <> · {consumo.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km/L</>
                    )}
                  </div>
                </div>

                <Link
                  href={`/admin/agenda?func=${c.id}`}
                  className="adm-link-visitas"
                >
                  Ver agenda →
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

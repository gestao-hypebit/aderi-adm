import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DashboardCharts from './DashboardCharts'

export default async function DashboardHome() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const hoje = new Date().toISOString().split('T')[0]
  const inicioMes = hoje.slice(0,7) + '-01'
  const seteMesesAtras = new Date()
  seteMesesAtras.setMonth(seteMesesAtras.getMonth() - 6)
  const inicioHistorico = seteMesesAtras.toISOString().split('T')[0]
  const dezDiasAtras = new Date()
  dezDiasAtras.setDate(dezDiasAtras.getDate() - 10)
  const dezDiasAtrasStr = dezDiasAtras.toISOString().split('T')[0]

  const [
    { count: totalClientes },
    { count: visitasHoje },
    { count: visitasMes },
    { count: visitasRealizadas },
    { count: visitasAgendadas },
    { count: visitasCanceladas },
    { data: proximasVisitas },
    { data: ultimasVisitas },
    { data: todasVisitas },
    { data: visitasRecentes },
    { data: todosClientes },
  ] = await Promise.all([
    supabase.from('clientes').select('*', { count: 'exact', head: true }),
    supabase.from('visitas').select('*', { count: 'exact', head: true }).eq('data_visita', hoje),
    supabase.from('visitas').select('*', { count: 'exact', head: true }).gte('data_visita', inicioMes),
    supabase.from('visitas').select('*', { count: 'exact', head: true }).eq('status', 'realizada'),
    supabase.from('visitas').select('*', { count: 'exact', head: true }).eq('status', 'agendada'),
    supabase.from('visitas').select('*', { count: 'exact', head: true }).eq('status', 'cancelada'),
    supabase.from('visitas').select('*, cliente:clientes(nome, nome_fazenda)').eq('status', 'agendada').gte('data_visita', hoje).order('data_visita').limit(5),
    supabase.from('visitas').select('*, cliente:clientes(nome, nome_fazenda)').order('created_at', { ascending: false }).limit(5),
    supabase.from('visitas').select('data_visita, status').gte('data_visita', inicioHistorico),
    supabase.from('visitas').select('cliente_id, data_visita').gte('data_visita', dezDiasAtrasStr).eq('status', 'realizada'),
    supabase.from('clientes').select('id, nome, nome_fazenda'),
  ])

  // Clientes sem visita nos últimos 10 dias
  const clientesComVisitaRecente = new Set(visitasRecentes?.map((v: any) => v.cliente_id) || [])
  const alertaClientes = (todosClientes || []).filter((c: any) => !clientesComVisitaRecente.has(c.id))

  // Monta dados por mês para o gráfico
  const mesesMap: Record<string, { realizadas: number; agendadas: number }> = {}
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    mesesMap[key] = { realizadas: 0, agendadas: 0 }
  }

  todasVisitas?.forEach((v: any) => {
    const key = v.data_visita.slice(0,7)
    if (mesesMap[key]) {
      if (v.status === 'realizada') mesesMap[key].realizadas++
      if (v.status === 'agendada') mesesMap[key].agendadas++
    }
  })

  const dadosGrafico = Object.entries(mesesMap).map(([key, val]) => ({
    mes: meses[parseInt(key.split('-')[1]) - 1],
    realizadas: val.realizadas,
    agendadas: val.agendadas,
  }))

  const taxaConclusao = (visitasRealizadas || 0) + (visitasAgendadas || 0) + (visitasCanceladas || 0) > 0
    ? Math.round(((visitasRealizadas || 0) / ((visitasRealizadas || 0) + (visitasAgendadas || 0) + (visitasCanceladas || 0))) * 100)
    : 0

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  const statusCor: Record<string, string> = {
    agendada: '#E67E22',
    realizada: '#27ae60',
    cancelada: '#e74c3c'
  }

  return (
    <>
      <style>{`
        .home-saudacao{margin-bottom:1.5rem}
        .home-saudacao h1{font-size:1.4rem;font-weight:700;color:#162a1e}
        .home-saudacao p{color:#aaa;font-size:.82rem;margin-top:.2rem}
        .cards-resumo{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:1rem;margin-bottom:1.2rem}
        .resumo-card{background:#fff;border-radius:12px;padding:1.2rem;box-shadow:0 2px 8px rgba(0,0,0,.05);border-top:3px solid;position:relative;overflow:hidden}
        .resumo-num{font-size:2rem;font-weight:900;color:#162a1e;line-height:1}
        .resumo-label{font-size:.72rem;color:#aaa;font-weight:700;margin-top:.3rem}
        .resumo-icon{font-size:1.3rem;margin-bottom:.4rem}
        .resumo-sub{font-size:.7rem;color:#aaa;margin-top:.4rem}
        .acoes-rapidas{display:flex;gap:.7rem;margin-bottom:1.2rem;flex-wrap:wrap}
        .btn-acao-home{display:inline-flex;align-items:center;gap:.4rem;padding:.65rem 1.2rem;border-radius:8px;text-decoration:none;font-size:.82rem;font-weight:700;transition:background .2s}
        .alerta-section{margin-bottom:1.2rem}
        .alerta-titulo{font-size:.82rem;font-weight:700;color:#162a1e;margin-bottom:.6rem;display:flex;align-items:center;gap:.4rem}
        .alerta-item{background:#fff8f0;border:1.5px solid #fde8c8;border-radius:10px;padding:.7rem 1rem;margin-bottom:.5rem;display:flex;align-items:center;justify-content:space-between;text-decoration:none;transition:border-color .2s}
        .alerta-item:hover{border-color:#E67E22}
        .alerta-nome{font-size:.82rem;font-weight:700;color:#162a1e}
        .alerta-fazenda{font-size:.72rem;color:#E67E22;font-weight:700}
        .alerta-badge{background:#E67E22;color:#fff;font-size:.68rem;font-weight:700;padding:.2rem .6rem;border-radius:20px;white-space:nowrap}
        .grid-main{display:grid;grid-template-columns:2fr 1fr;gap:1rem;margin-bottom:1rem}
        .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem}
        .secao-card{background:#fff;border-radius:12px;padding:1.2rem 1.4rem;box-shadow:0 2px 8px rgba(0,0,0,.05)}
        .secao-titulo{font-size:.82rem;font-weight:700;color:#162a1e;margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between}
        .secao-titulo a{font-size:.72rem;color:#E67E22;text-decoration:none;font-weight:700}
        .visita-row{display:flex;align-items:center;gap:.8rem;padding:.55rem 0;border-bottom:1px solid #f5f3ef;text-decoration:none}
        .visita-row:last-child{border-bottom:none}
        .visita-data-mini{background:#f0ede8;border-radius:6px;padding:.25rem .5rem;text-align:center;min-width:36px}
        .dia-mini{font-size:.88rem;font-weight:900;color:#162a1e;line-height:1}
        .mes-mini{font-size:.58rem;font-weight:700;color:#aaa;text-transform:uppercase}
        .visita-info-mini{flex:1;min-width:0}
        .visita-nome-mini{font-size:.82rem;font-weight:700;color:#162a1e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .visita-fazenda-mini{font-size:.7rem;color:#E67E22;font-weight:700}
        .status-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
        .vazio-mini{text-align:center;padding:1.2rem;color:#aaa;font-size:.8rem}
        .taxa-wrap{text-align:center;padding:1rem 0}
        .taxa-num{font-size:2.5rem;font-weight:900;color:#27ae60}
        .taxa-label{font-size:.75rem;color:#aaa;font-weight:700}
        .barra-status{margin-top:.8rem}
        .barra-row{display:flex;align-items:center;gap:.6rem;margin-bottom:.5rem;font-size:.75rem}
        .barra-bg{flex:1;height:6px;border-radius:3px;background:#f0ede8;overflow:hidden}
        .barra-fill{height:100%;border-radius:3px;transition:width .5s}
        .barra-val{font-weight:700;color:#162a1e;min-width:20px;text-align:right}
        @media(max-width:768px){.grid-main{grid-template-columns:1fr}.grid-2{grid-template-columns:1fr}}
      `}</style>

      <div className="home-saudacao">
        <h1>{saudacao}! 👋</h1>
        <p>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Cards de resumo */}
      <div className="cards-resumo">
        <div className="resumo-card" style={{borderTopColor:'#162a1e'}}>
          <div className="resumo-icon">👥</div>
          <div className="resumo-num">{totalClientes || 0}</div>
          <div className="resumo-label">Clientes</div>
          <div className="resumo-sub">cadastrados</div>
        </div>
        <div className="resumo-card" style={{borderTopColor:'#E67E22'}}>
          <div className="resumo-icon">📅</div>
          <div className="resumo-num">{visitasHoje || 0}</div>
          <div className="resumo-label">Visitas hoje</div>
          <div className="resumo-sub">{new Date().toLocaleDateString('pt-BR',{day:'numeric',month:'short'})}</div>
        </div>
        <div className="resumo-card" style={{borderTopColor:'#27ae60'}}>
          <div className="resumo-icon">✅</div>
          <div className="resumo-num">{visitasMes || 0}</div>
          <div className="resumo-label">Visitas este mês</div>
          <div className="resumo-sub">{new Date().toLocaleDateString('pt-BR',{month:'long'})}</div>
        </div>
        <div className="resumo-card" style={{borderTopColor:'#9b59b6'}}>
          <div className="resumo-icon">⏳</div>
          <div className="resumo-num">{visitasAgendadas || 0}</div>
          <div className="resumo-label">Agendadas</div>
          <div className="resumo-sub">pendentes</div>
        </div>
        <div className="resumo-card" style={{borderTopColor:'#3498db'}}>
          <div className="resumo-icon">📊</div>
          <div className="resumo-num">{taxaConclusao}%</div>
          <div className="resumo-label">Taxa de conclusão</div>
          <div className="resumo-sub">das visitas</div>
        </div>
      </div>

      {/* Ações rápidas */}
      <div className="acoes-rapidas">
        <Link href="/dashboard/visitas/novo" className="btn-acao-home" style={{background:'#E67E22',color:'#fff'}}>📋 Nova Visita</Link>
        <Link href="/dashboard/clientes/novo" className="btn-acao-home" style={{background:'#162a1e',color:'#fff'}}>👤 Novo Cliente</Link>
        <Link href="/dashboard/relatorios" className="btn-acao-home" style={{background:'#fff',color:'#162a1e',border:'1.5px solid #eae5de'}}>📊 Relatórios</Link>
      </div>

      {/* Alerta clientes sem visita */}
      {alertaClientes.length > 0 && (
        <div className="alerta-section">
          <div className="alerta-titulo">
            ⚠️ Clientes sem visita há mais de 10 dias ({alertaClientes.length})
          </div>
          {alertaClientes.slice(0, 4).map((c: any) => (
            <Link key={c.id} href={`/dashboard/clientes/${c.id}`} className="alerta-item">
              <div>
                <div className="alerta-nome">{c.nome}</div>
                {c.nome_fazenda && <div className="alerta-fazenda">🌾 {c.nome_fazenda}</div>}
              </div>
              <span className="alerta-badge">+10 dias sem visita</span>
            </Link>
          ))}
          {alertaClientes.length > 4 && (
            <Link href="/dashboard/clientes" style={{fontSize:'.78rem',color:'#E67E22',fontWeight:700,textDecoration:'none'}}>
              Ver mais {alertaClientes.length - 4} clientes →
            </Link>
          )}
        </div>
      )}

      {/* Gráfico + Taxa */}
      <div className="grid-main">
        <div className="secao-card">
          <div className="secao-titulo">📈 Visitas nos últimos 6 meses</div>
          <DashboardCharts dados={dadosGrafico} />
        </div>
        <div className="secao-card">
          <div className="secao-titulo">📊 Status geral</div>
          <div className="taxa-wrap">
            <div className="taxa-num">{taxaConclusao}%</div>
            <div className="taxa-label">Taxa de conclusão</div>
          </div>
          <div className="barra-status">
            {[
              { label: 'Realizadas', val: visitasRealizadas || 0, cor: '#27ae60' },
              { label: 'Agendadas', val: visitasAgendadas || 0, cor: '#E67E22' },
              { label: 'Canceladas', val: visitasCanceladas || 0, cor: '#e74c3c' },
            ].map(item => {
              const total = (visitasRealizadas||0)+(visitasAgendadas||0)+(visitasCanceladas||0)
              const pct = total > 0 ? Math.round((item.val/total)*100) : 0
              return (
                <div className="barra-row" key={item.label}>
                  <span style={{color:'#888',minWidth:'70px'}}>{item.label}</span>
                  <div className="barra-bg">
                    <div className="barra-fill" style={{width:`${pct}%`,background:item.cor}}/>
                  </div>
                  <span className="barra-val">{item.val}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Próximas + Últimas */}
      <div className="grid-2">
        <div className="secao-card">
          <div className="secao-titulo">
            📅 Próximas visitas
            <Link href="/dashboard/visitas">Ver todas →</Link>
          </div>
          {!proximasVisitas?.length ? (
            <div className="vazio-mini">Nenhuma visita agendada 🎉</div>
          ) : proximasVisitas.map((v: any) => {
            const d = new Date(v.data_visita + 'T12:00:00')
            return (
              <Link key={v.id} href={`/dashboard/visitas/${v.id}`} className="visita-row">
                <div className="visita-data-mini">
                  <div className="dia-mini">{String(d.getDate()).padStart(2,'0')}</div>
                  <div className="mes-mini">{d.toLocaleDateString('pt-BR',{month:'short'})}</div>
                </div>
                <div className="visita-info-mini">
                  <div className="visita-nome-mini">{v.cliente?.nome}</div>
                  {v.cliente?.nome_fazenda && <div className="visita-fazenda-mini">{v.cliente.nome_fazenda}</div>}
                </div>
                <div className="status-dot" style={{background: statusCor[v.status]}}/>
              </Link>
            )
          })}
        </div>
        <div className="secao-card">
          <div className="secao-titulo">
            🕐 Últimas atividades
            <Link href="/dashboard/visitas">Ver todas →</Link>
          </div>
          {!ultimasVisitas?.length ? (
            <div className="vazio-mini">Nenhuma atividade ainda</div>
          ) : ultimasVisitas.map((v: any) => {
            const d = new Date(v.data_visita + 'T12:00:00')
            return (
              <Link key={v.id} href={`/dashboard/visitas/${v.id}`} className="visita-row">
                <div className="visita-data-mini">
                  <div className="dia-mini">{String(d.getDate()).padStart(2,'0')}</div>
                  <div className="mes-mini">{d.toLocaleDateString('pt-BR',{month:'short'})}</div>
                </div>
                <div className="visita-info-mini">
                  <div className="visita-nome-mini">{v.cliente?.nome}</div>
                  {v.cliente?.nome_fazenda && <div className="visita-fazenda-mini">{v.cliente.nome_fazenda}</div>}
                </div>
                <div className="status-dot" style={{background: statusCor[v.status]}}/>
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}
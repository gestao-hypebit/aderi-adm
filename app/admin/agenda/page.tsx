'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type VisitaRaw = {
  id: string
  data_visita: string
  status: string
  motivo_visita: string | null
  motivo_outro: string | null
  funcionario_id: string
  cliente: { id: string; nome: string; nome_fazenda: string } | { id: string; nome: string; nome_fazenda: string }[]
  funcionario: { nome_completo: string } | { nome_completo: string }[]
}

type Visita = {
  id: string
  data_visita: string
  status: string
  motivo_visita: string | null
  motivo_outro: string | null
  funcionario_id: string
  cliente: { id: string; nome: string; nome_fazenda: string }
  funcionario: { nome_completo: string }
}

type Colaborador = { id: string; nome_completo: string }

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

const statusCor: Record<string, string> = {
  agendada: '#E67E22',
  realizada: '#27ae60',
  cancelada: '#e74c3c',
}

function IconSprout({ color = 'currentColor', size = 12 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M7 20h10"/><path d="M10 20c0-4 .5-8 2-10"/><path d="M14 20c0-4-.5-8-2-10"/><path d="M5 5c1.5 0 3 1 3.5 3C7 8 5 7.5 4 6c-.5-1 0-1 1-1z"/><path d="M19 8c-1.5 0-3 .5-4 2 1.5 1 3 1 4 0 1-.5 1-1.5 0-2z"/></svg>
}
function IconUser({ color = '#888', size = 12 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
}
function IconCalendarEmpty({ color = '#ccc' }: { color?: string }) {
  return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}

function normalizar(raw: VisitaRaw): Visita {
  return {
    ...raw,
    cliente: Array.isArray(raw.cliente) ? raw.cliente[0] : raw.cliente,
    funcionario: Array.isArray(raw.funcionario) ? raw.funcionario[0] : raw.funcionario,
  }
}

export default function AdminAgendaPage() {
  const supabase = createClient()
  const searchParams = useSearchParams()

  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth())
  const [ano, setAno] = useState(hoje.getFullYear())
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [diaSelecionado, setDiaSelecionado] = useState<number | null>(hoje.getDate())
  const [funcionarioId, setFuncionarioId] = useState(() => searchParams.get('func') ?? '')

  useEffect(() => {
    supabase.from('profiles').select('id, nome_completo').eq('role', 'colaborador').order('nome_completo')
      .then(({ data }) => setColaboradores(data || []))
  }, [])

  // Carrega visitas ao mudar mês/ano ou funcionário
  useEffect(() => {
    async function carregar() {
      const inicio = `${ano}-${String(mes + 1).padStart(2, '0')}-01`
      const ultimoDia = new Date(ano, mes + 1, 0).getDate()
      const fim = `${ano}-${String(mes + 1).padStart(2, '0')}-${ultimoDia}`

      let query = supabase
        .from('visitas')
        .select('id, data_visita, status, motivo_visita, motivo_outro, funcionario_id, cliente:clientes(id, nome, nome_fazenda), funcionario:profiles(nome_completo)')
        .gte('data_visita', inicio)
        .lte('data_visita', fim)
        .order('data_visita')

      if (funcionarioId) query = query.eq('funcionario_id', funcionarioId)

      const { data } = await query
      setVisitas((data || []).map(v => normalizar(v as unknown as VisitaRaw)))
    }
    carregar()
  }, [mes, ano, funcionarioId])

  const visitasPorDia: Record<number, Visita[]> = {}
  visitas.forEach(v => {
    const dia = parseInt(v.data_visita.split('-')[2])
    if (!visitasPorDia[dia]) visitasPorDia[dia] = []
    visitasPorDia[dia].push(v)
  })

  const primeiroDia = new Date(ano, mes, 1).getDay()
  const ultimoDia = new Date(ano, mes + 1, 0).getDate()
  const celulas: (number | null)[] = [
    ...Array(primeiroDia).fill(null),
    ...Array.from({ length: ultimoDia }, (_, i) => i + 1)
  ]
  while (celulas.length % 7 !== 0) celulas.push(null)

  function mesAnterior() {
    if (mes === 0) { setMes(11); setAno(a => a - 1) }
    else setMes(m => m - 1)
    setDiaSelecionado(null)
  }
  function proximoMes() {
    if (mes === 11) { setMes(0); setAno(a => a + 1) }
    else setMes(m => m + 1)
    setDiaSelecionado(null)
  }

  const visitasDoDia = diaSelecionado ? (visitasPorDia[diaSelecionado] || []) : []
  const dataParaNovaVisita = diaSelecionado
    ? `${ano}-${String(mes + 1).padStart(2, '0')}-${String(diaSelecionado).padStart(2, '0')}`
    : new Date().toISOString().split('T')[0]
  const colabParam = funcionarioId ? `&funcionario=${funcionarioId}` : ''
  const isHoje = (dia: number) =>
    dia === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear()

  return (
    <>
      <style>{`
        .page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem}
        .page-title{font-size:1.3rem;font-weight:700;color:#162a1e}
        .page-sub{font-size:.8rem;color:#aaa;margin-top:.2rem}
        .btn-nova{display:inline-flex;align-items:center;gap:.5rem;background:#E67E22;color:#fff;padding:.7rem 1.4rem;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.85rem;font-weight:700;border:none;cursor:pointer;transition:background .2s;text-decoration:none}
        .btn-nova:hover{background:#d35400}
        .cal-card{background:#fff;border-radius:16px;padding:1.5rem;box-shadow:0 2px 12px rgba(0,0,0,.06);margin-bottom:1.2rem}
        .cal-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.2rem}
        .cal-mes-ano{font-size:1.05rem;font-weight:700;color:#162a1e}
        .cal-btn{background:#f0ede8;border:none;border-radius:8px;width:34px;height:34px;cursor:pointer;font-size:1rem;color:#162a1e;display:flex;align-items:center;justify-content:center;transition:background .2s}
        .cal-btn:hover{background:#e0dbd2}
        .cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
        .cal-header-dia{text-align:center;font-size:.65rem;font-weight:700;color:#aaa;letter-spacing:.04em;padding:.3rem 0;text-transform:uppercase}
        .cal-cel{min-height:52px;border-radius:10px;padding:4px;cursor:pointer;transition:all .15s;position:relative;display:flex;flex-direction:column;align-items:center}
        .cal-cel:hover{background:#f0ede8}
        .cal-cel.vazia{cursor:default;pointer-events:none}
        .cal-cel.hoje .cal-num{background:#162a1e;color:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center}
        .cal-cel.selecionado{background:#fff8f3;border:1.5px solid #E67E22}
        .cal-cel.tem-visita{background:#fdfaf6}
        .cal-num{font-size:.82rem;font-weight:700;color:#162a1e;width:26px;height:26px;display:flex;align-items:center;justify-content:center;margin-bottom:2px}
        .cal-num.passado{color:#ccc}
        .cal-dots{display:flex;gap:2px;flex-wrap:wrap;justify-content:center;max-width:44px}
        .cal-dot{width:6px;height:6px;border-radius:50%}
        .legenda{display:flex;gap:1rem;margin-top:.8rem;flex-wrap:wrap}
        .legenda-item{display:flex;align-items:center;gap:.4rem;font-size:.72rem;color:#888}
        .legenda-dot{width:8px;height:8px;border-radius:50%}
        .dia-painel{background:#fff;border-radius:16px;padding:1.5rem;box-shadow:0 2px 12px rgba(0,0,0,.06)}
        .dia-titulo{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.2rem;flex-wrap:wrap;gap:.8rem}
        .dia-titulo-texto{font-size:1rem;font-weight:700;color:#162a1e}
        .dia-titulo-sub{font-size:.78rem;color:#aaa;margin-top:.15rem}
        .btn-agendar{display:inline-flex;align-items:center;gap:.4rem;background:#162a1e;color:#fff;padding:.6rem 1.2rem;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.78rem;font-weight:700;text-decoration:none;transition:background .2s}
        .btn-agendar:hover{background:#0d1f14}
        .visita-item{display:flex;align-items:flex-start;gap:.8rem;padding:.9rem 1rem;border-radius:10px;border:1px solid #f0ede8;margin-bottom:.6rem;transition:border-color .2s;cursor:pointer;text-decoration:none}
        .visita-item:hover{border-color:#E67E22;background:#fff8f3}
        .visita-status-bar{width:3px;border-radius:2px;align-self:stretch;flex-shrink:0}
        .visita-info{flex:1;min-width:0}
        .visita-cliente{font-size:.88rem;font-weight:700;color:#162a1e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .visita-fazenda{display:flex;align-items:center;gap:.35rem;font-size:.75rem;color:#E67E22;font-weight:700;margin:.15rem 0}
        .visita-colab{display:flex;align-items:center;gap:.35rem;font-size:.72rem;color:#888}
        .visita-badge{display:inline-flex;align-items:center;gap:.3rem;font-size:.68rem;font-weight:700;padding:.2rem .5rem;border-radius:10px;color:#fff;margin-top:.3rem}
        .dia-vazio{text-align:center;padding:2.5rem 1rem;color:#bbb}
        .dia-vazio-icon{display:flex;justify-content:center;margin-bottom:.5rem}
        .dia-vazio-txt{font-size:.85rem}
        @media(max-width:600px){.cal-cel{min-height:44px}.cal-num{font-size:.75rem}}
      `}</style>

      <div className="page-header">
        <div>
          <div className="page-title">Agenda dos Colaboradores</div>
          <div className="page-sub">Visualize e agende visitas para a equipe</div>
        </div>
        <Link href={`/admin/visitas/novo?data=${dataParaNovaVisita}${colabParam}`} className="btn-nova">
          + Nova Visita
        </Link>
      </div>

      <div style={{background:'#fff',borderRadius:12,padding:'.85rem 1.2rem',boxShadow:'0 2px 8px rgba(0,0,0,.04)',marginBottom:'1.2rem',display:'flex',alignItems:'center',gap:'.65rem'}}>
        <select
          value={funcionarioId}
          onChange={e => setFuncionarioId(e.target.value)}
          style={{padding:'.3rem .6rem',border:'1.5px solid #eae5de',borderRadius:7,fontFamily:"'Comfortaa',sans-serif",fontSize:'.76rem',color:'#162a1e',background:'#fff',outline:'none',cursor:'pointer'}}
        >
          <option value="">Todos os consultores</option>
          {colaboradores.map(f => (
            <option key={f.id} value={f.id}>{f.nome_completo}</option>
          ))}
        </select>
      </div>

      <div className="cal-card">
        <div className="cal-nav">
          <button className="cal-btn" onClick={mesAnterior}>‹</button>
          <div className="cal-mes-ano">{MESES[mes]} {ano}</div>
          <button className="cal-btn" onClick={proximoMes}>›</button>
        </div>

        <div className="cal-grid">
          {DIAS_SEMANA.map(d => (
            <div key={d} className="cal-header-dia">{d}</div>
          ))}
          {celulas.map((dia, i) => {
            if (!dia) return <div key={i} className="cal-cel vazia" />
            const visitasDia = visitasPorDia[dia] || []
            const passado = new Date(ano, mes, dia) < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
            return (
              <div
                key={i}
                className={[
                  'cal-cel',
                  isHoje(dia) ? 'hoje' : '',
                  diaSelecionado === dia ? 'selecionado' : '',
                  visitasDia.length > 0 ? 'tem-visita' : '',
                ].join(' ')}
                onClick={() => setDiaSelecionado(dia === diaSelecionado ? null : dia)}
              >
                <div className={`cal-num${passado && !isHoje(dia) ? ' passado' : ''}`}>{dia}</div>
                {visitasDia.length > 0 && (
                  <div className="cal-dots">
                    {visitasDia.slice(0, 4).map((v, j) => (
                      <div key={j} className="cal-dot" style={{ background: statusCor[v.status] || '#aaa' }} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="legenda">
          <div className="legenda-item"><div className="legenda-dot" style={{background:'#E67E22'}}/>Agendada</div>
          <div className="legenda-item"><div className="legenda-dot" style={{background:'#27ae60'}}/>Realizada</div>
          <div className="legenda-item"><div className="legenda-dot" style={{background:'#e74c3c'}}/>Cancelada</div>
          <div className="legenda-item"><div className="legenda-dot" style={{background:'#162a1e'}}/>Hoje</div>
        </div>
      </div>

      {diaSelecionado && (
        <div className="dia-painel">
          <div className="dia-titulo">
            <div>
              <div className="dia-titulo-texto">{diaSelecionado} de {MESES[mes]} de {ano}</div>
              <div className="dia-titulo-sub">
                {visitasDoDia.length === 0
                  ? 'Nenhuma visita neste dia'
                  : `${visitasDoDia.length} visita${visitasDoDia.length > 1 ? 's' : ''} marcada${visitasDoDia.length > 1 ? 's' : ''}`
                }
              </div>
            </div>
            <Link href={`/admin/visitas/novo?data=${dataParaNovaVisita}${colabParam}`} className="btn-agendar">
              + Agendar neste dia
            </Link>
          </div>

          {visitasDoDia.length === 0 ? (
            <div className="dia-vazio">
              <div className="dia-vazio-icon"><IconCalendarEmpty /></div>
              <div className="dia-vazio-txt">Nenhuma visita agendada para este dia.</div>
            </div>
          ) : (
            visitasDoDia.map(v => {
              const motivo = v.motivo_visita === 'Outros' ? `Outros — ${v.motivo_outro || ''}` : v.motivo_visita
              return (
                <Link key={v.id} href={`/admin/visitas/${v.id}`} className="visita-item">
                  <div className="visita-status-bar" style={{background: statusCor[v.status]}}/>
                  <div className="visita-info">
                    <div className="visita-cliente">{v.cliente?.nome}</div>
                    {v.cliente?.nome_fazenda && (
                      <div className="visita-fazenda"><IconSprout color="#E67E22" />{v.cliente.nome_fazenda}</div>
                    )}
                    <div className="visita-colab"><IconUser />{v.funcionario?.nome_completo}</div>
                    {motivo && <div style={{fontSize:'.72rem',color:'#888',marginTop:'.2rem'}}>{motivo}</div>}
                    <div className="visita-badge" style={{background: statusCor[v.status]}}>
                      {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                    </div>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      )}
    </>
  )
}

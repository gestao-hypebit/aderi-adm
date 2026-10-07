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
const DIAS_SEMANA_LONGO = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']

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

function IconPlus() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function IconChevron({ dir }: { dir: 'left' | 'right' }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points={dir === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6'}/></svg>
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
  const [visao, setVisao] = useState<'mes' | 'lista'>('mes')
  const [funcionarioId, setFuncionarioId] = useState(() => searchParams.get('func') ?? '')

  useEffect(() => {
    supabase.from('profiles').select('id, nome_completo').eq('role', 'colaborador').eq('ativo', true).order('nome_completo')
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

  function irParaHoje() {
    setMes(hoje.getMonth())
    setAno(hoje.getFullYear())
    setDiaSelecionado(hoje.getDate())
  }

  const totalMes = visitas.length
  const realizadasMes = visitas.filter(v => v.status === 'realizada').length
  const agendadasMes = visitas.filter(v => v.status === 'agendada').length
  const diaSemanaSel = diaSelecionado ? DIAS_SEMANA_LONGO[new Date(ano, mes, diaSelecionado).getDay()] : ''

  return (
    <>
      <style>{`
        .ag-colabs{display:flex;gap:.45rem;flex-wrap:wrap;margin-bottom:1.3rem}
        .ag-colab{display:inline-flex;align-items:center;gap:.5rem;background:#fff;border:1.5px solid #eae5de;border-radius:999px;padding:.3rem .85rem .3rem .3rem;font-family:'Comfortaa',sans-serif;font-size:.74rem;font-weight:700;color:#5b6660;cursor:pointer;transition:all .15s}
        .ag-colab:hover{border-color:#cfc8bd;color:#162a1e}
        .ag-colab.ativo{background:#162a1e;border-color:#162a1e;color:#fff}
        .ag-colab.ativo .ui-avatar{background:#E67E22}
        .ag-colab-todos{padding:.45rem .9rem}
        .ag-layout{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:1.2rem;align-items:start}
        .ag-cal{padding:1.3rem 1.4rem 1.2rem}
        .ag-nav{display:flex;align-items:center;gap:.6rem;margin-bottom:1.1rem}
        .ag-mes{font-size:1.1rem;font-weight:700;color:#162a1e;margin-right:auto}
        .ag-mes-resumo{font-size:.7rem;color:#8f978f;font-weight:700;margin-top:.2rem}
        .ag-nav-btn{background:#fff;border:1.5px solid #eae5de;border-radius:9px;width:34px;height:34px;cursor:pointer;color:#162a1e;display:flex;align-items:center;justify-content:center;transition:all .15s}
        .ag-nav-btn:hover{border-color:#E67E22;color:#E67E22}
        .ag-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}
        .ag-dow{text-align:center;font-size:.62rem;font-weight:700;color:#8f978f;letter-spacing:.08em;padding:.3rem 0 .45rem;text-transform:uppercase}
        .ag-cel{min-height:78px;border-radius:11px;padding:.45rem .5rem;cursor:pointer;transition:background .15s,border-color .15s;border:1.5px solid transparent;background:#faf8f5;display:flex;flex-direction:column;gap:.35rem;text-align:left;font-family:'Comfortaa',sans-serif}
        .ag-cel:hover{background:#f3efe9}
        .ag-cel.vazia{background:transparent;cursor:default;pointer-events:none}
        .ag-cel.fim-semana{background:#f7f5f1}
        .ag-cel.selecionado{background:#fff;border-color:#E67E22;box-shadow:0 4px 14px rgba(230,126,34,.15)}
        .ag-num{font-size:.78rem;font-weight:700;color:#162a1e;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:50%}
        .ag-num.passado{color:#b8bdb6}
        .ag-cel.hoje .ag-num{background:#162a1e;color:#fff}
        .ag-pills{display:flex;flex-direction:column;gap:3px;min-width:0}
        .ag-pill{display:flex;align-items:center;gap:.3rem;font-size:.6rem;font-weight:700;border-radius:5px;padding:.15rem .35rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .ag-pill-agendada{background:#fdf3e9;color:#b5651d}
        .ag-pill-realizada{background:#eaf7ef;color:#1e8a4c}
        .ag-pill-cancelada{background:#fdeeec;color:#c0392b;text-decoration:line-through}
        .ag-mais{font-size:.6rem;font-weight:700;color:#8f978f;padding-left:.35rem}
        .ag-legenda{display:flex;gap:1rem;margin-top:1rem;flex-wrap:wrap}
        .ag-lista{display:flex;flex-direction:column;gap:.2rem}
        .ag-lista-dia{display:flex;gap:1rem;padding:.7rem 0;border-bottom:1px solid #f2efea}
        .ag-lista-dia:last-child{border-bottom:none}
        .ag-lista-data{width:52px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:.15rem;background:none;border:none;cursor:pointer;font-family:'Comfortaa',sans-serif;padding-top:.3rem}
        .ag-lista-num{font-size:1.25rem;font-weight:700;color:#162a1e;line-height:1}
        .ag-lista-dow{font-size:.6rem;font-weight:700;color:#8f978f;text-transform:uppercase;letter-spacing:.08em}
        .ag-lista-dia.hoje .ag-lista-num{color:#E67E22}
        .ag-lista-itens{flex:1;min-width:0;display:flex;flex-direction:column;gap:.3rem}
        .ag-lista-item{display:flex;align-items:center;gap:.75rem;padding:.6rem .75rem;border-radius:10px;text-decoration:none;transition:background .15s}
        .ag-lista-item:hover{background:#faf8f5}
        .ag-legenda-item{display:flex;align-items:center;gap:.4rem;font-size:.68rem;color:#8f978f;font-weight:700}
        .ag-legenda-dot{width:8px;height:8px;border-radius:50%}

        .ag-dia{position:sticky;top:80px;overflow:hidden}
        .ag-dia-head{padding:1.2rem 1.3rem 1rem;border-bottom:1px solid #f2efea}
        .ag-dia-semana{font-size:.66rem;font-weight:700;color:#E67E22;text-transform:uppercase;letter-spacing:.1em}
        .ag-dia-titulo{font-size:1.05rem;font-weight:700;color:#162a1e;margin-top:.25rem}
        .ag-dia-sub{font-size:.72rem;color:#8f978f;margin-top:.2rem}
        .ag-dia-head .ui-btn{margin-top:.9rem;width:100%}
        .ag-dia-lista{padding:.6rem;max-height:calc(100vh - 300px);overflow-y:auto}
        .ag-item{display:flex;gap:.75rem;padding:.75rem .8rem;border-radius:11px;text-decoration:none;transition:background .15s}
        .ag-item:hover{background:#faf8f5}
        .ag-item-bar{width:3px;border-radius:3px;align-self:stretch;flex-shrink:0}
        .ag-item-info{flex:1;min-width:0}
        .ag-item-cliente{font-size:.84rem;font-weight:700;color:#162a1e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .ag-item-fazenda{display:flex;align-items:center;gap:.3rem;font-size:.7rem;color:#E67E22;font-weight:700;margin-top:.15rem}
        .ag-item-meta{display:flex;align-items:center;gap:.4rem;font-size:.7rem;color:#8f978f;margin-top:.35rem;flex-wrap:wrap}
        .ag-item-foot{margin-top:.45rem}

        @media(max-width:1100px){.ag-layout{grid-template-columns:1fr}.ag-dia{position:static}.ag-dia-lista{max-height:none}}
        @media(max-width:640px){
          .ag-cal{padding:1rem .8rem}
          .ag-cel{min-height:48px;padding:.3rem;align-items:center}
          .ag-pills{flex-direction:row;justify-content:center;gap:2px}
          .ag-pill{width:6px;height:6px;padding:0;border-radius:50%;font-size:0}
          .ag-pill-agendada{background:#E67E22}.ag-pill-realizada{background:#27ae60}.ag-pill-cancelada{background:#e74c3c}
          .ag-mais{display:none}
        }
      `}</style>

      <div className="ui-page-header">
        <div>
          <div className="ui-title">Agenda da equipe</div>
          <div className="ui-sub">Clique em um dia para ver as visitas e agendar para um consultor</div>
        </div>
        <div className="ui-header-actions">
          <Link href={`/admin/visitas/novo?data=${dataParaNovaVisita}${colabParam}`} className="ui-btn ui-btn-primary">
            <IconPlus /> Nova visita
          </Link>
        </div>
      </div>

      <div className="ag-colabs" role="tablist" aria-label="Filtrar por consultor">
        <button className={`ag-colab ag-colab-todos ${!funcionarioId ? 'ativo' : ''}`} onClick={() => setFuncionarioId('')}>
          Toda a equipe
        </button>
        {colaboradores.map(c => (
          <button key={c.id} className={`ag-colab ${funcionarioId === c.id ? 'ativo' : ''}`} onClick={() => setFuncionarioId(c.id)}>
            <span className="ui-avatar ui-avatar-sm">{(c.nome_completo || '?').charAt(0).toUpperCase()}</span>
            {c.nome_completo}
          </button>
        ))}
      </div>

      <div className="ag-layout">
        <div className="ui-card ag-cal">
          <div className="ag-nav">
            <div>
              <div className="ag-mes">{MESES[mes]} {ano}</div>
              <div className="ag-mes-resumo">
                {totalMes} visita{totalMes !== 1 ? 's' : ''} · {realizadasMes} realizada{realizadasMes !== 1 ? 's' : ''} · {agendadasMes} agendada{agendadasMes !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="ui-segmented" style={{ marginLeft: 'auto' }}>
              <button className={visao === 'mes' ? 'ativo' : ''} onClick={() => setVisao('mes')}>Mês</button>
              <button className={visao === 'lista' ? 'ativo' : ''} onClick={() => setVisao('lista')}>Lista</button>
            </div>
            <button className="ui-btn ui-btn-secondary ui-btn-sm" onClick={irParaHoje}>Hoje</button>
            <button className="ag-nav-btn" onClick={mesAnterior} aria-label="Mês anterior"><IconChevron dir="left" /></button>
            <button className="ag-nav-btn" onClick={proximoMes} aria-label="Próximo mês"><IconChevron dir="right" /></button>
          </div>

          {visao === 'lista' ? (
            <div className="ag-lista">
              {Object.keys(visitasPorDia).length === 0 ? (
                <div className="ui-empty">
                  <div className="ui-empty-title">Nenhuma visita em {MESES[mes]}</div>
                  <Link href={`/admin/visitas/novo${colabParam ? `?${colabParam.slice(1)}` : ''}`} className="ui-btn ui-btn-secondary ui-btn-sm"><IconPlus /> Agendar visita</Link>
                </div>
              ) : Object.keys(visitasPorDia).map(Number).sort((a, b) => a - b).map(dia => {
                const dt = new Date(ano, mes, dia)
                return (
                  <div key={dia} className={`ag-lista-dia ${isHoje(dia) ? 'hoje' : ''}`}>
                    <button className="ag-lista-data" onClick={() => { setDiaSelecionado(dia); setVisao('mes') }}>
                      <span className="ag-lista-num">{dia}</span>
                      <span className="ag-lista-dow">{DIAS_SEMANA[dt.getDay()]}</span>
                    </button>
                    <div className="ag-lista-itens">
                      {visitasPorDia[dia].map(v => (
                        <Link key={v.id} href={`/admin/visitas/${v.id}`} className="ag-lista-item">
                          <span className="ag-item-bar" style={{ background: statusCor[v.status] }} />
                          <span style={{ minWidth: 0, flex: 1 }}>
                            <span className="ag-item-cliente" style={{ display: 'block' }}>{v.cliente?.nome}</span>
                            <span className="ag-item-meta" style={{ marginTop: '.15rem' }}>{v.funcionario?.nome_completo}{v.motivo_visita ? ` · ${v.motivo_visita}` : ''}</span>
                          </span>
                          <span className={`ui-badge ui-badge-${v.status}`}>{v.status.charAt(0).toUpperCase() + v.status.slice(1)}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
          <div className="ag-grid">
            {DIAS_SEMANA.map(d => <div key={d} className="ag-dow">{d}</div>)}
            {celulas.map((dia, i) => {
              if (!dia) return <div key={i} className="ag-cel vazia" />
              const visitasDia = visitasPorDia[dia] || []
              const passado = new Date(ano, mes, dia) < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
              const dow = i % 7
              return (
                <button
                  key={i}
                  className={[
                    'ag-cel',
                    isHoje(dia) ? 'hoje' : '',
                    diaSelecionado === dia ? 'selecionado' : '',
                    dow === 0 || dow === 6 ? 'fim-semana' : '',
                  ].join(' ')}
                  onClick={() => setDiaSelecionado(dia === diaSelecionado ? null : dia)}
                  aria-label={`${dia} de ${MESES[mes]}, ${visitasDia.length} visita(s)`}
                >
                  <span className={`ag-num${passado && !isHoje(dia) ? ' passado' : ''}`}>{dia}</span>
                  {visitasDia.length > 0 && (
                    <span className="ag-pills">
                      {visitasDia.slice(0, 2).map(v => (
                        <span key={v.id} className={`ag-pill ag-pill-${v.status}`}>{v.cliente?.nome?.split(' ')[0] ?? 'Visita'}</span>
                      ))}
                      {visitasDia.length > 2 && <span className="ag-mais">+{visitasDia.length - 2} mais</span>}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          )}

          <div className="ag-legenda">
            <div className="ag-legenda-item"><div className="ag-legenda-dot" style={{ background: '#E67E22' }} />Agendada</div>
            <div className="ag-legenda-item"><div className="ag-legenda-dot" style={{ background: '#27ae60' }} />Realizada</div>
            <div className="ag-legenda-item"><div className="ag-legenda-dot" style={{ background: '#e74c3c' }} />Cancelada</div>
            <div className="ag-legenda-item"><div className="ag-legenda-dot" style={{ background: '#162a1e' }} />Hoje</div>
          </div>
        </div>

        <div className="ui-card ag-dia">
          {!diaSelecionado ? (
            <div className="ui-empty" style={{ padding: '3rem 1.5rem' }}>
              <div className="ui-empty-icon"><IconCalendarEmpty color="currentColor" /></div>
              <div className="ui-empty-title">Selecione um dia</div>
              <div className="ui-empty-text">Clique em um dia do calendário para ver as visitas e agendar.</div>
            </div>
          ) : (
            <>
              <div className="ag-dia-head">
                <div className="ag-dia-semana">{isHoje(diaSelecionado) ? 'Hoje · ' : ''}{diaSemanaSel}</div>
                <div className="ag-dia-titulo">{diaSelecionado} de {MESES[mes]} de {ano}</div>
                <div className="ag-dia-sub">
                  {visitasDoDia.length === 0
                    ? 'Nenhuma visita neste dia'
                    : `${visitasDoDia.length} visita${visitasDoDia.length > 1 ? 's' : ''} marcada${visitasDoDia.length > 1 ? 's' : ''}`}
                </div>
                <Link href={`/admin/visitas/novo?data=${dataParaNovaVisita}${colabParam}`} className="ui-btn ui-btn-dark">
                  <IconPlus /> Agendar neste dia
                </Link>
              </div>
              <div className="ag-dia-lista">
                {visitasDoDia.length === 0 ? (
                  <div className="ui-empty" style={{ padding: '2rem 1rem' }}>
                    <div className="ui-empty-text">Dia livre na agenda{funcionarioId ? ' deste consultor' : ' da equipe'}.</div>
                  </div>
                ) : (
                  visitasDoDia.map(v => {
                    const motivo = v.motivo_visita === 'Outros' ? `Outros — ${v.motivo_outro || ''}` : v.motivo_visita
                    return (
                      <Link key={v.id} href={`/admin/visitas/${v.id}`} className="ag-item">
                        <div className="ag-item-bar" style={{ background: statusCor[v.status] }} />
                        <div className="ag-item-info">
                          <div className="ag-item-cliente">{v.cliente?.nome}</div>
                          {v.cliente?.nome_fazenda && (
                            <div className="ag-item-fazenda"><IconSprout color="#E67E22" />{v.cliente.nome_fazenda}</div>
                          )}
                          <div className="ag-item-meta">
                            <IconUser color="#8f978f" />{v.funcionario?.nome_completo}
                            {motivo && <><span className="ui-dot-sep" />{motivo}</>}
                          </div>
                          <div className="ag-item-foot">
                            <span className={`ui-badge ui-badge-${v.status}`}>{v.status.charAt(0).toUpperCase() + v.status.slice(1)}</span>
                          </div>
                        </div>
                      </Link>
                    )
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

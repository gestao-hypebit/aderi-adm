'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { hojeISO, somarDias } from '@/lib/dateUtils'
import { type Ponto, distanciaRota, linkRotaGoogle, obterPosicao, ordenarRota } from '@/lib/geo'

const Mapa = dynamic(() => import('@/app/components/Mapa'), { ssr: false, loading: () => <div className="ui-skeleton" style={{ height: 380, borderRadius: 12 }} /> })

type Visao = 'mes' | 'semana' | 'dia' | 'lista'
type Rel<T> = T | T[] | null
type Visita = {
  id: string
  data_visita: string
  hora_visita: string | null
  status: string
  motivo_visita: string | null
  motivo_outro: string | null
  funcionario_id: string
  checkin_em: string | null
  cliente: { id: string; nome: string; nome_fazenda: string | null; cidade: string | null; latitude: number | null; longitude: number | null } | null
  funcionario: { nome_completo: string | null } | null
}
type Colaborador = { id: string; nome_completo: string | null }

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const DOW_LONGO = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const STATUS_COR: Record<string, string> = { agendada: '#E67E22', realizada: '#27ae60', cancelada: '#e74c3c' }
const STATUS_LABEL: Record<string, string> = { agendada: 'Agendada', realizada: 'Realizada', cancelada: 'Cancelada' }
// cores por consultor no mapa da equipe (ordem fixa)
const CORES_CONSULTOR = ['#162a1e', '#E67E22', '#2f80ed', '#8e44ad', '#16a085', '#c0392b', '#7f8c8d', '#d35400']

const um = <T,>(r: Rel<T> | undefined): T | null => (Array.isArray(r) ? r[0] ?? null : r ?? null)
const partes = (iso: string) => iso.split('-').map(Number) as [number, number, number]
const dowDe = (iso: string) => { const [a, m, d] = partes(iso); return new Date(Date.UTC(a, m - 1, d)).getUTCDay() }
const inicioSemana = (iso: string) => somarDias(iso, -dowDe(iso))
const inicioMes = (iso: string) => iso.slice(0, 8) + '01'
const fimMes = (iso: string) => { const [a, m] = partes(iso); return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10) }
const dataBR = (iso: string) => iso.split('-').reverse().join('/')

function Ic({ d, size = 15 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" dangerouslySetInnerHTML={{ __html: d }} />
}
const D = {
  mais: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  esq: '<polyline points="15 18 9 12 15 6"/>',
  dir: '<polyline points="9 18 15 12 9 6"/>',
  gps: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/>',
  nav: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
}

export default function Agenda({ admin, base }: { admin: boolean; base: '/admin' | '/dashboard' }) {
  const supabase = createClient()
  const params = useSearchParams()
  const hoje = hojeISO()
  const [visao, setVisao] = useState<Visao>(() => {
    const v = params.get('visao')
    return v === 'semana' || v === 'dia' || v === 'lista' ? v : 'mes'
  })
  const [ref, setRef] = useState(hoje)                 // data de referência (dia selecionado)
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [chaveCarregada, setChaveCarregada] = useState('')
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [funcionarioId, setFuncionarioId] = useState(() => params.get('func') ?? '')
  const [uid, setUid] = useState('')
  const [origem, setOrigem] = useState<Ponto | null>(null)
  const [localizando, setLocalizando] = useState(false)
  const [erroGps, setErroGps] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? ''))
    if (admin) supabase.from('profiles').select('id, nome_completo').eq('role', 'colaborador').eq('ativo', true).order('nome_completo').then(({ data }) => setColaboradores(data ?? []))
  }, [admin])

  // período carregado conforme a visão
  const [ini, fim] = useMemo<[string, string]>(() => {
    if (visao === 'semana') { const s = inicioSemana(ref); return [s, somarDias(s, 6)] }
    if (visao === 'dia') return [ref, ref]
    return [inicioMes(ref), fimMes(ref)]
  }, [visao, ref])

  useEffect(() => {
    if (!admin && !uid) return
    const filtro = admin ? (funcionarioId ? { funcionario_id: funcionarioId } : {}) : { funcionario_id: uid }
    const chave = `${ini}|${fim}|${funcionarioId}|${uid}`
    supabase.from('visitas')
      .select('id, data_visita, hora_visita, status, motivo_visita, motivo_outro, funcionario_id, checkin_em, cliente:clientes(id, nome, nome_fazenda, cidade, latitude, longitude), funcionario:profiles(nome_completo)')
      .gte('data_visita', ini).lte('data_visita', fim).match(filtro)
      .order('data_visita').order('hora_visita', { nullsFirst: false })
      .then(({ data }) => {
        setVisitas(((data ?? []) as unknown as (Visita & { cliente: Rel<Visita['cliente']>; funcionario: Rel<Visita['funcionario']> })[])
          .map(v => ({ ...v, cliente: um(v.cliente), funcionario: um(v.funcionario) })))
        setChaveCarregada(chave)
      })
  }, [ini, fim, funcionarioId, uid, admin])

  const carregando = chaveCarregada !== `${ini}|${fim}|${funcionarioId}|${uid}`

  const porDia = useMemo(() => {
    const m = new Map<string, Visita[]>()
    visitas.forEach(v => { const l = m.get(v.data_visita) ?? []; l.push(v); m.set(v.data_visita, l) })
    return m
  }, [visitas])

  const corConsultor = useMemo(() => {
    const ids = [...new Set(visitas.map(v => v.funcionario_id))].sort()
    return new Map(ids.map((id, i) => [id, CORES_CONSULTOR[i % CORES_CONSULTOR.length]]))
  }, [visitas])

  function mover(delta: number) {
    if (visao === 'semana') setRef(r => somarDias(r, 7 * delta))
    else if (visao === 'dia') setRef(r => somarDias(r, delta))
    else { const [a, m] = partes(ref); setRef(new Date(Date.UTC(a, m - 1 + delta, 1)).toISOString().slice(0, 10)) }
  }
  function irPara(v: Visao, data?: string) { setVisao(v); if (data) setRef(data) }

  async function usarMinhaPosicao() {
    setLocalizando(true); setErroGps('')
    try { const p = await obterPosicao(); setOrigem({ lat: p.lat, lng: p.lng }) } catch (e) { setErroGps((e as Error).message) }
    setLocalizando(false)
  }

  const novaVisita = (data: string) => `${base}/visitas/novo?data=${data}${admin && funcionarioId ? `&funcionario=${funcionarioId}` : ''}`
  const [ra, rm] = partes(ref)
  const titulo = visao === 'semana'
    ? (() => { const s = inicioSemana(ref); const e = somarDias(s, 6); return `${dataBR(s).slice(0, 5)} a ${dataBR(e)}` })()
    : visao === 'dia' ? `${DOW_LONGO[dowDe(ref)]}, ${dataBR(ref)}` : `${MESES[rm - 1]} ${ra}`
  const resumo = `${visitas.length} visita${visitas.length !== 1 ? 's' : ''} · ${visitas.filter(v => v.status === 'realizada').length} realizada(s) · ${visitas.filter(v => v.status === 'agendada').length} agendada(s)`

  return (
    <>
      <style>{AGENDA_CSS}</style>

      <div className="ui-page-header">
        <div>
          <div className="ui-title">{admin ? 'Agenda da equipe' : 'Minha agenda'}</div>
          <div className="ui-sub">Mês, semana ou dia, com a rota das visitas no mapa</div>
        </div>
        <div className="ui-header-actions">
          <Link href={novaVisita(ref)} className="ui-btn ui-btn-primary"><Ic d={D.mais} /> Nova visita</Link>
        </div>
      </div>

      {admin && (
        <div className="ag-colabs" role="tablist" aria-label="Filtrar por consultor">
          <button className={`ag-colab ag-colab-todos ${!funcionarioId ? 'ativo' : ''}`} onClick={() => { setFuncionarioId('') }}>Toda a equipe</button>
          {colaboradores.map(c => (
            <button key={c.id} className={`ag-colab ${funcionarioId === c.id ? 'ativo' : ''}`} onClick={() => { setFuncionarioId(c.id) }}>
              <span className="ui-avatar ui-avatar-sm">{(c.nome_completo || '?').charAt(0).toUpperCase()}</span>{c.nome_completo}
            </button>
          ))}
        </div>
      )}

      <div className="ui-card ag-cal">
        <div className="ag-nav">
          <div style={{ marginRight: 'auto' }}>
            <div className="ag-titulo">{titulo}</div>
            <div className="ag-resumo">{carregando ? 'Carregando...' : resumo}</div>
          </div>
          <div className="ui-segmented">
            {(['mes', 'semana', 'dia', 'lista'] as Visao[]).map(v => (
              <button key={v} className={visao === v ? 'ativo' : ''} onClick={() => irPara(v)}>{v === 'mes' ? 'Mês' : v === 'semana' ? 'Semana' : v === 'dia' ? 'Dia' : 'Lista'}</button>
            ))}
          </div>
          <button className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => { setRef(hoje) }}>Hoje</button>
          <button className="ag-nav-btn" onClick={() => mover(-1)} aria-label="Anterior"><Ic d={D.esq} size={16} /></button>
          <button className="ag-nav-btn" onClick={() => mover(1)} aria-label="Próximo"><Ic d={D.dir} size={16} /></button>
        </div>

        {visao === 'mes' && <VisaoMes refData={ref} hoje={hoje} porDia={porDia} onDia={d => setRef(d)} onAbrirDia={d => irPara('dia', d)} />}
        {visao === 'semana' && <VisaoSemana refData={ref} hoje={hoje} porDia={porDia} base={base} admin={admin} novaVisita={novaVisita} onAbrirDia={d => irPara('dia', d)} />}
        {visao === 'lista' && <VisaoLista porDia={porDia} hoje={hoje} base={base} admin={admin} onAbrirDia={d => irPara('dia', d)} />}
        {visao === 'dia' && (
          <VisaoDia data={ref} visitas={porDia.get(ref) ?? []} base={base} admin={admin} equipe={admin && !funcionarioId}
            corConsultor={corConsultor} origem={origem} localizando={localizando} erroGps={erroGps}
            onPosicao={usarMinhaPosicao} onLimparPosicao={() => setOrigem(null)} novaVisita={novaVisita} carregando={carregando} />
        )}

        {visao !== 'dia' && (
          <div className="ag-legenda">
            {Object.entries(STATUS_LABEL).map(([k, v]) => <span key={k}><i style={{ background: STATUS_COR[k] }} />{v}</span>)}
            <span><i style={{ background: '#162a1e' }} />Hoje</span>
          </div>
        )}
      </div>

      {visao === 'mes' && <PainelDia data={ref} hoje={hoje} visitas={porDia.get(ref) ?? []} base={base} admin={admin} novaVisita={novaVisita} onAbrirDia={() => irPara('dia', ref)} />}
    </>
  )
}

function ItemVisita({ v, base, admin, compacto = false, numero, cor }: { v: Visita; base: string; admin: boolean; compacto?: boolean; numero?: number; cor?: string }) {
  const motivo = v.motivo_visita === 'Outros' ? `Outros — ${v.motivo_outro || ''}` : v.motivo_visita
  return (
    <Link href={`${base}/visitas/${v.id}`} className={`ag-item ${compacto ? 'compacto' : ''}`} style={{ borderLeftColor: STATUS_COR[v.status] }}>
      {numero != null && <span className="ag-num-rota" style={{ background: cor ?? '#162a1e' }}>{numero}</span>}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="ag-item-top">
          {v.hora_visita && <span className="ag-hora">{v.hora_visita.slice(0, 5)}</span>}
          <span className="ag-item-cli">{v.cliente?.nome ?? 'Cliente'}</span>
        </div>
        {!compacto && (
          <div className="ag-item-meta">
            {v.cliente?.nome_fazenda && <span className="laranja">{v.cliente.nome_fazenda}</span>}
            {admin && v.funcionario?.nome_completo && <span>{v.funcionario.nome_completo}</span>}
            {motivo && <span>{motivo}</span>}
            {v.checkin_em && <span className="ok">check-in feito</span>}
          </div>
        )}
      </div>
      {!compacto && <span className={`ui-badge ui-badge-${v.status}`}>{STATUS_LABEL[v.status] ?? v.status}</span>}
    </Link>
  )
}

function VisaoMes({ refData, hoje, porDia, onDia, onAbrirDia }: { refData: string; hoje: string; porDia: Map<string, Visita[]>; onDia: (d: string) => void; onAbrirDia: (d: string) => void }) {
  const ini = inicioMes(refData)
  const total = Number(fimMes(refData).slice(8))
  const celulas: (string | null)[] = [...Array(dowDe(ini)).fill(null), ...Array.from({ length: total }, (_, i) => somarDias(ini, i))]
  while (celulas.length % 7) celulas.push(null)
  return (
    <div className="ag-grid">
      {DOW.map(d => <div key={d} className="ag-dow">{d}</div>)}
      {celulas.map((d, i) => {
        if (!d) return <div key={i} className="ag-cel vazia" />
        const lista = porDia.get(d) ?? []
        return (
          <button key={d} className={`ag-cel ${d === hoje ? 'hoje' : ''} ${d === refData ? 'sel' : ''} ${i % 7 === 0 || i % 7 === 6 ? 'fds' : ''}`}
            onClick={() => onDia(d)} onDoubleClick={() => onAbrirDia(d)} aria-label={`${dataBR(d)}, ${lista.length} visita(s)`}>
            <span className={`ag-n ${d < hoje ? 'passado' : ''}`}>{Number(d.slice(8))}</span>
            {lista.length > 0 && (
              <span className="ag-pills">
                {lista.slice(0, 2).map(v => <span key={v.id} className={`ag-pill ${v.status}`}>{v.cliente?.nome?.split(' ')[0] ?? 'Visita'}</span>)}
                {lista.length > 2 && <span className="ag-mais">+{lista.length - 2}</span>}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function PainelDia({ data, hoje, visitas, base, admin, novaVisita, onAbrirDia }: { data: string; hoje: string; visitas: Visita[]; base: string; admin: boolean; novaVisita: (d: string) => string; onAbrirDia: () => void }) {
  return (
    <div className="ui-card ag-painel">
      <div className="ag-painel-h">
        <div>
          <div className="ag-painel-dow">{data === hoje ? 'Hoje · ' : ''}{DOW_LONGO[dowDe(data)]}</div>
          <div className="ag-painel-t">{dataBR(data)} · {visitas.length ? `${visitas.length} visita${visitas.length > 1 ? 's' : ''}` : 'dia livre'}</div>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          {visitas.length > 0 && <button className="ui-btn ui-btn-secondary ui-btn-sm" onClick={onAbrirDia}><Ic d={D.pin} size={13} /> Ver rota do dia</button>}
          <Link href={novaVisita(data)} className="ui-btn ui-btn-dark ui-btn-sm"><Ic d={D.mais} size={13} /> Agendar neste dia</Link>
        </div>
      </div>
      {visitas.length > 0 && <div className="ag-painel-lista">{visitas.map(v => <ItemVisita key={v.id} v={v} base={base} admin={admin} />)}</div>}
    </div>
  )
}

function VisaoSemana({ refData, hoje, porDia, base, admin, novaVisita, onAbrirDia }: { refData: string; hoje: string; porDia: Map<string, Visita[]>; base: string; admin: boolean; novaVisita: (d: string) => string; onAbrirDia: (d: string) => void }) {
  const ini = inicioSemana(refData)
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(ini, i))
  return (
    <div className="ag-semana">
      {dias.map(d => {
        const lista = porDia.get(d) ?? []
        return (
          <div key={d} className={`ag-col ${d === hoje ? 'hoje' : ''} ${dowDe(d) === 0 || dowDe(d) === 6 ? 'fds' : ''}`}>
            <button className="ag-col-h" onClick={() => onAbrirDia(d)} title="Abrir o dia com a rota">
              <span className="ag-col-dow">{DOW[dowDe(d)]}</span>
              <span className="ag-col-n">{Number(d.slice(8))}</span>
              <span className="ag-col-qtd">{lista.length ? `${lista.length} visita${lista.length > 1 ? 's' : ''}` : 'livre'}</span>
            </button>
            <div className="ag-col-itens">
              {lista.map(v => <ItemVisita key={v.id} v={v} base={base} admin={admin} compacto />)}
              <Link href={novaVisita(d)} className="ag-col-add" aria-label={`Agendar em ${dataBR(d)}`}><Ic d={D.mais} size={13} /></Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function VisaoLista({ porDia, hoje, base, admin, onAbrirDia }: { porDia: Map<string, Visita[]>; hoje: string; base: string; admin: boolean; onAbrirDia: (d: string) => void }) {
  const dias = [...porDia.keys()].sort()
  if (!dias.length) return <div className="ui-empty"><div className="ui-empty-title">Nenhuma visita no mês</div></div>
  return (
    <div>
      {dias.map(d => (
        <div key={d} className={`ag-lista-dia ${d === hoje ? 'hoje' : ''}`}>
          <button className="ag-lista-data" onClick={() => onAbrirDia(d)}><span className="ag-lista-n">{Number(d.slice(8))}</span><span className="ag-lista-dow">{DOW[dowDe(d)]}</span></button>
          <div className="ag-lista-itens">{porDia.get(d)!.map(v => <ItemVisita key={v.id} v={v} base={base} admin={admin} />)}</div>
        </div>
      ))}
    </div>
  )
}

type VisaoDiaProps = {
  data: string; visitas: Visita[]; base: string; admin: boolean; equipe: boolean; corConsultor: Map<string, string>
  origem: Ponto | null; localizando: boolean; erroGps: string; carregando: boolean
  onPosicao: () => void; onLimparPosicao: () => void; novaVisita: (d: string) => string
}

function VisaoDia({ data, visitas, base, admin, equipe, corConsultor, origem, localizando, erroGps, carregando, onPosicao, onLimparPosicao, novaVisita }: VisaoDiaProps) {
  const [ordem, setOrdem] = useState<'horario' | 'otimizada'>('horario')
  const ativas = visitas.filter(v => v.status !== 'cancelada')
  const semLocal = ativas.filter(v => !(v.cliente?.latitude != null && v.cliente?.longitude != null))

  // Ordem da rota: pelo horário marcado ou a mais curta (vizinho mais próximo, partindo da sua posição)
  const rota = useMemo(() => {
    const pts = visitas
      .filter(v => v.status !== 'cancelada' && v.cliente?.latitude != null && v.cliente?.longitude != null)
      .map(v => ({ ...v, lat: v.cliente!.latitude!, lng: v.cliente!.longitude! }))
    if (ordem === 'otimizada') return ordenarRota(pts, origem ?? undefined)
    return [...pts].sort((a, b) => (a.hora_visita ?? '99').localeCompare(b.hora_visita ?? '99'))
  }, [visitas, ordem, origem])

  const km = rota.length ? distanciaRota(rota, origem ?? undefined) : 0
  const linkMaps = equipe ? null : linkRotaGoogle(rota, origem ?? undefined)

  if (carregando) return <div className="ui-skeleton" style={{ height: 380, borderRadius: 12 }} />

  return (
    <div className="ag-dia">
      <div className="ag-dia-lista">
        <div className="ag-dia-acoes">
          <div className="ui-segmented">
            <button className={ordem === 'horario' ? 'ativo' : ''} onClick={() => setOrdem('horario')}>Por horário</button>
            <button className={ordem === 'otimizada' ? 'ativo' : ''} onClick={() => setOrdem('otimizada')}>Rota mais curta</button>
          </div>
          {origem
            ? <button className="ui-btn ui-btn-ghost ui-btn-sm" onClick={onLimparPosicao}>Sem ponto de partida</button>
            : <button className="ui-btn ui-btn-secondary ui-btn-sm" onClick={onPosicao} disabled={localizando}><Ic d={D.gps} size={13} /> {localizando ? 'Localizando...' : 'Partir da minha posição'}</button>}
        </div>
        {erroGps && <div className="ui-alert ui-alert-erro" style={{ fontSize: '.72rem' }}>{erroGps}</div>}

        {ativas.length === 0 ? (
          <div className="ui-empty"><div className="ui-empty-title">Nenhuma visita neste dia</div><Link href={novaVisita(data)} className="ui-btn ui-btn-secondary ui-btn-sm"><Ic d={D.mais} size={13} /> Agendar</Link></div>
        ) : (
          <>
            {rota.map((v, i) => <ItemVisita key={v.id} v={v} base={base} admin={admin} numero={i + 1} cor={equipe ? corConsultor.get(v.funcionario_id) : '#162a1e'} />)}
            {semLocal.length > 0 && (
              <>
                <div className="ag-sem-local">Sem localização cadastrada (fora do mapa):</div>
                {semLocal.map(v => <ItemVisita key={v.id} v={v} base={base} admin={admin} />)}
              </>
            )}
          </>
        )}
        {visitas.some(v => v.status === 'cancelada') && <div className="ag-sem-local">{visitas.filter(v => v.status === 'cancelada').length} visita(s) cancelada(s) fora da rota.</div>}
      </div>

      <div className="ag-dia-mapa">
        <Mapa
          altura={420}
          rota={!equipe}
          origem={origem}
          marcadores={rota.map((v, i) => ({
            id: v.id, lat: v.lat, lng: v.lng, rotulo: String(i + 1),
            titulo: `${i + 1}. ${v.cliente?.nome ?? 'Cliente'}`,
            sub: [v.hora_visita?.slice(0, 5), v.cliente?.nome_fazenda, equipe ? v.funcionario?.nome_completo : null].filter(Boolean).join(' · '),
            cor: equipe ? corConsultor.get(v.funcionario_id) : v.status === 'realizada' ? '#27ae60' : '#162a1e',
          }))}
        />
        <div className="ag-dia-rodape">
          {equipe
            ? <span>Mostrando a equipe toda (cores por consultor). Selecione um consultor para traçar a rota dele.</span>
            : <span>{rota.length} parada{rota.length !== 1 ? 's' : ''}{rota.length ? ` · cerca de ${km.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km em linha reta` : ''}</span>}
          {linkMaps && <a href={linkMaps} target="_blank" rel="noreferrer" className="ui-btn ui-btn-primary ui-btn-sm"><Ic d={D.nav} size={13} /> Abrir navegação no Google Maps</a>}
        </div>
      </div>
    </div>
  )
}

const AGENDA_CSS = `
  .ag-colabs{display:flex;gap:.45rem;flex-wrap:wrap;margin-bottom:1.1rem}
  .ag-colab{display:inline-flex;align-items:center;gap:.5rem;background:#fff;border:1.5px solid #eae5de;border-radius:999px;padding:.3rem .85rem .3rem .3rem;font-family:inherit;font-size:.74rem;font-weight:600;color:#5b6660;cursor:pointer}
  .ag-colab:hover{border-color:#cfc8bd;color:#162a1e}
  .ag-colab.ativo{background:#162a1e;border-color:#162a1e;color:#fff}
  .ag-colab.ativo .ui-avatar{background:#E67E22}
  .ag-colab-todos{padding:.45rem .9rem}
  .ag-cal{padding:1.2rem 1.3rem 1.1rem;margin-bottom:1.1rem}
  .ag-nav{display:flex;align-items:center;gap:.6rem;margin-bottom:1.1rem;flex-wrap:wrap}
  .ag-titulo{font-size:1.1rem;font-weight:600;color:#162a1e}
  .ag-resumo{font-size:.7rem;color:#8f978f;margin-top:.15rem}
  .ag-nav-btn{background:#fff;border:1.5px solid #eae5de;border-radius:9px;width:34px;height:34px;cursor:pointer;color:#162a1e;display:flex;align-items:center;justify-content:center}
  .ag-nav-btn:hover{border-color:#E67E22;color:#E67E22}
  .ag-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}
  .ag-dow{text-align:center;font-size:.62rem;font-weight:600;color:#8f978f;letter-spacing:.08em;padding:.3rem 0 .45rem;text-transform:uppercase}
  .ag-cel{min-height:84px;border-radius:11px;padding:.45rem .5rem;cursor:pointer;border:1.5px solid transparent;background:#faf8f5;display:flex;flex-direction:column;gap:.35rem;text-align:left;font-family:inherit}
  .ag-cel:hover{background:#f3efe9}
  .ag-cel.vazia{background:transparent;pointer-events:none}
  .ag-cel.fds{background:#f7f5f1}
  .ag-cel.sel{background:#fff;border-color:#E67E22;box-shadow:0 4px 14px rgba(230,126,34,.15)}
  .ag-n{font-size:.78rem;font-weight:600;color:#162a1e;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:50%}
  .ag-n.passado{color:#b8bdb6}
  .ag-cel.hoje .ag-n{background:#162a1e;color:#fff}
  .ag-pills{display:flex;flex-direction:column;gap:3px;min-width:0}
  .ag-pill{font-size:.6rem;font-weight:600;border-radius:5px;padding:.15rem .35rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ag-pill.agendada{background:#fdf3e9;color:#b5651d}.ag-pill.realizada{background:#eaf7ef;color:#1e8a4c}.ag-pill.cancelada{background:#fdeeec;color:#c0392b;text-decoration:line-through}
  .ag-mais{font-size:.6rem;font-weight:600;color:#8f978f;padding-left:.35rem}
  .ag-legenda{display:flex;gap:1rem;margin-top:1rem;flex-wrap:wrap;font-size:.68rem;color:#8f978f;font-weight:600}
  .ag-legenda span{display:flex;align-items:center;gap:.4rem}
  .ag-legenda i{width:8px;height:8px;border-radius:50%;display:inline-block}
  .ag-item{display:flex;align-items:center;gap:.7rem;padding:.6rem .75rem;border-radius:10px;text-decoration:none;border-left:3px solid transparent;background:#fff;transition:background .15s}
  .ag-item:hover{background:#faf8f5}
  .ag-item.compacto{padding:.4rem .5rem;border-radius:8px;background:#faf8f5;gap:.4rem}
  .ag-item.compacto:hover{background:#f3efe9}
  .ag-item-top{display:flex;align-items:baseline;gap:.4rem;min-width:0}
  .ag-hora{font-size:.68rem;font-weight:600;color:#8f978f;font-variant-numeric:tabular-nums;flex-shrink:0}
  .ag-item-cli{font-size:.8rem;font-weight:600;color:#162a1e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ag-item.compacto .ag-item-cli{font-size:.7rem}
  .ag-item-meta{display:flex;flex-wrap:wrap;gap:.2rem .7rem;font-size:.68rem;color:#8f978f;margin-top:.15rem}
  .ag-item-meta .laranja{color:#E67E22;font-weight:600}
  .ag-item-meta .ok{color:#1e8a4c;font-weight:600}
  .ag-num-rota{width:24px;height:24px;border-radius:50%;color:#fff;font-size:.7rem;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .ag-painel{overflow:hidden}
  .ag-painel-h{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 1.3rem;flex-wrap:wrap;border-bottom:1px solid #f2efea}
  .ag-painel-dow{font-size:.66rem;font-weight:600;color:#E67E22;text-transform:uppercase;letter-spacing:.1em}
  .ag-painel-t{font-size:1rem;font-weight:600;color:#162a1e;margin-top:.2rem}
  .ag-painel-lista{padding:.5rem;display:flex;flex-direction:column;gap:.2rem}
  .ag-semana{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
  .ag-col{background:#faf8f5;border-radius:12px;display:flex;flex-direction:column;min-height:280px;border:1.5px solid transparent}
  .ag-col.fds{background:#f5f3ef}
  .ag-col.hoje{border-color:#162a1e;background:#fff}
  .ag-col-h{display:flex;flex-direction:column;align-items:center;gap:.05rem;padding:.6rem .3rem .5rem;border:none;background:none;cursor:pointer;font-family:inherit;border-bottom:1px solid #eee9e1}
  .ag-col-h:hover .ag-col-n{color:#E67E22}
  .ag-col-dow{font-size:.62rem;font-weight:600;color:#8f978f;text-transform:uppercase;letter-spacing:.08em}
  .ag-col-n{font-size:1.25rem;font-weight:600;color:#162a1e}
  .ag-col.hoje .ag-col-n{color:#E67E22}
  .ag-col-qtd{font-size:.6rem;color:#8f978f}
  .ag-col-itens{display:flex;flex-direction:column;gap:4px;padding:6px;flex:1}
  .ag-col-add{margin-top:auto;display:flex;align-items:center;justify-content:center;height:28px;border-radius:8px;color:#b8bdb6;border:1px dashed #ddd6cc;text-decoration:none}
  .ag-col-add:hover{color:#E67E22;border-color:#E67E22}
  .ag-lista-dia{display:flex;gap:1rem;padding:.7rem 0;border-bottom:1px solid #f2efea}
  .ag-lista-dia:last-child{border-bottom:none}
  .ag-lista-data{width:52px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:.15rem;background:none;border:none;cursor:pointer;font-family:inherit;padding-top:.3rem}
  .ag-lista-n{font-size:1.25rem;font-weight:600;color:#162a1e;line-height:1}
  .ag-lista-dow{font-size:.6rem;font-weight:600;color:#8f978f;text-transform:uppercase}
  .ag-lista-dia.hoje .ag-lista-n{color:#E67E22}
  .ag-lista-itens{flex:1;min-width:0;display:flex;flex-direction:column;gap:.2rem}
  .ag-dia{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:1.1rem;align-items:start}
  .ag-dia-lista{display:flex;flex-direction:column;gap:.3rem}
  .ag-dia-acoes{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin-bottom:.5rem}
  .ag-sem-local{font-size:.68rem;font-weight:600;color:#c0651a;margin:.6rem 0 .1rem}
  .ag-dia-mapa{position:sticky;top:80px}
  .ag-dia-rodape{display:flex;align-items:center;justify-content:space-between;gap:.8rem;flex-wrap:wrap;margin-top:.7rem;font-size:.72rem;color:#5b6660}
  @media(max-width:1000px){.ag-dia{grid-template-columns:1fr}.ag-dia-mapa{position:static;order:-1}.ag-semana{grid-template-columns:1fr}.ag-col{min-height:auto}.ag-col-h{flex-direction:row;justify-content:flex-start;gap:.6rem;padding:.6rem .8rem}}
  @media(max-width:640px){
    .ag-cal{padding:1rem .8rem}
    .ag-cel{min-height:48px;padding:.3rem;align-items:center}
    .ag-pills{flex-direction:row;justify-content:center;gap:2px}
    .ag-pill{width:6px;height:6px;padding:0;border-radius:50%;font-size:0}
    .ag-pill.agendada{background:#E67E22}.ag-pill.realizada{background:#27ae60}.ag-pill.cancelada{background:#e74c3c}
    .ag-mais{display:none}
  }
`

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const VERDE = '#162a1e'
const LARANJA = '#E67E22'

type View = 'calendario' | 'dia' | 'km' | 'abastecimento'

type KmDiario = {
  id?: string
  data: string
  km_inicial: number | null
  km_final: number | null
}

type Abastecimento = {
  id: string
  data: string
  litros: number
  valor_total: number
  km: number
}

// ===== Ícones =====
function IconChart({ color = VERDE }: { color?: string }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
}
function IconCar({ color = VERDE }: { color?: string }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M5 17h14M5 17a2 2 0 0 1-2-2v-2a2 2 0 0 1 .5-1.32L5.5 9a2 2 0 0 1 1.5-.68h10a2 2 0 0 1 1.5.68l2 2.68A2 2 0 0 1 21 13v2a2 2 0 0 1-2 2"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/></svg>
}
function IconFuel({ color = VERDE }: { color?: string }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><line x1="3" y1="22" x2="15" y2="22"/><line x1="4" y1="9" x2="14" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2v0a2 2 0 0 0 2-2V9.5a2 2 0 0 0-.59-1.41L18 5"/></svg>
}

export default function ControleKmPage() {
  const supabase = createClient()
  const [view, setView] = useState<View>('calendario')
  const [mesAtual, setMesAtual] = useState(new Date())
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null)

  const [kmDoDia, setKmDoDia] = useState<KmDiario | null>(null)
  const [abastecimentosDoDia, setAbastecimentosDoDia] = useState<Abastecimento[]>([])
  const [loadingDia, setLoadingDia] = useState(false)

  const [kmInicialInput, setKmInicialInput] = useState('')
  const [kmFinalInput, setKmFinalInput] = useState('')
  const [savingInicial, setSavingInicial] = useState(false)
  const [savingFinal, setSavingFinal] = useState(false)

  const [litros, setLitros] = useState('')
  const [valorTotal, setValorTotal] = useState('')
  const [kmAbastecimento, setKmAbastecimento] = useState('')
  const [savingAbastecimento, setSavingAbastecimento] = useState(false)

  const [diasComKm, setDiasComKm] = useState<Record<string, { km: boolean; abastecimento: boolean; pendente: boolean }>>({})

  const hojeStr = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    carregarMes()
  }, [mesAtual])

  useEffect(() => {
    selecionarDia(hojeStr)
  }, [])

  async function carregarMes() {
    const ano = mesAtual.getFullYear()
    const mes = mesAtual.getMonth()
    const inicio = new Date(ano, mes, 1).toISOString().slice(0, 10)
    const fim = new Date(ano, mes + 1, 0).toISOString().slice(0, 10)

    const { data: kms } = await supabase
      .from('km_diario')
      .select('data, km_inicial, km_final')
      .gte('data', inicio)
      .lte('data', fim)

    const { data: abastecimentos } = await supabase
      .from('abastecimentos')
      .select('data')
      .gte('data', inicio)
      .lte('data', fim)

    const mapa: Record<string, { km: boolean; abastecimento: boolean; pendente: boolean }> = {}

    kms?.forEach((k) => {
      const completo = k.km_inicial !== null && k.km_final !== null
      const pendente = k.km_inicial !== null && k.km_final === null
      mapa[k.data] = { ...mapa[k.data], km: completo, pendente, abastecimento: mapa[k.data]?.abastecimento || false }
    })

    abastecimentos?.forEach((a) => {
      mapa[a.data] = { ...mapa[a.data], abastecimento: true, km: mapa[a.data]?.km || false, pendente: mapa[a.data]?.pendente || false }
    })

    setDiasComKm(mapa)
  }

  async function selecionarDia(dataStr: string) {
    setDiaSelecionado(dataStr)
    setLoadingDia(true)
    setView('dia')

    const { data: km } = await supabase
      .from('km_diario')
      .select('*')
      .eq('data', dataStr)
      .maybeSingle()

    const { data: abastecimentos } = await supabase
      .from('abastecimentos')
      .select('*')
      .eq('data', dataStr)
      .order('created_at', { ascending: true })

    setKmDoDia(km || { data: dataStr, km_inicial: null, km_final: null })
    setAbastecimentosDoDia(abastecimentos || [])
    setKmInicialInput(km?.km_inicial?.toString() || '')
    setKmFinalInput(km?.km_final?.toString() || '')
    setLoadingDia(false)
  }

  async function salvarKmInicial() {
    if (!diaSelecionado || kmInicialInput === '') return
    setSavingInicial(true)
    const { data: userData } = await supabase.auth.getUser()
    const funcionario_id = userData.user?.id

    const { error } = await supabase
      .from('km_diario')
      .upsert(
        {
          funcionario_id,
          data: diaSelecionado,
          km_inicial: Number(kmInicialInput),
          km_final: kmDoDia?.km_final ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'funcionario_id,data' }
      )

    setSavingInicial(false)
    if (error) { alert('Erro ao salvar KM inicial: ' + error.message); return }
    setKmDoDia((prev) => ({ ...(prev as KmDiario), km_inicial: Number(kmInicialInput) }))
    carregarMes()
  }

  async function salvarKmFinal() {
    if (!diaSelecionado || kmFinalInput === '') return
    setSavingFinal(true)
    const { data: userData } = await supabase.auth.getUser()
    const funcionario_id = userData.user?.id

    const { error } = await supabase
      .from('km_diario')
      .upsert(
        {
          funcionario_id,
          data: diaSelecionado,
          km_inicial: kmDoDia?.km_inicial ?? null,
          km_final: Number(kmFinalInput),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'funcionario_id,data' }
      )

    setSavingFinal(false)
    if (error) { alert('Erro ao salvar KM final: ' + error.message); return }
    setKmDoDia((prev) => ({ ...(prev as KmDiario), km_final: Number(kmFinalInput) }))
    carregarMes()
  }

  async function salvarAbastecimento() {
    if (!diaSelecionado || !litros || !valorTotal || !kmAbastecimento) {
      alert('Preenche todos os campos')
      return
    }
    setSavingAbastecimento(true)
    const { data: userData } = await supabase.auth.getUser()
    const funcionario_id = userData.user?.id

    const { error } = await supabase.from('abastecimentos').insert({
      funcionario_id,
      data: diaSelecionado,
      litros: Number(litros),
      valor_total: Number(valorTotal),
      km: Number(kmAbastecimento),
    })

    setSavingAbastecimento(false)
    if (error) { alert('Erro ao salvar abastecimento: ' + error.message); return }

    setLitros('')
    setValorTotal('')
    setKmAbastecimento('')
    await selecionarDia(diaSelecionado)
    setView('dia')
    carregarMes()
  }

  function diasDoMes() {
    const ano = mesAtual.getFullYear()
    const mes = mesAtual.getMonth()
    const totalDias = new Date(ano, mes + 1, 0).getDate()
    const primeiroDiaSemana = new Date(ano, mes, 1).getDay()
    const dias: (number | null)[] = Array(primeiroDiaSemana).fill(null)
    for (let d = 1; d <= totalDias; d++) dias.push(d)
    return dias
  }

  function formatarData(dia: number) {
    const ano = mesAtual.getFullYear()
    const mes = (mesAtual.getMonth() + 1).toString().padStart(2, '0')
    const diaStr = dia.toString().padStart(2, '0')
    return `${ano}-${mes}-${diaStr}`
  }

  return (
    <div>
      <div className="page-header">
        <h1><IconChart /> Controle de KM</h1>
        <p className="subtitle">
          {(view === 'calendario' || view === 'dia') && 'Clique em um dia para lançar KM ou abastecimento'}
          {view === 'km' && 'Preencha KM inicial e/ou final do dia'}
          {view === 'abastecimento' && 'Registre os dados do abastecimento'}
        </p>
      </div>

      {/* ---------- VIEW: CALENDÁRIO ---------- */}
      {(view === 'calendario' || view === 'dia') && (
        <div className="calendar-card">
          <div className="calendar-nav">
            <button onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() - 1, 1))} className="nav-btn">‹</button>
            <h2>{mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h2>
            <button onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 1))} className="nav-btn">›</button>
          </div>

          <div className="weekdays">
            {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((d) => (
              <div key={d} className="weekday">{d}</div>
            ))}
          </div>

          <div className="days-grid">
            {diasDoMes().map((dia, idx) => {
              if (!dia) return <div key={idx} className="day empty" />
              const dataStr = formatarData(dia)
              const status = diasComKm[dataStr]
              const isHoje = dataStr === hojeStr
              const isSelecionado = dataStr === diaSelecionado
              const temAlgo = status?.km || status?.abastecimento || status?.pendente

              return (
                <button
                  key={idx}
                  onClick={() => selecionarDia(dataStr)}
                  className={`day ${temAlgo ? 'tem-registro' : ''} ${isHoje ? 'hoje' : ''} ${isSelecionado ? 'selecionado' : ''}`}
                >
                  <span className="day-number">{dia}</span>
                  <div className="day-dots">
                    {status?.km && <span className="dot dot-laranja" />}
                    {status?.pendente && <span className="dot dot-amarelo" />}
                    {status?.abastecimento && <span className="dot dot-verde" />}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="legend">
            <span><span className="dot dot-laranja" /> KM completo</span>
            <span><span className="dot dot-amarelo" /> KM pendente</span>
            <span><span className="dot dot-verde" /> Abastecimento</span>
            <span><span className="dot dot-preto" /> Hoje</span>
          </div>
        </div>
      )}

      {/* ---------- PAINEL INFERIOR (dia / km / abastecimento) ---------- */}
      {diaSelecionado && (view === 'dia' || view === 'calendario' || view === 'km' || view === 'abastecimento') && (
        <div className="bottom-panel">
          <div className="bottom-header">
            <div>
              <h3>
                {new Date(diaSelecionado + 'T00:00:00').toLocaleDateString('pt-BR', {
                  weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
                })}
              </h3>
            </div>
            {view !== 'dia' && (
              <button
                className="voltar-btn"
                onClick={() => setView('dia')}
              >
                ‹ Voltar
              </button>
            )}
          </div>

          {/* VIEW: DIA */}
          {view === 'dia' && (
            loadingDia ? <p className="muted">Carregando...</p> : (
              <div className="cards-grid">
                <div className="info-card">
                  <div className="info-card-title"><IconCar /> KM do dia</div>
                  {kmDoDia?.km_inicial !== null && kmDoDia?.km_final !== null ? (
                    <div className="info-card-value">
                      {kmDoDia?.km_inicial} → {kmDoDia?.km_final} km
                      <span className="highlight"> ({(kmDoDia!.km_final! - kmDoDia!.km_inicial!).toFixed(0)} km rodados)</span>
                    </div>
                  ) : kmDoDia?.km_inicial !== null ? (
                    <div className="info-card-value muted">KM inicial: {kmDoDia?.km_inicial} · final pendente</div>
                  ) : (
                    <div className="muted">Nenhum KM lançado ainda</div>
                  )}
                  <button className="action-btn laranja" onClick={() => setView('km')}>
                    {kmDoDia?.km_inicial === null ? 'Lançar KM' : 'Editar KM'}
                  </button>
                </div>

                <div className="info-card">
                  <div className="info-card-title"><IconFuel /> Abastecimento</div>
                  {abastecimentosDoDia.length === 0 ? (
                    <div className="muted">Nenhum abastecimento hoje</div>
                  ) : (
                    <div className="abastecimento-list">
                      {abastecimentosDoDia.map((a) => (
                        <div key={a.id} className="abastecimento-item">
                          <div className="abastecimento-main">
                            <span className="abastecimento-litros">{a.litros}L</span>
                            <span className="abastecimento-valor">R$ {a.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="abastecimento-km">KM {a.km}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button className="action-btn verde" onClick={() => setView('abastecimento')}>
                    + Lançar Abastecimento
                  </button>
                </div>
              </div>
            )
          )}

          {/* VIEW: KM */}
          {view === 'km' && (
            <div className="cards-grid">
              <div className="info-card">
                <label className="field-label">KM inicial</label>
                <div className="field-row">
                  <input type="number" value={kmInicialInput} onChange={(e) => setKmInicialInput(e.target.value)} placeholder="Ex: 45230" />
                  <button className="save-btn" onClick={salvarKmInicial} disabled={savingInicial}>
                    {savingInicial ? '...' : 'Salvar'}
                  </button>
                </div>
              </div>

              <div className="info-card">
                <label className="field-label">KM final</label>
                <div className="field-row">
                  <input type="number" value={kmFinalInput} onChange={(e) => setKmFinalInput(e.target.value)} placeholder="Ex: 45380" />
                  <button className="save-btn" onClick={salvarKmFinal} disabled={savingFinal}>
                    {savingFinal ? '...' : 'Salvar'}
                  </button>
                </div>
                <p className="hint">Pode salvar o inicial agora e lançar o final no fim do dia</p>
              </div>
            </div>
          )}

          {/* VIEW: ABASTECIMENTO */}
          {view === 'abastecimento' && (
            <div className="info-card full">
              <label className="field-label">Litros</label>
              <input type="number" value={litros} onChange={(e) => setLitros(e.target.value)} placeholder="Ex: 35.5" className="full-input" />

              <label className="field-label">Valor total (R$)</label>
              <input type="number" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} placeholder="Ex: 210.00" className="full-input" />

              <label className="field-label">KM no momento do abastecimento</label>
              <input type="number" value={kmAbastecimento} onChange={(e) => setKmAbastecimento(e.target.value)} placeholder="Ex: 45300" className="full-input" />

              <button className="save-btn full" onClick={salvarAbastecimento} disabled={savingAbastecimento}>
                {savingAbastecimento ? 'Salvando...' : 'Salvar Abastecimento'}
              </button>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .page-header { margin-bottom: 1.5rem; }
        .page-header h1 { font-size: 1.5rem; font-weight: 700; color: ${VERDE}; display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .subtitle { color: #999; font-size: 0.9rem; }

        .calendar-card, .bottom-panel { background: #fff; border-radius: 16px; padding: 1.25rem 1.5rem; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
        .bottom-panel { margin-top: 1.5rem; }

        .calendar-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
        .calendar-nav h2 { font-size: 1.1rem; font-weight: 700; color: ${VERDE}; }
        .nav-btn { background: none; border: none; font-size: 1.5rem; color: ${VERDE}; cursor: pointer; padding: 4px 12px; border-radius: 6px; }
        .nav-btn:hover { background: #f0ede8; }

        .weekdays { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 4px; }
        .weekday { text-align: center; font-size: 0.7rem; font-weight: 700; color: #aaa; letter-spacing: 0.05em; padding: 4px 0; }

        .days-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
        .day {
          height: 44px;
          aspect-ratio: unset;
          border: 1px solid transparent;
          border-radius: 10px;
          background: transparent;
          color: #444;
          font-weight: 500;
          font-size: 0.9rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s;
          gap: 3px;
        }
        .day.empty { cursor: default; }
        .day:not(.empty):hover { background: #f5f3ef; }
        .day.tem-registro { background: #fdf6ed; border-color: #f5e6cf; }
        .day.hoje .day-number { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: ${VERDE}; color: #fff; font-weight: 700; }
        .day.selecionado { border-color: ${LARANJA}; background: #fdf1e3; }

        .day-dots { display: flex; gap: 3px; height: 6px; }
        .dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
        .dot-laranja { background: ${LARANJA}; }
        .dot-verde { background: #2e7d32; }
        .dot-amarelo { background: #e6b800; }
        .dot-preto { background: ${VERDE}; }

        .legend { display: flex; gap: 1.5rem; margin-top: 1.25rem; font-size: 0.78rem; color: #888; flex-wrap: wrap; }
        .legend span { display: flex; align-items: center; gap: 6px; }

        .bottom-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; }
        .bottom-header h3 { font-size: 1.05rem; font-weight: 700; color: ${VERDE}; }
        .voltar-btn { background: none; border: none; color: ${LARANJA}; font-weight: 700; font-size: 0.85rem; cursor: pointer; }

        .cards-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        @media (max-width: 700px) { .cards-grid { grid-template-columns: 1fr; } }

        .info-card { background: #f9f7f4; border-radius: 12px; padding: 1.25rem; }
        .info-card.full { grid-column: 1 / -1; }
        .info-card-title { display: flex; align-items: center; gap: 8px; font-weight: 700; color: ${VERDE}; margin-bottom: 8px; font-size: 0.95rem; }
        .info-card-value { color: #333; font-size: 0.95rem; margin-bottom: 4px; }
        .muted { color: #aaa; }
        .highlight { color: ${LARANJA}; font-weight: 700; }

        .field-label { display: block; font-size: 0.75rem; font-weight: 700; color: #999; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em; }
        .field-row { display: flex; gap: 8px; }
        input { flex: 1; padding: 10px 12px; border-radius: 8px; border: 1px solid #e5e0d8; font-family: inherit; font-size: 0.95rem; background: #fff; }
        .full-input { width: 100%; margin-bottom: 1rem; }
        input:focus { outline: none; border-color: ${LARANJA}; }

        .save-btn { background: ${VERDE}; color: #fff; border: none; border-radius: 8px; padding: 10px 18px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .save-btn:disabled { opacity: 0.6; }
        .save-btn.full { width: 100%; margin-top: 4px; }

        .action-btn { width: 100%; border: none; border-radius: 8px; padding: 10px 16px; font-weight: 700; color: #fff; cursor: pointer; margin-top: 12px; font-family: inherit; }
        .action-btn.laranja { background: ${LARANJA}; }
        .action-btn.verde { background: ${VERDE}; }

        .abastecimento-list { display: flex; flex-direction: column; gap: 6px; }
        .abastecimento-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #fff;
          border: 1px solid #eee5d8;
          border-radius: 8px;
          padding: 8px 12px;
        }
        .abastecimento-main { display: flex; align-items: center; gap: 10px; }
        .abastecimento-litros { font-weight: 700; color: ${VERDE}; font-size: 0.9rem; }
        .abastecimento-valor { color: ${LARANJA}; font-weight: 700; font-size: 0.9rem; }
        .abastecimento-km { color: #aaa; font-size: 0.8rem; font-weight: 600; }

        .hint { font-size: 0.75rem; color: #aaa; margin-top: 8px; }
      `}</style>
    </div>
  )
}
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import FiltrosPainel from '@/app/components/FiltrosPainel'
import { type Filtros, defaultFiltros } from '@/lib/dateUtils'

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

type DiaRow = { data: string; km: number; litros: number; gasto: number }
type MesRow = { mesKey: string; label: string; km: number; litros: number; gasto: number; dias: DiaRow[] }
type Secao = { id: string; nome: string; meses: MesRow[] }
type Funcionario = { id: string; nome_completo: string }

function buildSecoes(
  kmData: any[],
  abastData: any[],
  funcionarios: Funcionario[],
  isAdmin: boolean,
  funcionarioId: string,
): Secao[] {
  function buildSecao(id: string, nome: string, kms: any[], abasts: any[]): Secao {
    const diaMap = new Map<string, DiaRow>()
    kms.forEach(k => {
      const km = Math.max(0, (Number(k.km_final) || 0) - (Number(k.km_inicial) || 0))
      if (!diaMap.has(k.data)) diaMap.set(k.data, { data: k.data, km: 0, litros: 0, gasto: 0 })
      diaMap.get(k.data)!.km += km
    })
    abasts.forEach(a => {
      if (!diaMap.has(a.data)) diaMap.set(a.data, { data: a.data, km: 0, litros: 0, gasto: 0 })
      diaMap.get(a.data)!.litros += Number(a.litros) || 0
      diaMap.get(a.data)!.gasto += Number(a.valor_total) || 0
    })
    const mesMap = new Map<string, MesRow>()
    Array.from(diaMap.values()).sort((a, b) => a.data.localeCompare(b.data)).forEach(dia => {
      const mesKey = dia.data.slice(0, 7)
      if (!mesMap.has(mesKey)) {
        const [year, month] = mesKey.split('-')
        mesMap.set(mesKey, { mesKey, label: `${MESES_ABREV[parseInt(month) - 1]}/${year}`, km: 0, litros: 0, gasto: 0, dias: [] })
      }
      const mes = mesMap.get(mesKey)!
      mes.km += dia.km
      mes.litros += dia.litros
      mes.gasto += dia.gasto
      mes.dias.push(dia)
    })
    return { id, nome, meses: Array.from(mesMap.values()) }
  }

  if (isAdmin && !funcionarioId) {
    return funcionarios
      .map(f => buildSecao(f.id, f.nome_completo, kmData.filter(k => k.funcionario_id === f.id), abastData.filter(a => a.funcionario_id === f.id)))
      .filter(s => s.meses.length > 0)
  }

  const nome = isAdmin && funcionarioId
    ? (funcionarios.find(f => f.id === funcionarioId)?.nome_completo ?? 'Colaborador')
    : 'Meu Resumo'
  return [buildSecao(funcionarioId, nome, kmData, abastData)]
}

function IconArrowLeft() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
}
function IconPrinter() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
}
function IconCar({ color = '#ccc' }: { color?: string }) {
  return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M5 17h14M5 17a2 2 0 0 1-2-2v-2a2 2 0 0 1 .5-1.32L5.5 9a2 2 0 0 1 1.5-.68h10a2 2 0 0 1 1.5.68l2 2.68A2 2 0 0 1 21 13v2a2 2 0 0 1-2 2"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/></svg>
}
function IconChevron({ aberto }: { aberto: boolean }) {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><polyline points="6 9 12 15 18 9"/></svg>
}

type Props = { isAdmin: boolean; backUrl: string; funcionariosIniciais?: Funcionario[] }

export default function RelatorioKmContent({ isAdmin, backUrl, funcionariosIniciais }: Props) {
  const supabase = createClient()
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>(() => funcionariosIniciais ?? [])
  const [filtros, setFiltros] = useState<Filtros>(() => defaultFiltros('este-mes'))
  const [secoes, setSecoes] = useState<Secao[]>([])
  const [expandedMeses, setExpandedMeses] = useState<Set<string>>(new Set())
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!isAdmin || funcionariosIniciais !== undefined) return
    supabase.from('profiles').select('id, nome_completo').eq('role', 'colaborador').order('nome_completo')
      .then(({ data }) => setFuncionarios(data ?? []))
  }, [])

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      let kmData: any[] = []
      let abastData: any[] = []

      if (isAdmin) {
        const params = new URLSearchParams({
          inicio: filtros.dataInicio,
          fim: filtros.dataFim,
          ...(filtros.funcionarioId ? { funcionarioId: filtros.funcionarioId } : {}),
        })
        const res = await fetch(`/api/admin/km?${params}`)
        if (res.ok) {
          const json = await res.json()
          kmData = json.kmData ?? []
          abastData = json.abastData ?? []
        }
      } else {
        let kmQuery = supabase
          .from('km_diario')
          .select('funcionario_id, data, km_inicial, km_final')
          .gte('data', filtros.dataInicio)
          .lte('data', filtros.dataFim)
        let abastQuery = supabase
          .from('abastecimentos')
          .select('funcionario_id, data, litros, valor_total')
          .gte('data', filtros.dataInicio)
          .lte('data', filtros.dataFim)
        const [{ data: kms }, { data: abasts }] = await Promise.all([kmQuery, abastQuery])
        kmData = kms ?? []
        abastData = abasts ?? []
      }

      setSecoes(buildSecoes(kmData, abastData, funcionarios, isAdmin, filtros.funcionarioId))
      setCarregando(false)
    }
    carregar()
  }, [filtros.dataInicio, filtros.dataFim, filtros.funcionarioId, funcionarios])

  function toggleMes(key: string) {
    setExpandedMeses(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const totalKm = secoes.reduce((s, sec) => s + sec.meses.reduce((ms, m) => ms + m.km, 0), 0)
  const totalLitros = secoes.reduce((s, sec) => s + sec.meses.reduce((ms, m) => ms + m.litros, 0), 0)
  const totalGasto = secoes.reduce((s, sec) => s + sec.meses.reduce((ms, m) => ms + m.gasto, 0), 0)
  const mediaKmL = totalLitros > 0 ? totalKm / totalLitros : null
  const nomePeriodo = `${new Date(filtros.dataInicio + 'T12:00').toLocaleDateString('pt-BR')} – ${new Date(filtros.dataFim + 'T12:00').toLocaleDateString('pt-BR')}`

  return (
    <>
      <style>{`
        .rkm-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:1rem;margin-bottom:1.4rem}
        .rkm-kpi{background:#fff;border-radius:16px;padding:1.05rem 1.2rem;box-shadow:0 1px 2px rgba(22,42,30,.04),0 2px 10px rgba(22,42,30,.04);border:1px solid #f2efea;border-top:3px solid}
        .rkm-kpi-num{font-size:1.45rem;font-weight:700;color:#162a1e;line-height:1.1;letter-spacing:-.02em}
        .rkm-kpi-label{font-size:.64rem;font-weight:700;color:#8f978f;margin-top:.35rem;text-transform:uppercase;letter-spacing:.06em}
        .rkm-secao{background:#fff;border-radius:16px;box-shadow:0 1px 2px rgba(22,42,30,.04),0 2px 10px rgba(22,42,30,.04);border:1px solid #f2efea;margin-bottom:1.2rem;overflow:hidden}
        .rkm-secao-header{display:flex;align-items:center;gap:.8rem;padding:1rem 1.3rem;border-bottom:1px solid #f0ede8}
        .rkm-secao-avatar{width:36px;height:36px;border-radius:50%;background:#162a1e;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.9rem;flex-shrink:0}
        .rkm-secao-nome{font-weight:700;color:#162a1e;font-size:.95rem}
        .rkm-secao-sub{font-size:.72rem;color:#aaa;margin-top:.1rem}
        .rkm-table{width:100%;border-collapse:collapse}
        .rkm-table th{text-align:left;font-size:.62rem;font-weight:700;color:#8f978f;text-transform:uppercase;letter-spacing:.08em;padding:.65rem 1.3rem;background:#faf8f5;border-bottom:1px solid #f2efea}
        .rkm-table th.num{text-align:right}
        .rkm-mes-row{cursor:pointer;transition:background .1s}
        .rkm-mes-row:hover{background:#fcfaf7}
        .rkm-mes-row td{padding:.7rem 1.3rem;border-bottom:1px solid #f7f5f0;font-size:.82rem}
        .rkm-mes-label{font-weight:700;color:#162a1e;display:flex;align-items:center;gap:.5rem}
        .rkm-num{text-align:right;color:#162a1e;font-weight:700}
        .rkm-num-sub{text-align:right;color:#888;font-size:.78rem}
        .rkm-toggle{display:inline-flex;align-items:center;gap:.3rem;font-size:.7rem;color:#E67E22;font-weight:700}
        .rkm-dias{display:none}
        .rkm-dias.aberto{display:table-row}
        .rkm-dia-row td{padding:.45rem 1.3rem .45rem 2.5rem;font-size:.76rem;border-bottom:1px solid #eee;color:#555}
        .rkm-dia-row:last-child td{border-bottom:none}
        .rkm-dia-data{color:#888}
        .rkm-total-row td{padding:.8rem 1.3rem;font-weight:700;font-size:.82rem;border-top:1px solid #eae5de;background:#faf8f5}
        .rkm-vazio{text-align:center;padding:3rem 1rem;color:#aaa}
        .rkm-vazio-icon{display:flex;justify-content:center;margin-bottom:.8rem}
        @media print {
          .rkm-actions,.fp-wrap,.ui-breadcrumb{display:none !important}
          .sidebar,.topbar{display:none !important}
          .main{margin-left:0 !important;width:100% !important}
          .content{padding:0 !important}
          .rkm-dias{display:table-row !important}
          .rkm-toggle{display:none !important}
          body{background:#fff !important}
          .rkm-secao{box-shadow:none;border:1px solid #eee;break-inside:avoid}
        }
      `}</style>

      <div className="ui-breadcrumb">
        <Link href={backUrl}><IconArrowLeft /> Relatórios</Link>
        <span className="ui-breadcrumb-sep">/</span>
        <span className="ui-breadcrumb-atual">KM / Combustível</span>
      </div>
      <div className="ui-page-header">
        <div>
          <div className="ui-title">KM / Combustível</div>
          <div className="ui-sub">Quilometragem e abastecimentos por mês. Clique em um mês para ver o detalhe dia a dia</div>
        </div>
        <div className="ui-header-actions rkm-actions">
          <button className="ui-btn ui-btn-dark" onClick={() => window.print()}>
            <IconPrinter /> Imprimir / PDF
          </button>
        </div>
      </div>

      <FiltrosPainel
        value={filtros}
        onChange={setFiltros}
        clientes={[]}
        showCliente={false}
        showFuncionario={isAdmin}
        funcionarios={funcionarios}
      />

      {!carregando && secoes.length > 0 && (
        <div className="rkm-kpis">
          <div className="rkm-kpi" style={{ borderTopColor: '#162a1e' }}>
            <div className="rkm-kpi-num">{totalKm.toLocaleString('pt-BR')} km</div>
            <div className="rkm-kpi-label">KM rodado</div>
          </div>
          <div className="rkm-kpi" style={{ borderTopColor: '#E67E22' }}>
            <div className="rkm-kpi-num">R$ {totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            <div className="rkm-kpi-label">Gasto em combustível</div>
          </div>
          <div className="rkm-kpi" style={{ borderTopColor: '#5b6660' }}>
            <div className="rkm-kpi-num">{totalLitros.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L</div>
            <div className="rkm-kpi-label">Litros abastecidos</div>
          </div>
          {mediaKmL != null && (
            <div className="rkm-kpi" style={{ borderTopColor: '#27ae60' }}>
              <div className="rkm-kpi-num">{mediaKmL.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km/L</div>
              <div className="rkm-kpi-label">Consumo médio</div>
            </div>
          )}
        </div>
      )}

      {carregando ? (
        <div className="rkm-vazio"><div>Carregando...</div></div>
      ) : secoes.length === 0 ? (
        <div className="rkm-vazio">
          <div className="rkm-vazio-icon"><IconCar /></div>
          <div>Nenhum registro encontrado no período.</div>
        </div>
      ) : (
        secoes.map(secao => {
          const secKm = secao.meses.reduce((s, m) => s + m.km, 0)
          const secLitros = secao.meses.reduce((s, m) => s + m.litros, 0)
          const secGasto = secao.meses.reduce((s, m) => s + m.gasto, 0)
          return (
            <div key={secao.id || 'self'} className="rkm-secao">
              {isAdmin && !filtros.funcionarioId && (
                <div className="rkm-secao-header">
                  <div className="rkm-secao-avatar">{secao.nome.charAt(0).toUpperCase()}</div>
                  <div>
                    <div className="rkm-secao-nome">{secao.nome}</div>
                    <div className="rkm-secao-sub">
                      {secKm.toLocaleString('pt-BR')} km · {secLitros.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L · R$ {secGasto.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>
              )}
              <table className="rkm-table">
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th className="num">KM rodado</th>
                    <th className="num">Litros</th>
                    <th className="num">Gasto</th>
                    <th className="num">Km/L</th>
                    <th></th>
                  </tr>
                </thead>
                {secao.meses.map(mes => {
                  const key = `${secao.id}|${mes.mesKey}`
                  const aberto = expandedMeses.has(key)
                  const consumo = mes.litros > 0 ? mes.km / mes.litros : null
                  return (
                    <tbody key={mes.mesKey}>
                      <tr className="rkm-mes-row" onClick={() => toggleMes(key)}>
                        <td><div className="rkm-mes-label"><span>{mes.label}</span></div></td>
                        <td className="rkm-num">{mes.km.toLocaleString('pt-BR')} km</td>
                        <td className="rkm-num-sub">{mes.litros.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L</td>
                        <td className="rkm-num">R$ {mes.gasto.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td>
                        <td className="rkm-num-sub">{consumo != null ? consumo.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—'}</td>
                        <td style={{ textAlign: 'right', paddingRight: '1.3rem' }}>
                          <span className="rkm-toggle">{mes.dias.length} dias <IconChevron aberto={aberto} /></span>
                        </td>
                      </tr>
                      <tr className={`rkm-dias ${aberto ? 'aberto' : ''}`}>
                        <td colSpan={6} style={{ padding: 0, background: '#f7f5f0' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <tbody>
                              {mes.dias.map(dia => {
                                const diaConsumo = dia.litros > 0 ? dia.km / dia.litros : null
                                const d = new Date(dia.data + 'T12:00')
                                return (
                                  <tr key={dia.data} className="rkm-dia-row">
                                    <td className="rkm-dia-data" style={{ width: '110px' }}>
                                      {d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
                                    </td>
                                    <td style={{ textAlign: 'right', width: '110px' }}>{dia.km > 0 ? `${dia.km.toLocaleString('pt-BR')} km` : '—'}</td>
                                    <td style={{ textAlign: 'right', width: '80px', color: '#aaa' }}>{dia.litros > 0 ? `${dia.litros.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L` : '—'}</td>
                                    <td style={{ textAlign: 'right', width: '100px' }}>{dia.gasto > 0 ? `R$ ${dia.gasto.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}` : '—'}</td>
                                    <td style={{ textAlign: 'right', width: '80px', color: '#aaa' }}>{diaConsumo != null ? `${diaConsumo.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km/L` : ''}</td>
                                    <td></td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  )
                })}
                <tfoot>
                  <tr className="rkm-total-row">
                    <td>Total — {nomePeriodo}</td>
                    <td className="rkm-num">{secKm.toLocaleString('pt-BR')} km</td>
                    <td className="rkm-num-sub">{secLitros.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L</td>
                    <td className="rkm-num">R$ {secGasto.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td>
                    <td className="rkm-num-sub">{secLitros > 0 ? (secKm / secLitros).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—'}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        })
      )}
    </>
  )
}

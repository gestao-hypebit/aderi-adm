export type Atalho = 'desde-inicio' | 'hoje' | 'esta-semana' | 'este-mes' | 'mes-passado' | 'este-ano'

export type Filtros = {
  dataInicio: string
  dataFim: string
  clienteId: string
  funcionarioId: string
}

export const ATALHOS: [Atalho, string][] = [
  ['desde-inicio', 'Desde o início'],
  ['hoje', 'Hoje'],
  ['esta-semana', 'Esta semana'],
  ['este-mes', 'Este mês'],
  ['mes-passado', 'Mês passado'],
  ['este-ano', 'Este ano'],
]

export const ATALHO_PADRAO: Atalho = 'desde-inicio'

// "Desde o início" = sem limite prático. O fim no futuro mantém as visitas já agendadas.
export const INICIO_SEMPRE = '2000-01-01'
export const FIM_SEMPRE = '2099-12-31'

const FUSO = 'America/Sao_Paulo'

// Data de hoje no horário de Brasília (YYYY-MM-DD). Não usar toISOString(): ele está em UTC
// e, depois das 21h, já devolve o dia seguinte — no navegador e no servidor (Vercel roda em UTC).
export function hojeISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

// Soma dias a uma data YYYY-MM-DD sem passar por fuso horário
export function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(a, m - 1, d + dias))
  return dt.toISOString().slice(0, 10)
}

function ymd(a: number, m: number, d: number) {
  const dt = new Date(Date.UTC(a, m, d))
  return dt.toISOString().slice(0, 10)
}

export function calcRange(tipo: Atalho): { inicio: string; fim: string } {
  const hoje = hojeISO()
  const [a, m, d] = hoje.split('-').map(Number)
  if (tipo === 'desde-inicio') return { inicio: INICIO_SEMPRE, fim: FIM_SEMPRE }
  if (tipo === 'hoje') return { inicio: hoje, fim: hoje }
  if (tipo === 'esta-semana') {
    const dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay()
    const seg = somarDias(hoje, -(dow === 0 ? 6 : dow - 1))
    return { inicio: seg, fim: somarDias(seg, 6) }
  }
  if (tipo === 'este-mes') return { inicio: ymd(a, m - 1, 1), fim: ymd(a, m, 0) }
  if (tipo === 'mes-passado') return { inicio: ymd(a, m - 2, 1), fim: ymd(a, m - 1, 0) }
  return { inicio: ymd(a, 0, 1), fim: ymd(a, 11, 31) }
}

export function defaultFiltros(range: Atalho = ATALHO_PADRAO): Filtros {
  const { inicio, fim } = calcRange(range)
  return { dataInicio: inicio, dataFim: fim, clienteId: '', funcionarioId: '' }
}

export function detectAtalho(inicio: string, fim: string): Atalho | null {
  for (const [tipo] of ATALHOS) {
    const r = calcRange(tipo)
    if (r.inicio === inicio && r.fim === fim) return tipo
  }
  return null
}

export const ehDesdeInicio = (inicio: string, fim: string) => inicio === INICIO_SEMPRE && fim === FIM_SEMPRE

// Texto do período para cabeçalhos ("Desde o início", "07/10/2026", "01/10/2026 – 31/10/2026")
export function descreverPeriodo(inicio: string, fim: string): string {
  if (ehDesdeInicio(inicio, fim)) return 'Desde o início'
  const f = (s: string) => s.split('-').reverse().join('/')
  if (inicio === INICIO_SEMPRE) return `Até ${f(fim)}`
  if (fim === FIM_SEMPRE) return `A partir de ${f(inicio)}`
  return inicio === fim ? f(inicio) : `${f(inicio)} – ${f(fim)}`
}

export type Atalho = 'hoje' | 'esta-semana' | 'este-mes' | 'este-ano'

export type Filtros = {
  dataInicio: string
  dataFim: string
  clienteId: string
  funcionarioId: string
}

export function calcRange(tipo: Atalho): { inicio: string; fim: string } {
  const hoje = new Date()
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  if (tipo === 'hoje') return { inicio: fmt(hoje), fim: fmt(hoje) }
  if (tipo === 'esta-semana') {
    const dow = hoje.getDay()
    const seg = new Date(hoje)
    seg.setDate(hoje.getDate() - (dow === 0 ? 6 : dow - 1))
    const dom = new Date(seg)
    dom.setDate(seg.getDate() + 6)
    return { inicio: fmt(seg), fim: fmt(dom) }
  }
  if (tipo === 'este-mes') {
    return {
      inicio: fmt(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
      fim: fmt(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)),
    }
  }
  return {
    inicio: fmt(new Date(hoje.getFullYear(), 0, 1)),
    fim: fmt(new Date(hoje.getFullYear(), 11, 31)),
  }
}

export function defaultFiltros(range: Atalho = 'este-mes'): Filtros {
  const { inicio, fim } = calcRange(range)
  return { dataInicio: inicio, dataFim: fim, clienteId: '', funcionarioId: '' }
}

export function detectAtalho(inicio: string, fim: string): Atalho | null {
  for (const tipo of ['hoje', 'esta-semana', 'este-mes', 'este-ano'] as Atalho[]) {
    const r = calcRange(tipo)
    if (r.inicio === inicio && r.fim === fim) return tipo
  }
  return null
}

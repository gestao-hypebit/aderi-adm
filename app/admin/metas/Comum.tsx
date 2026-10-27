// Peças de tela compartilhadas pelo módulo de metas

export const pct = (n: number | null | undefined, casas = 1) =>
  n == null || !Number.isFinite(n) ? '—' : `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: casas })}%`

export function Kpi({ rotulo, valor, sub, cor }: { rotulo: string; valor: string; sub?: string; cor?: string }) {
  return (
    <div className="ui-kpi" style={cor ? { borderTop: `3px solid ${cor}` } : undefined}>
      <div className="ui-kpi-body">
        <div className="ui-kpi-label">{rotulo}</div>
        <div className="ui-kpi-num" style={{ fontSize: '1.25rem' }}>{valor}</div>
        {sub && <div className="ui-kpi-sub">{sub}</div>}
      </div>
    </div>
  )
}

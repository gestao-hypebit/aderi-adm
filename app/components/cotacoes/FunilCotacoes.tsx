'use client'

import { STATUS_COTACAO, funilCotacoes, brl, pct } from '@/lib/cotacao'

type Cot = { status: string; enviada_em: string | null; venda: number; motivo_perda: string | null }

// Funil de vendas das cotações: cotadas → enviadas → efetivadas, com conversão entre etapas,
// situação atual por status e motivos de perda.
export default function FunilCotacoes({ cotacoes, periodo, onStatus }: { cotacoes: Cot[]; periodo: string; onStatus?: (s: string) => void }) {
  const f = funilCotacoes(cotacoes)
  const topo = Math.max(f.etapas[0].qtd, 1)
  const porStatus = Object.entries(STATUS_COTACAO).map(([k, v]) => {
    const l = cotacoes.filter(c => c.status === k)
    return { k, ...v, qtd: l.length, valor: l.reduce((s, c) => s + c.venda, 0) }
  })

  return (
    <div className="ui-card fn-card">
      <style>{`
        .fn-card{padding:1.1rem 1.25rem;margin-bottom:1rem;display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:1.4rem}
        .fn-h{display:flex;align-items:baseline;gap:.5rem;margin-bottom:.8rem}
        .fn-t{font-size:.9rem;font-weight:600;color:#162a1e}
        .fn-sub{font-size:.7rem;color:#8f978f}
        .fn-etapa{margin-bottom:.7rem}
        .fn-etapa-l{display:flex;justify-content:space-between;align-items:baseline;gap:.6rem;font-size:.76rem;margin-bottom:.3rem}
        .fn-etapa-l span{font-weight:600;color:#162a1e}
        .fn-etapa-l small{font-weight:500;color:#8f978f;margin-left:.35rem}
        .fn-etapa-l b{font-weight:600;color:#162a1e;font-variant-numeric:tabular-nums;white-space:nowrap}
        .fn-bar{height:22px;border-radius:7px;background:#f4f1ec;overflow:hidden;display:flex}
        .fn-bar span{display:flex;align-items:center;padding-left:.55rem;color:#fff;font-size:.66rem;font-weight:600;border-radius:7px;min-width:fit-content;white-space:nowrap;transition:width .3s}
        .fn-kpis{display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-bottom:.9rem}
        .fn-kpi{background:#faf8f5;border-radius:10px;padding:.6rem .75rem}
        .fn-kpi-l{font-size:.62rem;font-weight:600;color:#8f978f;text-transform:uppercase;letter-spacing:.05em}
        .fn-kpi-n{font-size:1.05rem;font-weight:600;color:#162a1e;margin-top:.2rem;font-variant-numeric:tabular-nums}
        .fn-kpi-s{font-size:.64rem;color:#8f978f;margin-top:.1rem}
        .fn-st{display:flex;flex-wrap:wrap;gap:.35rem;margin-bottom:.8rem}
        .fn-st button{display:inline-flex;align-items:center;gap:.35rem;border:1px solid #eae5de;background:#fff;border-radius:999px;padding:.22rem .6rem;font-family:inherit;font-size:.68rem;font-weight:600;color:#5b6660;cursor:pointer}
        .fn-st button:hover{border-color:#E67E22}
        .fn-st i{width:7px;height:7px;border-radius:50%;display:inline-block}
        .fn-mot{font-size:.7rem;color:#5b6660}
        .fn-mot div{display:flex;justify-content:space-between;padding:.18rem 0;border-bottom:1px dashed #f0ece6}
        .fn-mot div:last-child{border-bottom:none}
        .fn-l2{font-size:.66rem;font-weight:600;color:#8f978f;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.35rem}
        @media(max-width:900px){.fn-card{grid-template-columns:1fr}}
      `}</style>

      <div>
        <div className="fn-h"><span className="fn-t">Funil de vendas</span><span className="fn-sub">{periodo}</span></div>
        {f.etapas.map((e, i) => {
          const ant = i > 0 ? f.etapas[i - 1].qtd : null
          return (
            <div key={e.rotulo} className="fn-etapa">
              <div className="fn-etapa-l">
                <span>{e.rotulo}<small>{e.qtd}{ant != null && ant > 0 ? ` · ${pct(e.qtd / ant, 0)} da etapa anterior` : ''}</small></span>
                <b>{brl(e.valor)}</b>
              </div>
              <div className="fn-bar"><span style={{ width: `${Math.max((e.qtd / topo) * 100, e.qtd ? 6 : 0)}%`, background: e.cor }}>{e.qtd || ''}</span></div>
            </div>
          )
        })}
        <div className="fn-etapa" style={{ marginBottom: 0 }}>
          <div className="fn-etapa-l"><span style={{ color: '#c0392b' }}>Perdidas<small>{f.perdidas.qtd}</small></span><b style={{ color: '#c0392b' }}>{brl(f.perdidas.valor)}</b></div>
        </div>
      </div>

      <div>
        <div className="fn-kpis">
          <div className="fn-kpi"><div className="fn-kpi-l">Conversão</div><div className="fn-kpi-n">{f.conversao == null ? '—' : pct(f.conversao, 0)}</div><div className="fn-kpi-s">efetivadas ÷ (efetivadas + perdidas)</div></div>
          <div className="fn-kpi"><div className="fn-kpi-l">Ticket médio</div><div className="fn-kpi-n">{f.ticket == null ? '—' : brl(f.ticket)}</div><div className="fn-kpi-s">por cotação efetivada</div></div>
        </div>
        <div className="fn-l2">Situação atual</div>
        <div className="fn-st">
          {porStatus.map(s => (
            <button key={s.k} type="button" onClick={() => onStatus?.(s.k)} title={brl(s.valor)}><i style={{ background: s.cor }} />{s.label} {s.qtd}</button>
          ))}
        </div>
        {f.motivos.length > 0 && (
          <>
            <div className="fn-l2">Motivos de perda</div>
            <div className="fn-mot">{f.motivos.slice(0, 4).map(([m, n]) => <div key={m}><span>{m}</span><b>{n}</b></div>)}</div>
          </>
        )}
      </div>
    </div>
  )
}

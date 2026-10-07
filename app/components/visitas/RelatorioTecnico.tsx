'use client'

import { useState } from 'react'
import {
  type Checklist, type Nivel, type Ocorrencia, CONDICAO_LABEL, CULTURAS_TECNICAS, DANINHAS, NIVEL_BADGE, NIVEL_LABEL,
  UMIDADE_LABEL, checklistVazio, modeloDe,
} from '@/lib/checklist'

const CSS = `
  .rt-body{padding:1.1rem 1.4rem 1.3rem}
  .rt-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.8rem;margin-bottom:1rem}
  .rt-grid .ui-field{margin-bottom:0}
  .rt-secao{margin-top:1.1rem}
  .rt-secao-t{font-size:.66rem;font-weight:600;color:#8f978f;text-transform:uppercase;letter-spacing:.08em;margin-bottom:.5rem}
  .rt-chips{display:flex;flex-wrap:wrap;gap:.35rem}
  .rt-chip{display:inline-flex;align-items:center;gap:.35rem;border:1.5px solid #eae5de;background:#fff;border-radius:999px;padding:.3rem .7rem;font-family:inherit;font-size:.72rem;font-weight:500;color:#5b6660;cursor:pointer;transition:all .12s}
  .rt-chip:hover{border-color:#cfc8bd;color:#162a1e}
  .rt-chip.on{border-color:#162a1e;background:#162a1e;color:#fff}
  .rt-chip.on.medio{background:#E67E22;border-color:#E67E22}
  .rt-chip.on.alto{background:#c0392b;border-color:#c0392b}
  .rt-chip small{font-size:.62rem;opacity:.85}
  .rt-extra{display:flex;gap:.4rem;margin-top:.45rem}
  .rt-extra .ui-input{max-width:240px;padding:.42rem .65rem;font-size:.76rem}
  .rt-rec{display:grid;grid-template-columns:minmax(0,2fr) 90px 90px minmax(0,2fr) 34px;gap:.4rem;margin-bottom:.4rem}
  .rt-rec .ui-input{padding:.45rem .6rem;font-size:.78rem}
  .rt-del{border:none;background:none;color:#b8bdb6;cursor:pointer;border-radius:8px}
  .rt-del:hover{background:#fdeeec;color:#c0392b}
  .rt-acoes{display:flex;justify-content:flex-end;gap:.5rem;margin-top:1.2rem}
  .rt-ver-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.6rem;margin-bottom:.9rem}
  .rt-ver-item{background:#faf8f5;border-radius:10px;padding:.6rem .75rem}
  .rt-ver-l{font-size:.6rem;font-weight:600;color:#8f978f;text-transform:uppercase;letter-spacing:.06em}
  .rt-ver-v{font-size:.84rem;font-weight:600;color:#162a1e;margin-top:.15rem}
  .rt-tab{width:100%;border-collapse:collapse;font-size:.78rem;margin-top:.2rem}
  .rt-tab th{text-align:left;font-size:.6rem;font-weight:600;color:#8f978f;text-transform:uppercase;letter-spacing:.06em;padding:.45rem .5rem;border-bottom:1px solid #f2efea}
  .rt-tab td{padding:.5rem;border-bottom:1px solid #f7f5f1;color:#162a1e}
  .rt-vazio{font-size:.8rem;color:#b8bdb6;font-style:italic}
  @media(max-width:760px){.rt-grid{grid-template-columns:1fr 1fr}.rt-rec{grid-template-columns:1fr 1fr}.rt-rec .ui-input:first-child,.rt-rec .ui-input:nth-child(4){grid-column:1/-1}}
`

const proximoNivel = (n?: Nivel): Nivel | null => (!n ? 'baixo' : n === 'baixo' ? 'medio' : n === 'medio' ? 'alto' : null)

function Ocorrencias({ titulo, opcoes, valor, onChange }: { titulo: string; opcoes: string[]; valor: Ocorrencia[]; onChange: (v: Ocorrencia[]) => void }) {
  const [outro, setOutro] = useState('')
  const todas = [...opcoes, ...valor.map(v => v.nome).filter(n => !opcoes.includes(n))]
  function alternar(nome: string) {
    const atual = valor.find(v => v.nome === nome)
    const prox = proximoNivel(atual?.nivel)
    onChange(prox ? [...valor.filter(v => v.nome !== nome), { nome, nivel: prox }] : valor.filter(v => v.nome !== nome))
  }
  return (
    <div className="rt-secao">
      <div className="rt-secao-t">{titulo} <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>· clique para marcar: baixo → médio → alto → limpar</span></div>
      <div className="rt-chips">
        {todas.map(n => {
          const o = valor.find(v => v.nome === n)
          return (
            <button type="button" key={n} className={`rt-chip ${o ? `on ${o.nivel}` : ''}`} onClick={() => alternar(n)}>
              {n}{o && <small>{NIVEL_LABEL[o.nivel]}</small>}
            </button>
          )
        })}
      </div>
      <div className="rt-extra">
        <input className="ui-input" placeholder="Outro..." value={outro} onChange={e => setOutro(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (outro.trim()) { onChange([...valor, { nome: outro.trim(), nivel: 'baixo' }]); setOutro('') } } }} />
        <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => { if (outro.trim()) { onChange([...valor, { nome: outro.trim(), nivel: 'baixo' }]); setOutro('') } }}>Adicionar</button>
      </div>
    </div>
  )
}

export function RelatorioTecnicoEditor({ inicial, culturaPadrao, salvando, onSalvar, onCancelar }: {
  inicial: Checklist | null; culturaPadrao?: string | null; salvando?: boolean; onSalvar: (c: Checklist) => void; onCancelar: () => void
}) {
  const [c, setC] = useState<Checklist>(() => ({ cultura: culturaPadrao || undefined, pragas: [], doencas: [], daninhas: [], recomendacoes: [], ...(inicial ?? {}) }))
  const modelo = modeloDe(c.cultura)
  const mudar = (campos: Partial<Checklist>) => setC(x => ({ ...x, ...campos }))
  const recs = c.recomendacoes ?? []

  return (
    <div className="rt-body">
      <style>{CSS}</style>
      <div className="rt-grid">
        <div className="ui-field">
          <label className="ui-label">Cultura</label>
          <select className="ui-select" value={c.cultura ?? ''} onChange={e => mudar({ cultura: e.target.value || undefined, estadio: undefined })}>
            <option value="">Selecione...</option>
            {CULTURAS_TECNICAS.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <div className="ui-field">
          <label className="ui-label">Estádio / fase</label>
          <select className="ui-select" value={c.estadio ?? ''} onChange={e => mudar({ estadio: e.target.value || undefined })}>
            <option value="">Selecione...</option>
            {modelo.estadios.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <div className="ui-field">
          <label className="ui-label">Condição da lavoura</label>
          <select className="ui-select" value={c.condicao ?? ''} onChange={e => mudar({ condicao: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">Selecione...</option>
            {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{CONDICAO_LABEL[n]}</option>)}
          </select>
        </div>
        <div className="ui-field">
          <label className="ui-label">Umidade do solo</label>
          <select className="ui-select" value={c.umidade_solo ?? ''} onChange={e => mudar({ umidade_solo: (e.target.value || undefined) as Checklist['umidade_solo'] })}>
            <option value="">Selecione...</option>
            {Object.entries(UMIDADE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      <Ocorrencias titulo="Pragas" opcoes={modelo.pragas} valor={c.pragas ?? []} onChange={v => mudar({ pragas: v })} />
      <Ocorrencias titulo="Doenças" opcoes={modelo.doencas} valor={c.doencas ?? []} onChange={v => mudar({ doencas: v })} />
      <Ocorrencias titulo="Plantas daninhas" opcoes={DANINHAS} valor={c.daninhas ?? []} onChange={v => mudar({ daninhas: v })} />

      <div className="rt-secao">
        <div className="rt-secao-t">Recomendações de produto</div>
        {recs.map((r, i) => (
          <div key={i} className="rt-rec">
            <input className="ui-input" placeholder="Produto" value={r.produto} onChange={e => mudar({ recomendacoes: recs.map((x, j) => (j === i ? { ...x, produto: e.target.value } : x)) })} />
            <input className="ui-input" placeholder="Dose" value={r.dose} onChange={e => mudar({ recomendacoes: recs.map((x, j) => (j === i ? { ...x, dose: e.target.value } : x)) })} />
            <input className="ui-input" placeholder="Unid." list="rt-unidades" value={r.unidade} onChange={e => mudar({ recomendacoes: recs.map((x, j) => (j === i ? { ...x, unidade: e.target.value } : x)) })} />
            <input className="ui-input" placeholder="Observação (época, forma de aplicação...)" value={r.obs} onChange={e => mudar({ recomendacoes: recs.map((x, j) => (j === i ? { ...x, obs: e.target.value } : x)) })} />
            <button type="button" className="rt-del" onClick={() => mudar({ recomendacoes: recs.filter((_, j) => j !== i) })} aria-label="Remover recomendação">✕</button>
          </div>
        ))}
        <datalist id="rt-unidades"><option value="kg/ha" /><option value="L/ha" /><option value="t/ha" /><option value="g/planta" /><option value="mL/100L" /></datalist>
        <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => mudar({ recomendacoes: [...recs, { produto: '', dose: '', unidade: '', obs: '' }] })}>+ Adicionar recomendação</button>
      </div>

      <div className="rt-secao">
        <div className="rt-secao-t">Observações técnicas</div>
        <textarea className="ui-textarea" style={{ minHeight: 80 }} value={c.observacoes ?? ''} onChange={e => mudar({ observacoes: e.target.value })} placeholder="Diagnóstico, próximos passos, o que foi combinado com o produtor..." />
      </div>

      <div className="rt-acoes">
        <button type="button" className="ui-btn ui-btn-ghost" onClick={onCancelar}>Cancelar</button>
        <button type="button" className="ui-btn ui-btn-dark" disabled={salvando}
          onClick={() => onSalvar({ ...c, recomendacoes: recs.filter(r => r.produto.trim()) })}>{salvando ? 'Salvando...' : 'Salvar relatório técnico'}</button>
      </div>
    </div>
  )
}

export function RelatorioTecnicoVer({ checklist }: { checklist: Checklist | null }) {
  if (checklistVazio(checklist)) return <div className="rt-body"><style>{CSS}</style><div className="rt-vazio">Relatório técnico não preenchido.</div></div>
  const c = checklist!
  const lista = (titulo: string, itens?: Ocorrencia[]) => !itens?.length ? null : (
    <div className="rt-secao">
      <div className="rt-secao-t">{titulo}</div>
      <div className="rt-chips">{itens.map(o => <span key={o.nome} className={`ui-badge ${NIVEL_BADGE[o.nivel]}`}>{o.nome} · {NIVEL_LABEL[o.nivel]}</span>)}</div>
    </div>
  )
  return (
    <div className="rt-body">
      <style>{CSS}</style>
      <div className="rt-ver-grid">
        {c.cultura && <div className="rt-ver-item"><div className="rt-ver-l">Cultura</div><div className="rt-ver-v">{c.cultura}</div></div>}
        {c.estadio && <div className="rt-ver-item"><div className="rt-ver-l">Estádio</div><div className="rt-ver-v">{c.estadio}</div></div>}
        {c.condicao && <div className="rt-ver-item"><div className="rt-ver-l">Condição</div><div className="rt-ver-v">{CONDICAO_LABEL[c.condicao]}</div></div>}
        {c.umidade_solo && <div className="rt-ver-item"><div className="rt-ver-l">Umidade do solo</div><div className="rt-ver-v">{UMIDADE_LABEL[c.umidade_solo]}</div></div>}
      </div>
      {lista('Pragas', c.pragas)}
      {lista('Doenças', c.doencas)}
      {lista('Plantas daninhas', c.daninhas)}
      {!!c.recomendacoes?.length && (
        <div className="rt-secao">
          <div className="rt-secao-t">Recomendações</div>
          <table className="rt-tab">
            <thead><tr><th>Produto</th><th>Dose</th><th>Observação</th></tr></thead>
            <tbody>{c.recomendacoes.map((r, i) => <tr key={i}><td style={{ fontWeight: 600 }}>{r.produto}</td><td>{[r.dose, r.unidade].filter(Boolean).join(' ') || '—'}</td><td>{r.obs || '—'}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      {c.observacoes && <div className="rt-secao"><div className="rt-secao-t">Observações técnicas</div><div style={{ fontSize: '.84rem', color: '#3d4a42', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{c.observacoes}</div></div>}
    </div>
  )
}

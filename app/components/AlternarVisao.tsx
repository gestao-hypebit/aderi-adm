'use client'

import { ReactNode, useSyncExternalStore } from 'react'

export type Visao = 'tabela' | 'cards'

function IconLista() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
}
function IconGrade() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
}

// visão da lista (tabela/cards) lembrada por página no navegador; padrão é tabela
const ouvintes = new Set<() => void>()

function lerVisao(chave: string): Visao {
  try { return localStorage.getItem(`visao:${chave}`) === 'cards' ? 'cards' : 'tabela' } catch { return 'tabela' }
}

function assinar(cb: () => void) {
  ouvintes.add(cb)
  window.addEventListener('storage', cb)
  return () => { ouvintes.delete(cb); window.removeEventListener('storage', cb) }
}

export function useVisao(chave: string) {
  const visao = useSyncExternalStore(assinar, () => lerVisao(chave), () => 'tabela' as Visao)
  function setVisao(v: Visao) {
    try { localStorage.setItem(`visao:${chave}`, v) } catch {}
    ouvintes.forEach(cb => cb())
  }
  return [visao, setVisao] as const
}

export function SeletorVisao({ visao, onChange, style }: { visao: Visao; onChange: (v: Visao) => void; style?: React.CSSProperties }) {
  return (
    <div className="ui-segmented" role="tablist" aria-label="Modo de exibição" style={style}>
      <button role="tab" aria-selected={visao === 'tabela'} className={visao === 'tabela' ? 'ativo' : ''} onClick={() => onChange('tabela')} title="Tabela"><IconLista /> Tabela</button>
      <button role="tab" aria-selected={visao === 'cards'} className={visao === 'cards' ? 'ativo' : ''} onClick={() => onChange('cards')} title="Cards"><IconGrade /> Cards</button>
    </div>
  )
}

// para páginas server: recebe as duas visões já renderizadas e mostra a escolhida
export default function AlternarVisao({ chave, tabela, cards }: { chave: string; tabela: ReactNode; cards: ReactNode }) {
  const [visao, setVisao] = useVisao(chave)
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <SeletorVisao visao={visao} onChange={setVisao} />
      </div>
      {visao === 'tabela' ? tabela : cards}
    </>
  )
}

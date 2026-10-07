'use client'

import { ReactNode, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

// ─────────────────────────────────────────────────────────────
// Tabela padrão do sistema: cabeçalho, ordenação, linha clicável,
// carregamento, estado vazio e paginação. Estilos em app/ui.css (.ui-tb-*).
// ─────────────────────────────────────────────────────────────

export type Coluna<T> = {
  id: string
  titulo: ReactNode
  celula: (linha: T) => ReactNode
  alinhar?: 'esq' | 'dir' | 'centro'
  largura?: string                  // ex.: '120px', '20%'
  ocultar?: 'tablet' | 'celular'    // some abaixo de 1000px / 700px
  ordenar?: (a: T, b: T) => number  // habilita ordenar pelo cabeçalho
}

const TAMANHOS = [10, 20, 50, 100]

// Paginação reaproveitável (tabela e grades de cards).
// "reiniciar": quando muda (ex.: filtros), volta para a página 1.
export function usePaginacao<T>(itens: T[], porPaginaInicial = 20, reiniciar?: unknown) {
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(porPaginaInicial)
  const [chave, setChave] = useState(reiniciar)
  if (chave !== reiniciar) { setChave(reiniciar); setPagina(1) }

  const totalPaginas = Math.max(1, Math.ceil(itens.length / porPagina))
  const atual = Math.min(pagina, totalPaginas)
  const visiveis = useMemo(() => itens.slice((atual - 1) * porPagina, atual * porPagina), [itens, atual, porPagina])
  return {
    visiveis,
    controle: {
      pagina: atual, totalPaginas, porPagina, total: itens.length,
      irPara: (p: number) => setPagina(Math.min(Math.max(1, p), totalPaginas)),
      mudarPorPagina: (n: number) => { setPorPagina(n); setPagina(1) },
    },
  }
}

export type ControlePaginacao = ReturnType<typeof usePaginacao>['controle']

function paginasVisiveis(atual: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const set = new Set([1, total, atual, atual - 1, atual + 1])
  if (atual <= 3) [2, 3, 4].forEach(n => set.add(n))
  if (atual >= total - 2) [total - 1, total - 2, total - 3].forEach(n => set.add(n))
  const nums = [...set].filter(n => n >= 1 && n <= total).sort((a, b) => a - b)
  const out: (number | '…')[] = []
  nums.forEach((n, i) => { if (i && n - nums[i - 1] > 1) out.push('…'); out.push(n) })
  return out
}

export function Paginacao({ controle, rotulo = 'registros', solta = false }: { controle: ControlePaginacao; rotulo?: string; solta?: boolean }) {
  const { pagina, totalPaginas, porPagina, total, irPara, mudarPorPagina } = controle
  if (total === 0) return null
  const de = (pagina - 1) * porPagina + 1
  const ate = Math.min(pagina * porPagina, total)
  return (
    <div className={`ui-pag ${solta ? 'ui-pag-solta' : ''}`}>
      <div className="ui-pag-info">
        <span><b>{de}–{ate}</b> de <b>{total.toLocaleString('pt-BR')}</b> {rotulo}</span>
        <label className="ui-pag-tam">
          <select value={porPagina} onChange={e => mudarPorPagina(Number(e.target.value))} aria-label="Itens por página">
            {TAMANHOS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          por página
        </label>
      </div>
      {totalPaginas > 1 && (
        <nav className="ui-pag-nav" aria-label="Paginação">
          <button onClick={() => irPara(pagina - 1)} disabled={pagina === 1} aria-label="Página anterior">‹</button>
          {paginasVisiveis(pagina, totalPaginas).map((p, i) =>
            p === '…'
              ? <span key={`r${i}`} className="ui-pag-reti">…</span>
              : <button key={p} className={p === pagina ? 'ativo' : ''} onClick={() => irPara(p)} aria-current={p === pagina ? 'page' : undefined}>{p}</button>
          )}
          <button onClick={() => irPara(pagina + 1)} disabled={pagina === totalPaginas} aria-label="Próxima página">›</button>
        </nav>
      )}
    </div>
  )
}

type Props<T> = {
  linhas: T[]
  colunas: Coluna<T>[]
  chave: (linha: T) => string
  href?: (linha: T) => string | null
  carregando?: boolean
  vazio?: ReactNode
  porPagina?: number
  paginar?: boolean
  reiniciar?: unknown
  rotulo?: string
  rodape?: ReactNode
  destaque?: (linha: T) => boolean
  ordemInicial?: { coluna: string; direcao: 'asc' | 'desc' }
  embutida?: boolean               // dentro de um card: sem borda/sombra próprias
}

export default function Tabela<T>({
  linhas, colunas, chave, href, carregando = false, vazio, porPagina = 20, paginar = true,
  reiniciar, rotulo, rodape, destaque, ordemInicial, embutida = false,
}: Props<T>) {
  const router = useRouter()
  const [ordem, setOrdem] = useState(ordemInicial ?? null)

  const ordenadas = useMemo(() => {
    const col = ordem && colunas.find(c => c.id === ordem.coluna)
    if (!col?.ordenar) return linhas
    const lista = [...linhas].sort(col.ordenar)
    return ordem!.direcao === 'desc' ? lista.reverse() : lista
  }, [linhas, colunas, ordem])

  const { visiveis, controle } = usePaginacao(ordenadas, porPagina, reiniciar)
  const exibidas = paginar ? visiveis : ordenadas

  function alternarOrdem(c: Coluna<T>) {
    if (!c.ordenar) return
    setOrdem(o => (o?.coluna === c.id ? { coluna: c.id, direcao: o.direcao === 'asc' ? 'desc' : 'asc' } : { coluna: c.id, direcao: 'asc' }))
  }

  // clique na linha abre o registro, exceto em botões/links/campos dentro dela
  function abrir(e: React.MouseEvent | React.KeyboardEvent, linha: T) {
    const destino = href?.(linha)
    if (!destino) return
    if ((e.target as HTMLElement).closest('a,button,input,select,textarea,label')) return
    if ('key' in e && e.key !== 'Enter') return
    if ('metaKey' in e && (e.metaKey || e.ctrlKey)) { window.open(destino, '_blank'); return }
    router.push(destino)
  }

  const classe = (c: Coluna<T>) => [c.alinhar === 'dir' ? 'dir' : c.alinhar === 'centro' ? 'centro' : '', c.ocultar ? `ocultar-${c.ocultar}` : ''].join(' ').trim()

  return (
    <div className={`ui-tb ${embutida ? 'embutida' : ''}`}>
      <div className="ui-tb-scroll">
        <table className="ui-tb-tabela">
          <thead>
            <tr>
              {colunas.map(c => (
                <th key={c.id} className={`${classe(c)} ${c.ordenar ? 'ordenavel' : ''}`} style={c.largura ? { width: c.largura } : undefined}
                  onClick={() => alternarOrdem(c)} aria-sort={ordem?.coluna === c.id ? (ordem.direcao === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {c.titulo}
                  {c.ordenar && <span className="ui-tb-seta">{ordem?.coluna === c.id ? (ordem.direcao === 'asc' ? '↑' : '↓') : '↕'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="ui-tb-esqueleto">
                  {colunas.map((c, j) => <td key={c.id} className={classe(c)}><div className="ui-skeleton" style={{ height: 14, width: j === 0 ? '70%' : '55%', marginLeft: c.alinhar === 'dir' ? 'auto' : undefined }} /></td>)}
                </tr>
              ))
            ) : exibidas.length === 0 ? (
              <tr><td colSpan={colunas.length} className="ui-tb-vazio">{vazio ?? <div className="ui-empty"><div className="ui-empty-title">Nenhum registro encontrado</div></div>}</td></tr>
            ) : exibidas.map(l => {
              const destino = href?.(l)
              return (
                <tr key={chave(l)} className={`${destino ? 'clicavel' : ''} ${destaque?.(l) ? 'destaque' : ''}`}
                  onClick={destino ? e => abrir(e, l) : undefined}
                  onKeyDown={destino ? e => abrir(e, l) : undefined}
                  tabIndex={destino ? 0 : undefined}>
                  {colunas.map(c => <td key={c.id} className={classe(c)}>{c.celula(l)}</td>)}
                </tr>
              )
            })}
          </tbody>
          {rodape && !carregando && exibidas.length > 0 && <tfoot>{rodape}</tfoot>}
        </table>
      </div>
      {paginar && !carregando && <Paginacao controle={controle} rotulo={rotulo} />}
    </div>
  )
}

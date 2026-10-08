'use client'

import { ReactNode, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ConfirmDialog from '@/app/admin/_ui/ConfirmDialog'

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

// Ações rápidas da linha (coluna "Ações" no fim da tabela). Com "confirmar", pede confirmação antes de executar.
export type Acao = {
  rotulo: string
  icone: IconeAcao
  href?: string
  novaAba?: boolean
  onClick?: () => unknown
  perigo?: boolean
  confirmar?: { titulo: string; texto?: ReactNode; botao?: string }
}

const ICONES = {
  ver: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  editar: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  excluir: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
  whatsapp: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  visita: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="13" x2="12" y2="19"/><line x1="9" y1="16" x2="15" y2="16"/>',
  agenda: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  cotacao: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>',
  imprimir: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  duplicar: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  concluir: '<polyline points="20 6 9 17 4 12"/>',
  cancelar: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
  desativar: '<path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>',
  carga: '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
}
export type IconeAcao = keyof typeof ICONES

function BotaoAcao({ a, onPedir }: { a: Acao; onPedir: (a: Acao) => void }) {
  const icone = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" dangerouslySetInnerHTML={{ __html: ICONES[a.icone] }} />
  const cls = `ui-tb-acao ${a.perigo ? 'perigo' : ''}`
  if (a.href) return <Link href={a.href} className={cls} title={a.rotulo} aria-label={a.rotulo} target={a.novaAba ? '_blank' : undefined} rel={a.novaAba ? 'noreferrer' : undefined}>{icone}</Link>
  return <button type="button" className={cls} title={a.rotulo} aria-label={a.rotulo} onClick={() => (a.confirmar ? onPedir(a) : a.onClick?.())}>{icone}</button>
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
  acoes?: (linha: T) => (Acao | false | null | undefined)[]  // coluna "Ações" no fim
}

export default function Tabela<T>({
  linhas, colunas, chave, href, carregando = false, vazio, porPagina = 20, paginar = true,
  reiniciar, rotulo, rodape, destaque, ordemInicial, embutida = false, acoes,
}: Props<T>) {
  const router = useRouter()
  const [ordem, setOrdem] = useState(ordemInicial ?? null)
  const [pendente, setPendente] = useState<Acao | null>(null)
  const [executando, setExecutando] = useState(false)
  const nColunas = colunas.length + (acoes ? 1 : 0)

  async function executar() {
    if (!pendente) return
    setExecutando(true)
    try { await pendente.onClick?.() } finally { setExecutando(false); setPendente(null) }
  }

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
              {acoes && <th className="dir ui-tb-th-acoes">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="ui-tb-esqueleto">
                  {colunas.map((c, j) => <td key={c.id} className={classe(c)}><div className="ui-skeleton" style={{ height: 14, width: j === 0 ? '70%' : '55%', marginLeft: c.alinhar === 'dir' ? 'auto' : undefined }} /></td>)}
                  {acoes && <td />}
                </tr>
              ))
            ) : exibidas.length === 0 ? (
              <tr><td colSpan={nColunas} className="ui-tb-vazio">{vazio ?? <div className="ui-empty"><div className="ui-empty-title">Nenhum registro encontrado</div></div>}</td></tr>
            ) : exibidas.map(l => {
              const destino = href?.(l)
              return (
                <tr key={chave(l)} className={`${destino ? 'clicavel' : ''} ${destaque?.(l) ? 'destaque' : ''}`}
                  onClick={destino ? e => abrir(e, l) : undefined}
                  onKeyDown={destino ? e => abrir(e, l) : undefined}
                  tabIndex={destino ? 0 : undefined}>
                  {colunas.map(c => <td key={c.id} className={classe(c)}>{c.celula(l)}</td>)}
                  {acoes && (
                    <td className="dir ui-tb-td-acoes">
                      <div className="ui-tb-acoes">
                        {acoes(l).filter((a): a is Acao => !!a).map(a => <BotaoAcao key={a.rotulo} a={a} onPedir={setPendente} />)}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
          {rodape && !carregando && exibidas.length > 0 && <tfoot>{rodape}</tfoot>}
        </table>
      </div>
      {paginar && !carregando && <Paginacao controle={controle} rotulo={rotulo} />}
      {acoes && (
        <ConfirmDialog aberto={!!pendente} titulo={pendente?.confirmar?.titulo ?? ''} confirmarTexto={pendente?.confirmar?.botao ?? pendente?.rotulo ?? 'Confirmar'}
          perigo={pendente?.perigo} carregando={executando} onConfirmar={executar} onCancelar={() => setPendente(null)}>
          {pendente?.confirmar?.texto}
        </ConfirmDialog>
      )}
    </div>
  )
}

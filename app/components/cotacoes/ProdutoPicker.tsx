'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { brl } from '@/lib/cotacao'

export type ProdutoCadastro = { id: string; nome: string; fornecedor: string | null; unidade: string; preco_tabela: number }

type Props = {
  produtos: ProdutoCadastro[]
  nome: string
  produtoId: string | null
  onEscolher: (p: ProdutoCadastro) => void
  onLivre: (nome: string) => void
  onConcluir?: () => void
  inputProps?: React.InputHTMLAttributes<HTMLInputElement> & { [k: `data-${string}`]: string | number }
}

// Campo de produto: digitar filtra o cadastro; setas navegam; Enter escolhe.
// Se o produto não existe no cadastro, dá para usar o nome digitado.
export default function ProdutoPicker({ produtos, nome, produtoId, onEscolher, onLivre, onConcluir, inputProps }: Props) {
  const [aberto, setAberto] = useState(false)
  const [termo, setTermo] = useState<string | null>(null)
  const [ativo, setAtivo] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)
  const listaId = useId()

  const texto = termo ?? nome
  const filtrados = useMemo(() => {
    const t = (termo ?? '').trim().toLowerCase()
    const base = t ? produtos.filter(p => p.nome.toLowerCase().includes(t) || (p.fornecedor ?? '').toLowerCase().includes(t)) : produtos
    return base.slice(0, 50)
  }, [produtos, termo])
  const livre = (termo ?? '').trim() && !produtos.some(p => p.nome.toLowerCase() === termo!.trim().toLowerCase()) ? termo!.trim() : ''
  const total = filtrados.length + (livre ? 1 : 0)

  useEffect(() => {
    function fora(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) fechar()
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  })

  useEffect(() => {
    listaRef.current?.querySelector<HTMLElement>(`[data-idx="${ativo}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [ativo])

  function fechar() {
    if (termo != null && termo.trim() && termo.trim() !== nome) onLivre(termo.trim())
    setTermo(null)
    setAberto(false)
  }

  function escolher(idx: number) {
    if (idx < filtrados.length) onEscolher(filtrados[idx])
    else if (livre) onLivre(livre)
    setTermo(null)
    setAberto(false)
    onConcluir?.()
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAberto(true); setAtivo(a => Math.min(a + 1, total - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo(a => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      if (aberto && total > 0) escolher(ativo)
      else onConcluir?.()
    }
    else if (e.key === 'Escape') { setTermo(null); setAberto(false) }
    else if (e.key === 'Tab') fechar()
  }

  const selecionado = produtos.find(p => p.id === produtoId)

  return (
    <div ref={wrapRef} className="pp-wrap">
      <style>{`
        .pp-wrap{position:relative;flex:1;min-width:0}
        .pp-input{width:100%;border:1.5px solid transparent;background:transparent;border-radius:9px;padding:.5rem .65rem;font-family:'Poppins',sans-serif;font-size:.95rem;font-weight:600;color:#162a1e;outline:none;transition:border-color .15s,background .15s,box-shadow .15s}
        .pp-input:hover{background:#faf8f5}
        .pp-input:focus{background:#fff;border-color:#E67E22;box-shadow:0 0 0 3px rgba(230,126,34,.12)}
        .pp-input::placeholder{color:#b8bdb6;font-weight:600}
        .pp-pop{position:absolute;top:calc(100% + 4px);left:0;min-width:100%;width:max(100%,360px);background:#fff;border:1px solid #eae5de;border-radius:12px;box-shadow:0 16px 40px rgba(22,42,30,.16);z-index:400;overflow:hidden}
        .pp-lista{max-height:280px;overflow-y:auto;padding:.3rem}
        .pp-opt{display:flex;align-items:center;gap:.7rem;width:100%;text-align:left;border:none;background:none;padding:.55rem .65rem;border-radius:8px;cursor:pointer;font-family:'Poppins',sans-serif}
        .pp-opt.ativo{background:#f7f5f1}
        .pp-opt.sel .pp-nome{color:#E67E22}
        .pp-ico{width:30px;height:30px;border-radius:8px;background:#fdf3e9;color:#E67E22;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:.7rem;font-weight:600}
        .pp-txt{flex:1;min-width:0}
        .pp-nome{font-size:.8rem;font-weight:600;color:#162a1e}
        .pp-sub{font-size:.66rem;color:#8f978f;margin-top:.1rem}
        .pp-preco{font-size:.74rem;font-weight:600;color:#162a1e;white-space:nowrap}
        .pp-livre .pp-ico{background:#f2efea;color:#5b6660}
        .pp-vazio{padding:.9rem;text-align:center;font-size:.74rem;color:#8f978f}
        .pp-dica{padding:.45rem .8rem;border-top:1px solid #f2efea;background:#faf8f5;font-size:.62rem;color:#8f978f;display:flex;gap:.8rem}
        .pp-dica kbd{font-family:inherit;font-weight:600;border:1px solid #eae5de;background:#fff;border-radius:4px;padding:0 .3rem}
      `}</style>
      <input
        {...inputProps}
        className="pp-input"
        value={texto}
        placeholder={termo === '' && nome ? nome : produtos.length ? 'Buscar produto do cadastro...' : 'Nome do produto (ex.: 20-00-20)'}
        onFocus={e => { setTermo(''); setAtivo(0); setAberto(true); inputProps?.onFocus?.(e) }}
        onChange={e => { setTermo(e.target.value); setAtivo(0); setAberto(true) }}
        onKeyDown={onKey}
        autoComplete="off"
        role="combobox"
        aria-expanded={aberto}
        aria-controls={listaId}
        aria-label="Produto"
      />
      {aberto && (
        <div className="pp-pop">
          <div className="pp-lista" ref={listaRef} role="listbox" id={listaId}>
            {filtrados.map((p, i) => (
              <button key={p.id} type="button" data-idx={i} role="option" aria-selected={p.id === selecionado?.id}
                className={`pp-opt ${i === ativo ? 'ativo' : ''} ${p.id === selecionado?.id ? 'sel' : ''}`}
                onMouseEnter={() => setAtivo(i)} onMouseDown={e => e.preventDefault()} onClick={() => escolher(i)}>
                <span className="pp-ico">{p.unidade.slice(0, 3)}</span>
                <span className="pp-txt"><div className="pp-nome">{p.nome}</div><div className="pp-sub">{p.fornecedor || 'Sem fornecedor'}</div></span>
                <span className="pp-preco">{brl(Number(p.preco_tabela))}</span>
              </button>
            ))}
            {livre && (
              <button type="button" data-idx={filtrados.length} className={`pp-opt pp-livre ${ativo === filtrados.length ? 'ativo' : ''}`}
                onMouseEnter={() => setAtivo(filtrados.length)} onMouseDown={e => e.preventDefault()} onClick={() => escolher(filtrados.length)}>
                <span className="pp-ico">+</span>
                <span className="pp-txt"><div className="pp-nome">Usar &quot;{livre}&quot;</div><div className="pp-sub">Produto fora do cadastro, só nesta cotação</div></span>
              </button>
            )}
            {total === 0 && <div className="pp-vazio">{produtos.length ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado. Digite o nome.'}</div>}
          </div>
          <div className="pp-dica"><span><kbd>↑</kbd> <kbd>↓</kbd> navegar</span><span><kbd>Enter</kbd> escolher</span><span><kbd>Esc</kbd> fechar</span></div>
        </div>
      )}
    </div>
  )
}

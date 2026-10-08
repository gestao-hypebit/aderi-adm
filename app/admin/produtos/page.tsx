'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import NumInput from '@/app/components/cotacoes/NumInput'
import Tabela from '@/app/components/Tabela'
import { brl } from '@/lib/cotacao'

type Produto = {
  id: string
  nome: string
  fornecedor: string | null
  unidade: string
  preco_tabela: number
  observacoes: string | null
  ativo: boolean
}

const VAZIO = { nome: '', fornecedor: '', unidade: 'TON', preco_tabela: 0, observacoes: '', ativo: true }

function IconPlus() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function IconArrowLeft() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
}
function IconBox() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
}

export default function ProdutosPage() {
  const supabase = createClient()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState<string | null>(null) // id, 'novo' ou null
  const [form, setForm] = useState(VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const [versao, setVersao] = useState(0)
  const carregar = () => setVersao(v => v + 1)

  useEffect(() => {
    supabase.from('produtos').select('*').order('nome').then(({ data }) => {
      setProdutos(((data ?? []) as Produto[]).map(p => ({ ...p, preco_tabela: Number(p.preco_tabela) })))
      setCarregando(false)
    })
  }, [versao])

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return produtos.filter(p => !t || p.nome.toLowerCase().includes(t) || (p.fornecedor ?? '').toLowerCase().includes(t))
  }, [produtos, busca])

  function abrir(p?: Produto) {
    setErro('')
    if (p) {
      setEditando(p.id)
      setForm({ nome: p.nome, fornecedor: p.fornecedor ?? '', unidade: p.unidade, preco_tabela: p.preco_tabela, observacoes: p.observacoes ?? '', ativo: p.ativo })
    } else {
      setEditando('novo')
      setForm(VAZIO)
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome.trim()) { setErro('Informe o nome do produto.'); return }
    setSalvando(true)
    const payload = {
      nome: form.nome.trim(), fornecedor: form.fornecedor.trim() || null, unidade: form.unidade.trim().toUpperCase() || 'TON',
      preco_tabela: form.preco_tabela, observacoes: form.observacoes.trim() || null, ativo: form.ativo, updated_at: new Date().toISOString(),
    }
    const { error } = editando === 'novo'
      ? await supabase.from('produtos').insert(payload)
      : await supabase.from('produtos').update(payload).eq('id', editando)
    setSalvando(false)
    if (error) { setErro('Erro ao salvar o produto.'); return }
    setEditando(null)
    carregar()
  }

  async function excluirProduto(p: Produto) {
    setErro('')
    const { error } = await supabase.from('produtos').delete().eq('id', p.id)
    if (error) { setErro('Não foi possível excluir. Desative o produto em vez disso.'); return }
    carregar()
  }

  async function alternarAtivo(p: Produto) {
    setErro('')
    const { error } = await supabase.from('produtos').update({ ativo: !p.ativo, updated_at: new Date().toISOString() }).eq('id', p.id)
    if (error) { setErro('Não foi possível alterar o produto.'); return }
    carregar()
  }

  return (
    <>

      <div className="ui-breadcrumb">
        <Link href="/admin/cotacoes"><IconArrowLeft /> Cotações</Link>
        <span className="ui-breadcrumb-sep">/</span>
        <span className="ui-breadcrumb-atual">Produtos</span>
      </div>

      <div className="ui-page-header">
        <div>
          <div className="ui-title">Produtos</div>
          <div className="ui-sub">Cadastro usado nas cotações: fornecedor, unidade e preço de tabela.</div>
        </div>
        <div className="ui-header-actions">
          <button className="ui-btn ui-btn-primary" onClick={() => abrir()}><IconPlus /> Novo produto</button>
        </div>
      </div>

      {erro && !editando && <div className="ui-alert ui-alert-erro">{erro}</div>}

      <div style={{ marginBottom: '1rem' }}>
        <input className="ui-input" style={{ maxWidth: 320 }} placeholder="Buscar produto ou fornecedor..." value={busca} onChange={e => setBusca(e.target.value)} />
      </div>

      <Tabela
        linhas={lista}
        chave={p => p.id}
        carregando={carregando}
        reiniciar={busca}
        rotulo="produtos"
        acoes={p => [
          { rotulo: 'Editar', icone: 'editar', onClick: () => abrir(p) },
          p.ativo
            ? { rotulo: 'Desativar (some das cotações)', icone: 'desativar', onClick: () => alternarAtivo(p) }
            : { rotulo: 'Reativar', icone: 'concluir', onClick: () => alternarAtivo(p) },
          { rotulo: 'Excluir', icone: 'excluir', perigo: true, onClick: () => excluirProduto(p),
            confirmar: { titulo: `Excluir ${p.nome}?`, botao: 'Excluir', texto: 'O produto sai do cadastro. Cotações já feitas mantêm o nome do produto.' } },
        ]}
        vazio={
          <div className="ui-empty">
            <div className="ui-empty-icon"><IconBox /></div>
            <div className="ui-empty-title">{produtos.length === 0 ? 'Nenhum produto cadastrado' : 'Nenhum produto encontrado'}</div>
            <div className="ui-empty-text">Cadastre os produtos para escolher direto na cotação.</div>
          </div>
        }
        colunas={[
          { id: 'nome', titulo: 'Produto', ordenar: (a, b) => a.nome.localeCompare(b.nome),
            celula: p => <div className="ui-cel-txt" style={{ opacity: p.ativo ? 1 : .55 }}><div className="ui-cel-titulo">{p.nome}</div>{p.observacoes && <div className="ui-cel-sub">{p.observacoes}</div>}</div> },
          { id: 'forn', titulo: 'Fornecedor', ocultar: 'celular', ordenar: (a, b) => (a.fornecedor ?? '').localeCompare(b.fornecedor ?? ''),
            celula: p => p.fornecedor || <span className="ui-cel-mudo">—</span> },
          { id: 'und', titulo: 'Unid.', largura: '80px', ocultar: 'celular', celula: p => p.unidade },
          { id: 'preco', titulo: 'Preço tabela', alinhar: 'dir', ordenar: (a, b) => a.preco_tabela - b.preco_tabela,
            celula: p => <span className="ui-cel-num ui-cel-forte">{brl(p.preco_tabela)}</span> },
          { id: 'status', titulo: 'Status', largura: '100px', ocultar: 'tablet', ordenar: (a, b) => Number(b.ativo) - Number(a.ativo),
            celula: p => <span className={`ui-badge ${p.ativo ? 'ui-badge-realizada' : 'ui-badge-neutro'}`}>{p.ativo ? 'Ativo' : 'Inativo'}</span> },
        ]}
      />

      {editando && (
        <div className="ui-modal-overlay" onClick={() => !salvando && setEditando(null)}>
          <form className="ui-modal" onClick={e => e.stopPropagation()} onSubmit={salvar}>
            <div className="ui-title" style={{ fontSize: '1.1rem', marginBottom: '1.1rem' }}>{editando === 'novo' ? 'Novo produto' : 'Editar produto'}</div>
            {erro && <div className="ui-alert ui-alert-erro">{erro}</div>}
            <div className="ui-field"><label className="ui-label">Nome <span className="ui-req">*</span></label><input className="ui-input" autoFocus placeholder="Ex.: 20-00-20" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div className="ui-grid-2">
              <div className="ui-field"><label className="ui-label">Fornecedor</label><input className="ui-input" placeholder="Ex.: Eurochem - Heringer" value={form.fornecedor} onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))} /></div>
              <div className="ui-field"><label className="ui-label">Unidade</label><input className="ui-input" value={form.unidade} onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))} /></div>
            </div>
            <div className="ui-field"><label className="ui-label">Preço de tabela (por unidade)</label><NumInput valor={form.preco_tabela} onChange={v => setForm(f => ({ ...f, preco_tabela: v }))} /><div className="ui-hint">Em dólar, se a cotação usar PTAX</div></div>
            <div className="ui-field"><label className="ui-label">Observações</label><textarea className="ui-textarea" style={{ minHeight: 70 }} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} /></div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.8rem', fontWeight: 600, color: '#5b6660', marginBottom: '1.2rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} /> Ativo (aparece nas cotações)
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.6rem' }}>
              <button type="button" className="ui-btn ui-btn-ghost" onClick={() => setEditando(null)} disabled={salvando}>Cancelar</button>
              <button type="submit" className="ui-btn ui-btn-primary" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        </div>
      )}

    </>
  )
}

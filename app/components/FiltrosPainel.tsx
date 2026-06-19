'use client'

import { useRef, useEffect, useState } from 'react'
import { type Filtros, type Atalho, calcRange, detectAtalho, defaultFiltros } from '@/lib/dateUtils'

export type { Filtros }

type Props = {
  value: Filtros
  onChange: (f: Filtros) => void
  showFuncionario?: boolean
  showCliente?: boolean
  clientes: { id: string; nome: string }[]
  funcionarios?: { id: string; nome_completo: string }[]
}

export default function FiltrosPainel({
  value,
  onChange,
  showFuncionario = false,
  showCliente = true,
  clientes,
  funcionarios = [],
}: Props) {
  const atalhoAtivo = detectAtalho(value.dataInicio, value.dataFim)
  const ehPersonalizado = atalhoAtivo === null

  const [buscaCliente, setBuscaCliente] = useState(() => {
    const c = clientes.find(c => c.id === value.clienteId)
    return c ? c.nome : ''
  })
  const [dropdownAberto, setDropdownAberto] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownAberto(false)
      }
    }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [])

  useEffect(() => {
    if (!value.clienteId) setBuscaCliente('')
    else {
      const c = clientes.find(c => c.id === value.clienteId)
      if (c) setBuscaCliente(c.nome)
    }
  }, [value.clienteId, clientes])

  function setAtalho(tipo: Atalho) {
    const { inicio, fim } = calcRange(tipo)
    onChange({ ...value, dataInicio: inicio, dataFim: fim })
  }

  function resetDatas() {
    const d = defaultFiltros('este-mes')
    onChange({ ...value, dataInicio: d.dataInicio, dataFim: d.dataFim })
  }

  function limparTudo() {
    onChange(defaultFiltros('este-mes'))
    setBuscaCliente('')
  }

  function selecionarCliente(id: string, nome: string) {
    onChange({ ...value, clienteId: id })
    setBuscaCliente(nome)
    setDropdownAberto(false)
  }

  const clientesFiltrados = buscaCliente.length > 0
    ? clientes.filter(c => c.nome.toLowerCase().includes(buscaCliente.toLowerCase()))
    : clientes.slice(0, 25)

  const funcionarioSelecionado = showFuncionario && value.funcionarioId
    ? funcionarios.find(f => f.id === value.funcionarioId)
    : null

  return (
    <>
      <style>{`
        .fp-wrap{background:#fff;border-radius:12px;padding:.85rem 1.2rem;box-shadow:0 2px 8px rgba(0,0,0,.04);margin-bottom:1.2rem;display:flex;flex-wrap:wrap;gap:.65rem;align-items:center}
        .fp-atalhos{display:flex;gap:.3rem;flex-wrap:wrap}
        .fp-btn{background:#f0ede8;border:1.5px solid transparent;border-radius:20px;padding:.3rem .8rem;font-family:'Comfortaa',sans-serif;font-size:.72rem;font-weight:700;color:#888;cursor:pointer;transition:all .15s;white-space:nowrap}
        .fp-btn:hover{border-color:#E67E22;color:#E67E22}
        .fp-btn.fp-ativo{background:#162a1e;color:#fff;border-color:#162a1e}
        .fp-sep{width:1px;background:#eae5de;height:22px;flex-shrink:0}
        .fp-datas{display:flex;gap:.4rem;align-items:center}
        .fp-input{padding:.3rem .6rem;border:1.5px solid #eae5de;border-radius:7px;font-family:'Comfortaa',sans-serif;font-size:.76rem;color:#162a1e;background:#fff;outline:none;transition:border-color .15s}
        .fp-input:focus,.fp-input.fp-custom{border-color:#E67E22}
        .fp-ate{font-size:.7rem;color:#aaa;font-weight:700}
        .fp-reset-datas{background:none;border:none;cursor:pointer;color:#aaa;font-size:.85rem;line-height:1;padding:.15rem .3rem;border-radius:4px;transition:color .15s;font-family:'Comfortaa',sans-serif}
        .fp-reset-datas:hover{color:#e74c3c}
        .fp-dropdowns{display:flex;gap:.4rem;flex-wrap:wrap;align-items:center}
        .fp-select{padding:.3rem .6rem;border:1.5px solid #eae5de;border-radius:7px;font-family:'Comfortaa',sans-serif;font-size:.76rem;color:#162a1e;background:#fff;outline:none;cursor:pointer;transition:border-color .15s}
        .fp-select:focus{border-color:#E67E22}
        .fp-cliente-wrap{position:relative}
        .fp-cli-input{padding:.3rem .6rem;border:1.5px solid #eae5de;border-radius:7px;font-family:'Comfortaa',sans-serif;font-size:.76rem;color:#162a1e;background:#fff;outline:none;width:160px;transition:border-color .15s}
        .fp-cli-input:focus{border-color:#E67E22}
        .fp-dropdown{position:absolute;top:calc(100% + 3px);left:0;min-width:220px;max-height:210px;overflow-y:auto;background:#fff;border:1.5px solid #eae5de;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.12);z-index:300}
        .fp-opt{padding:.42rem .9rem;font-size:.78rem;color:#162a1e;cursor:pointer;transition:background .1s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:'Comfortaa',sans-serif}
        .fp-opt:hover{background:#f0ede8}
        .fp-opt-limpar{color:#aaa;border-bottom:1px solid #f0ede8;font-style:italic}
        .fp-opt-vazio{color:#bbb}
        .fp-chip{display:inline-flex;align-items:center;gap:.3rem;background:#162a1e;color:#fff;border-radius:20px;padding:.3rem .8rem;font-size:.72rem;font-weight:700;cursor:pointer;white-space:nowrap;transition:background .15s}
        .fp-chip:hover{background:#0d1f14}
        .fp-chip-x{opacity:.65;font-size:.9rem;line-height:1}
        .fp-limpar{background:none;border:1.5px solid #eae5de;border-radius:7px;padding:.3rem .75rem;font-family:'Comfortaa',sans-serif;font-size:.72rem;font-weight:700;color:#aaa;cursor:pointer;transition:all .15s;white-space:nowrap}
        .fp-limpar:hover{border-color:#e74c3c;color:#e74c3c}
      `}</style>

      <div className="fp-wrap">
        <div className="fp-atalhos">
          {([
            ['hoje', 'Hoje'],
            ['esta-semana', 'Esta semana'],
            ['este-mes', 'Este mês'],
            ['este-ano', 'Este ano'],
          ] as [Atalho, string][]).map(([k, label]) => (
            <button
              key={k}
              className={`fp-btn ${atalhoAtivo === k ? 'fp-ativo' : ''}`}
              onClick={() => setAtalho(k)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="fp-sep" />

        <div className="fp-datas">
          <input
            type="date"
            className={`fp-input${ehPersonalizado ? ' fp-custom' : ''}`}
            value={value.dataInicio}
            onChange={e => onChange({ ...value, dataInicio: e.target.value })}
          />
          <span className="fp-ate">até</span>
          <input
            type="date"
            className={`fp-input${ehPersonalizado ? ' fp-custom' : ''}`}
            value={value.dataFim}
            onChange={e => onChange({ ...value, dataFim: e.target.value })}
          />
          {ehPersonalizado && (
            <button
              className="fp-reset-datas"
              onClick={resetDatas}
              title="Limpar período personalizado (voltar para Este mês)"
            >
              ×
            </button>
          )}
        </div>

        <div className="fp-sep" />

        <div className="fp-dropdowns">
          {showCliente && value.clienteId ? (
            <div
              className="fp-chip"
              onClick={() => { onChange({ ...value, clienteId: '' }); setBuscaCliente('') }}
              title="Remover filtro de cliente"
            >
              {clientes.find(c => c.id === value.clienteId)?.nome ?? 'Cliente'}
              <span className="fp-chip-x">×</span>
            </div>
          ) : showCliente ? (
            <div className="fp-cliente-wrap" ref={dropdownRef}>
              <input
                className="fp-cli-input"
                placeholder="Filtrar cliente..."
                value={buscaCliente}
                onChange={e => { setBuscaCliente(e.target.value); setDropdownAberto(true) }}
                onFocus={() => setDropdownAberto(true)}
              />
              {dropdownAberto && (
                <div className="fp-dropdown">
                  {clientesFiltrados.length === 0 ? (
                    <div className="fp-opt fp-opt-vazio">Nenhum resultado</div>
                  ) : (
                    clientesFiltrados.map(c => (
                      <div key={c.id} className="fp-opt" onClick={() => selecionarCliente(c.id, c.nome)}>
                        {c.nome}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : null}

          {showFuncionario && (
            funcionarioSelecionado ? (
              <div
                className="fp-chip"
                onClick={() => onChange({ ...value, funcionarioId: '' })}
                title="Remover filtro de consultor"
              >
                {funcionarioSelecionado.nome_completo}
                <span className="fp-chip-x">×</span>
              </div>
            ) : (
              <select
                className="fp-select"
                value={value.funcionarioId}
                onChange={e => onChange({ ...value, funcionarioId: e.target.value })}
              >
                <option value="">Todos os consultores</option>
                {funcionarios.map(f => (
                  <option key={f.id} value={f.id}>{f.nome_completo}</option>
                ))}
              </select>
            )
          )}

          <button className="fp-limpar" onClick={limparTudo}>
            Limpar filtros
          </button>
        </div>
      </div>
    </>
  )
}

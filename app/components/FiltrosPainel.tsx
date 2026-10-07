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
        .fp-wrap{background:#fff;border:1px solid #f2efea;border-radius:16px;padding:.7rem .8rem;box-shadow:0 1px 2px rgba(22,42,30,.04),0 2px 10px rgba(22,42,30,.04);margin-bottom:1.4rem;display:flex;flex-wrap:wrap;gap:.6rem .75rem;align-items:center}
        .fp-label{font-size:.62rem;font-weight:700;color:#8f978f;text-transform:uppercase;letter-spacing:.1em;padding-left:.35rem}
        .fp-atalhos{display:inline-flex;background:#f7f5f1;border:1px solid #eae5de;border-radius:10px;padding:3px;gap:2px;flex-wrap:wrap}
        .fp-btn{background:transparent;border:none;border-radius:7px;padding:.42rem .8rem;font-family:'Comfortaa',sans-serif;font-size:.72rem;font-weight:700;color:#8f978f;cursor:pointer;transition:all .15s;white-space:nowrap}
        .fp-btn:hover{color:#162a1e}
        .fp-btn.fp-ativo{background:#fff;color:#162a1e;box-shadow:0 1px 3px rgba(22,42,30,.14)}
        .fp-sep{width:1px;background:#eae5de;height:24px;flex-shrink:0}
        .fp-datas{display:flex;gap:.4rem;align-items:center}
        .fp-input{padding:.42rem .6rem;border:1.5px solid #eae5de;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.74rem;color:#162a1e;background:#fff;outline:none;transition:border-color .15s}
        .fp-input:focus,.fp-input.fp-custom{border-color:#E67E22}
        .fp-ate{font-size:.68rem;color:#8f978f;font-weight:700}
        .fp-reset-datas{background:#f7f5f1;border:none;cursor:pointer;color:#8f978f;font-size:.85rem;line-height:1;width:24px;height:24px;border-radius:6px;transition:all .15s;font-family:'Comfortaa',sans-serif}
        .fp-reset-datas:hover{color:#e74c3c;background:#fdeeec}
        .fp-dropdowns{display:flex;gap:.45rem;flex-wrap:wrap;align-items:center;margin-left:auto}
        .fp-select{padding:.42rem 2rem .42rem .7rem;border:1.5px solid #eae5de;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.74rem;color:#162a1e;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238f978f' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right .6rem center;appearance:none;-webkit-appearance:none;outline:none;cursor:pointer;transition:border-color .15s}
        .fp-select:hover{border-color:#ddd6cc}
        .fp-select:focus{border-color:#E67E22}
        .fp-cliente-wrap{position:relative}
        .fp-cli-input{padding:.42rem .7rem .42rem 1.9rem;border:1.5px solid #eae5de;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.74rem;color:#162a1e;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='%238f978f' stroke-width='2.2'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'/%3E%3C/svg%3E") no-repeat .6rem center;outline:none;width:180px;transition:border-color .15s}
        .fp-cli-input:focus{border-color:#E67E22}
        .fp-cli-input::placeholder{color:#b8bdb6}
        .fp-dropdown{position:absolute;top:calc(100% + 5px);left:0;min-width:240px;max-height:240px;overflow-y:auto;background:#fff;border:1px solid #eae5de;border-radius:12px;box-shadow:0 12px 32px rgba(22,42,30,.14);z-index:300;padding:.3rem}
        .fp-opt{padding:.5rem .7rem;font-size:.76rem;color:#162a1e;cursor:pointer;border-radius:7px;transition:background .1s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:'Comfortaa',sans-serif}
        .fp-opt:hover{background:#f7f5f1}
        .fp-opt-limpar{color:#aaa;border-bottom:1px solid #f0ede8;font-style:italic}
        .fp-opt-vazio{color:#b8bdb6;cursor:default}
        .fp-chip{display:inline-flex;align-items:center;gap:.4rem;background:#162a1e;color:#fff;border-radius:999px;padding:.4rem .5rem .4rem .85rem;font-size:.72rem;font-weight:700;cursor:pointer;white-space:nowrap;transition:background .15s}
        .fp-chip:hover{background:#0d1f14}
        .fp-chip-x{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:rgba(255,255,255,.15);font-size:.8rem;line-height:1}
        .fp-limpar{background:none;border:none;border-radius:8px;padding:.42rem .65rem;font-family:'Comfortaa',sans-serif;font-size:.72rem;font-weight:700;color:#8f978f;cursor:pointer;transition:all .15s;white-space:nowrap}
        .fp-limpar:hover{color:#e74c3c;background:#fdeeec}
        @media(max-width:700px){.fp-sep{display:none}.fp-dropdowns{margin-left:0}.fp-label{display:none}}
      `}</style>

      <div className="fp-wrap">
        <span className="fp-label">Período</span>
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

          {(atalhoAtivo !== 'este-mes' || value.clienteId || value.funcionarioId) && (
            <button className="fp-limpar" onClick={limparTudo}>
              Limpar filtros
            </button>
          )}
        </div>
      </div>
    </>
  )
}

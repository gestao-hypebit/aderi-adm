'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Item = { id: string; grupo: string; titulo: string; sub?: string; href: string; icone: 'acao' | 'pagina' | 'cliente' | 'consultor' | 'visita' }

const ACOES: Item[] = [
  { id: 'a-visita', grupo: 'Ações rápidas', titulo: 'Agendar nova visita', href: '/admin/visitas/novo', icone: 'acao' },
  { id: 'a-cliente', grupo: 'Ações rápidas', titulo: 'Cadastrar cliente', href: '/admin/clientes/novo', icone: 'acao' },
  { id: 'a-consultor', grupo: 'Ações rápidas', titulo: 'Cadastrar consultor', href: '/admin/consultores/novo', icone: 'acao' },
  { id: 'a-atrasadas', grupo: 'Ações rápidas', titulo: 'Ver visitas atrasadas', href: '/admin/visitas?status=atrasada', icone: 'acao' },
]

const PAGINAS: Item[] = [
  { id: 'p-painel', grupo: 'Páginas', titulo: 'Painel', href: '/admin', icone: 'pagina' },
  { id: 'p-agenda', grupo: 'Páginas', titulo: 'Agenda da equipe', href: '/admin/agenda', icone: 'pagina' },
  { id: 'p-visitas', grupo: 'Páginas', titulo: 'Visitas', href: '/admin/visitas', icone: 'pagina' },
  { id: 'p-clientes', grupo: 'Páginas', titulo: 'Clientes', href: '/admin/clientes', icone: 'pagina' },
  { id: 'p-consultores', grupo: 'Páginas', titulo: 'Consultores', href: '/admin/consultores', icone: 'pagina' },
  { id: 'p-relatorios', grupo: 'Páginas', titulo: 'Relatórios', href: '/admin/relatorios', icone: 'pagina' },
  { id: 'p-rel-km', grupo: 'Páginas', titulo: 'Relatório de KM / Combustível', href: '/admin/relatorios/km', icone: 'pagina' },
]

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function Icone({ tipo }: { tipo: Item['icone'] }) {
  const p = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }
  if (tipo === 'acao') return <svg {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  if (tipo === 'pagina') return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
  if (tipo === 'cliente') return <svg {...p}><path d="M7 20h10"/><path d="M10 20c0-4 .5-8 2-10"/><path d="M14 20c0-4-.5-8-2-10"/><path d="M5 5c1.5 0 3 1 3.5 3C7 8 5 7.5 4 6c-.5-1 0-1 1-1z"/><path d="M19 8c-1.5 0-3 .5-4 2 1.5 1 3 1 4 0 1-.5 1-1.5 0-2z"/></svg>
  if (tipo === 'consultor') return <svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  return <svg {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}

export default function CommandPalette({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const router = useRouter()
  const [termo, setTermo] = useState('')
  const [ativo, setAtivo] = useState(0)
  const [dados, setDados] = useState<Item[] | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)

  // Recarrega a base de busca a cada abertura (mantém a anterior enquanto carrega)
  useEffect(() => {
    if (!aberto) return
    const supabase = createClient()
    Promise.all([
      supabase.from('clientes').select('id, nome, nome_fazenda, cidade').order('nome'),
      supabase.from('profiles').select('id, nome_completo, role, ativo').order('nome_completo'),
      supabase.from('visitas').select('id, data_visita, status, cliente:clientes(nome), funcionario:profiles(nome_completo)').order('data_visita', { ascending: false }).limit(300),
    ]).then(([{ data: cli }, { data: prof }, { data: vis }]) => {
      const itens: Item[] = []
      ;(cli ?? []).forEach(c => itens.push({
        id: `c-${c.id}`, grupo: 'Clientes', titulo: c.nome,
        sub: [c.nome_fazenda, c.cidade].filter(Boolean).join(' · '), href: `/admin/clientes/${c.id}`, icone: 'cliente',
      }))
      ;(prof ?? []).forEach(p => itens.push({
        id: `u-${p.id}`, grupo: 'Consultores', titulo: p.nome_completo || 'Sem nome',
        sub: `${p.role === 'admin' ? 'Administrador' : 'Consultor'}${p.ativo === false ? ' · desativado' : ''}`,
        href: `/admin/consultores/${p.id}`, icone: 'consultor',
      }))
      ;(vis ?? []).forEach((v: any) => {
        const cli1 = Array.isArray(v.cliente) ? v.cliente[0] : v.cliente
        const func1 = Array.isArray(v.funcionario) ? v.funcionario[0] : v.funcionario
        itens.push({
          id: `v-${v.id}`, grupo: 'Visitas', titulo: cli1?.nome ?? 'Visita',
          sub: `${new Date(v.data_visita + 'T12:00').toLocaleDateString('pt-BR')} · ${func1?.nome_completo ?? ''} · ${v.status}`,
          href: `/admin/visitas/${v.id}`, icone: 'visita',
        })
      })
      setDados(itens)
    })
  }, [aberto])


  const resultados = useMemo(() => {
    const t = semAcento(termo.trim())
    if (!t) return [...ACOES, ...PAGINAS]
    const casa = (i: Item) => semAcento(i.titulo).includes(t) || semAcento(i.sub ?? '').includes(t)
    const porGrupo = (g: string, max: number) => (dados ?? []).filter(i => i.grupo === g && casa(i)).slice(0, max)
    return [
      ...ACOES.filter(casa),
      ...porGrupo('Clientes', 6),
      ...porGrupo('Consultores', 4),
      ...porGrupo('Visitas', 6),
      ...PAGINAS.filter(casa),
    ]
  }, [termo, dados])

  useEffect(() => {
    listaRef.current?.querySelector<HTMLElement>(`[data-idx="${ativo}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [ativo])

  function ir(i: Item) {
    onFechar()
    router.push(i.href)
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo(a => Math.min(a + 1, resultados.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo(a => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (resultados[ativo]) ir(resultados[ativo]) }
    else if (e.key === 'Escape') { onFechar() }
  }

  if (!aberto) return null

  let grupoAnterior = ''
  return (
    <div className="cmd-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onFechar() }}>
      <style>{`
        .cmd-overlay{position:fixed;inset:0;background:rgba(13,31,20,.45);backdrop-filter:blur(3px);z-index:2000;display:flex;justify-content:center;align-items:flex-start;padding:12vh 1rem 1rem}
        .cmd-box{width:100%;max-width:620px;background:#fff;border-radius:16px;box-shadow:0 30px 80px rgba(13,31,20,.35);overflow:hidden;display:flex;flex-direction:column;max-height:70vh}
        .cmd-input-wrap{display:flex;align-items:center;gap:.7rem;padding:1rem 1.2rem;border-bottom:1px solid #f2efea;color:#8f978f}
        .cmd-input{flex:1;border:none;outline:none;font-family:'Comfortaa',sans-serif;font-size:.95rem;color:#162a1e;background:none}
        .cmd-input::placeholder{color:#b8bdb6}
        .cmd-esc{font-size:.62rem;font-weight:700;color:#8f978f;border:1px solid #eae5de;border-radius:6px;padding:.15rem .4rem}
        .cmd-lista{overflow-y:auto;padding:.4rem}
        .cmd-grupo{font-size:.6rem;font-weight:700;color:#8f978f;text-transform:uppercase;letter-spacing:.12em;padding:.75rem .8rem .35rem}
        .cmd-item{display:flex;align-items:center;gap:.75rem;width:100%;border:none;background:none;text-align:left;padding:.6rem .8rem;border-radius:10px;cursor:pointer;font-family:'Comfortaa',sans-serif}
        .cmd-item.ativo{background:#f7f5f1}
        .cmd-item.ativo .cmd-icone{background:#E67E22;color:#fff}
        .cmd-icone{width:32px;height:32px;border-radius:9px;background:#f7f5f1;color:#5b6660;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .1s}
        .cmd-titulo{font-size:.82rem;font-weight:700;color:#162a1e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .cmd-sub{font-size:.68rem;color:#8f978f;margin-top:.1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .cmd-enter{margin-left:auto;font-size:.62rem;color:#8f978f;opacity:0}
        .cmd-item.ativo .cmd-enter{opacity:1}
        .cmd-vazio{padding:2rem;text-align:center;font-size:.8rem;color:#8f978f}
        .cmd-rodape{display:flex;gap:1rem;padding:.6rem 1.2rem;border-top:1px solid #f2efea;background:#faf8f5;font-size:.64rem;color:#8f978f;font-weight:700}
        @media(max-width:600px){.cmd-overlay{padding-top:1rem}.cmd-rodape{display:none}}
      `}</style>
      <div className="cmd-box" role="dialog" aria-modal="true" aria-label="Busca global">
        <div className="cmd-input-wrap">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            ref={inputRef}
            className="cmd-input"
            placeholder="Buscar clientes, consultores, visitas ou ações..."
            value={termo}
            onChange={e => { setTermo(e.target.value); setAtivo(0) }}
            onKeyDown={onKey}
            autoFocus
          />
          <span className="cmd-esc">ESC</span>
        </div>
        <div className="cmd-lista" ref={listaRef}>
          {termo && !dados && <div className="cmd-vazio">Carregando...</div>}
          {resultados.length === 0 && dados && <div className="cmd-vazio">Nada encontrado para “{termo}”.</div>}
          {resultados.map((i, idx) => {
            const mostraGrupo = i.grupo !== grupoAnterior
            grupoAnterior = i.grupo
            return (
              <div key={i.id}>
                {mostraGrupo && <div className="cmd-grupo">{i.grupo}</div>}
                <button
                  data-idx={idx}
                  className={`cmd-item ${idx === ativo ? 'ativo' : ''}`}
                  onMouseMove={() => setAtivo(idx)}
                  onClick={() => ir(i)}
                >
                  <span className="cmd-icone"><Icone tipo={i.icone} /></span>
                  <span style={{ minWidth: 0 }}>
                    <div className="cmd-titulo">{i.titulo}</div>
                    {i.sub && <div className="cmd-sub">{i.sub}</div>}
                  </span>
                  <span className="cmd-enter">↵</span>
                </button>
              </div>
            )
          })}
        </div>
        <div className="cmd-rodape">
          <span>↑↓ navegar</span><span>↵ abrir</span><span>esc fechar</span>
        </div>
      </div>
    </div>
  )
}

'use client'

import { hojeISO } from '@/lib/dateUtils'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Combobox from '../_ui/Combobox'

type Cliente = { id: string; nome: string; nome_fazenda: string | null; cidade: string | null }
type Colaborador = { id: string; nome_completo: string | null; ativo: boolean | null }

const MOTIVOS = [
  'Visita de rotina',
  'Entrega de produtos',
  'Negociação',
  'Amostra de solo',
  'Amostra de folha',
  'Acompanhamento de entrega de produto',
  'Retorno',
  'Outros',
]

const STATUS_COR: Record<string, string> = { agendada: '#E67E22', realizada: '#27ae60', cancelada: '#e74c3c' }

function IconArrowLeft() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
}
function IconCalendar({ color = 'currentColor' }: { color?: string }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function IconCheck({ color = 'currentColor' }: { color?: string }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
}
function IconX({ color = 'currentColor' }: { color?: string }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
}
function IconAlert() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
}
function IconUser() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
}
function IconSprout() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 20h10"/><path d="M10 20c0-4 .5-8 2-10"/><path d="M14 20c0-4-.5-8-2-10"/><path d="M5 5c1.5 0 3 1 3.5 3C7 8 5 7.5 4 6c-.5-1 0-1 1-1z"/><path d="M19 8c-1.5 0-3 .5-4 2 1.5 1 3 1 4 0 1-.5 1-1.5 0-2z"/></svg>
}

function statusIcon(status: string, color: string) {
  if (status === 'agendada') return <IconCalendar color={color} />
  if (status === 'realizada') return <IconCheck color={color} />
  return <IconX color={color} />
}


export default function VisitaForm({ visitaId }: { visitaId?: string }) {
  const editando = !!visitaId
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [form, setForm] = useState({
    funcionario_id: '',
    cliente_id: '',
    data_visita: hojeISO(),
    hora_visita: '',
    status: 'agendada',
    descricao: '',
    recomendacoes: '',
    proximo_contato: '',
    km_rodado: '',
    motivo_visita: '',
    motivo_outro: '',
  })
  const [carregandoDados, setCarregandoDados] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function carregar() {
      const [{ data: cli }, { data: colab }, visitaRes] = await Promise.all([
        supabase.from('clientes').select('id, nome, nome_fazenda, cidade').order('nome'),
        supabase.from('profiles').select('id, nome_completo, ativo').eq('role', 'colaborador').order('nome_completo'),
        visitaId
          ? supabase.from('visitas').select('*').eq('id', visitaId).single()
          : Promise.resolve({ data: null }),
      ])
      setClientes(cli || [])
      setColaboradores(colab || [])

      const v = visitaRes.data
      if (v) {
        setForm({
          funcionario_id: v.funcionario_id || '',
          cliente_id: v.cliente_id || '',
          data_visita: v.data_visita || hojeISO(),
          hora_visita: v.hora_visita ? String(v.hora_visita).slice(0, 5) : '',
          status: v.status || 'agendada',
          descricao: v.descricao || '',
          recomendacoes: v.recomendacoes || '',
          proximo_contato: v.proximo_contato || '',
          km_rodado: v.km_rodado != null ? String(v.km_rodado) : '',
          motivo_visita: v.motivo_visita || '',
          motivo_outro: v.motivo_outro || '',
        })
      } else {
        // Pré-preenchimento vindo de atalhos (agenda, ficha do cliente, consultor, reagendar)
        const p = (k: string) => searchParams.get(k)
        setForm(f => ({
          ...f,
          cliente_id: p('cliente') ?? f.cliente_id,
          data_visita: p('data') ?? f.data_visita,
          funcionario_id: p('funcionario') ?? f.funcionario_id,
          motivo_visita: p('motivo') ?? f.motivo_visita,
        }))
      }
      setCarregandoDados(false)
    }
    carregar()
  }, [visitaId])

  function atualizar(campo: keyof typeof form, valor: string) {
    setForm(f => ({ ...f, [campo]: valor }))
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.funcionario_id) { setErro('Selecione o consultor responsável.'); return }
    if (!form.cliente_id) { setErro('Selecione o cliente.'); return }
    setSalvando(true)
    setErro('')

    const payload = {
      cliente_id: form.cliente_id,
      funcionario_id: form.funcionario_id,
      data_visita: form.data_visita,
      hora_visita: form.hora_visita || null,
      status: form.status,
      descricao: form.descricao || null,
      recomendacoes: form.recomendacoes || null,
      proximo_contato: form.proximo_contato || null,
      km_rodado: form.km_rodado ? parseFloat(form.km_rodado) : null,
      motivo_visita: form.motivo_visita || null,
      motivo_outro: form.motivo_visita === 'Outros' ? (form.motivo_outro || null) : null,
    }

    if (editando) {
      const { error } = await supabase.from('visitas').update(payload).eq('id', visitaId)
      if (error) { setErro('Erro ao salvar. Tente novamente.'); setSalvando(false); return }
      router.push(`/admin/visitas/${visitaId}`)
    } else {
      const { data, error } = await supabase.from('visitas').insert(payload).select('id').single()
      if (error || !data) { setErro('Erro ao salvar. Tente novamente.'); setSalvando(false); return }
      router.push(`/admin/visitas/${data.id}`)
    }
  }

  const clienteSel = clientes.find(c => c.id === form.cliente_id)
  const colabSel = colaboradores.find(c => c.id === form.funcionario_id)
  // Consultores desativados não aparecem para novas visitas, mas continuam visíveis se já forem os responsáveis
  const colabsVisiveis = colaboradores.filter(c => c.ativo !== false || c.id === form.funcionario_id)
  const voltarHref = editando ? `/admin/visitas/${visitaId}` : '/admin/agenda'

  if (carregandoDados) {
    return (
      <div>
        <div className="ui-skeleton" style={{ height: 14, width: 160, marginBottom: '1rem' }} />
        <div className="ui-skeleton" style={{ height: 36, width: 280, marginBottom: '1.5rem' }} />
        <div className="ui-skeleton" style={{ height: 480, borderRadius: 16 }} />
      </div>
    )
  }

  return (
    <>
      <style>{`
        .nv-layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:1.2rem;align-items:start}
        .nv-secao{padding:1.35rem 1.5rem;border-bottom:1px solid #f2efea}
        .nv-secao-head{display:flex;align-items:center;gap:.7rem;margin-bottom:1.05rem}
        .nv-passo{width:26px;height:26px;border-radius:50%;background:#fdf3e9;color:#E67E22;font-size:.72rem;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .nv-secao-titulo{font-size:.9rem;font-weight:600;color:#162a1e}
        .nv-secao-desc{font-size:.7rem;color:#8f978f;margin-top:.1rem}
        .nv-colabs{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:.55rem}
        .nv-colab{display:flex;align-items:center;gap:.65rem;padding:.65rem .8rem;border:1.5px solid #eae5de;border-radius:12px;background:#fff;cursor:pointer;font-family:'Poppins',sans-serif;font-size:.8rem;font-weight:600;color:#5b6660;text-align:left;transition:all .15s}
        .nv-colab:hover{border-color:#cfc8bd;color:#162a1e}
        .nv-colab.ativo{border-color:#E67E22;background:#fffaf5;color:#162a1e;box-shadow:0 0 0 3px rgba(230,126,34,.12)}
        .nv-colab.ativo .ui-avatar{background:#E67E22}
        .nv-grid-3{display:grid;grid-template-columns:1fr 130px 1fr;gap:0 1rem}
        .nv-status{display:grid;grid-template-columns:repeat(3,1fr);gap:.55rem}
        .nv-status-opt{display:flex;align-items:center;justify-content:center;gap:.45rem;border:1.5px solid #eae5de;border-radius:10px;padding:.7rem;cursor:pointer;font-family:'Poppins',sans-serif;font-size:.78rem;font-weight:600;color:#8f978f;background:#fff;transition:all .15s}
        .nv-status-opt:hover{border-color:#cfc8bd}
        .nv-actions{display:flex;gap:.6rem;justify-content:flex-end;padding:1rem 1.5rem;background:#faf8f5;border-radius:0 0 16px 16px;position:sticky;bottom:0;border-top:1px solid #f2efea}
        .nv-resumo{position:sticky;top:80px;padding:1.2rem 1.25rem}
        .nv-resumo-titulo{font-size:.66rem;font-weight:600;color:#8f978f;text-transform:uppercase;letter-spacing:.1em;margin-bottom:.9rem}
        .nv-resumo-item{display:flex;gap:.65rem;align-items:flex-start;padding:.6rem 0;border-bottom:1px dashed #eae5de}
        .nv-resumo-item:last-child{border-bottom:none}
        .nv-resumo-icon{width:30px;height:30px;border-radius:9px;background:#f7f5f1;color:#8f978f;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .nv-resumo-label{font-size:.62rem;font-weight:600;color:#8f978f;text-transform:uppercase;letter-spacing:.06em}
        .nv-resumo-valor{font-size:.8rem;font-weight:600;color:#162a1e;margin-top:.15rem;word-break:break-word}
        .nv-resumo-valor.vazio{color:#b8bdb6;font-weight:400}
        @media(max-width:960px){.nv-layout{grid-template-columns:1fr}.nv-resumo{display:none}}
        @media(max-width:640px){.nv-secao{padding:1.15rem 1.1rem}.nv-actions{padding:.9rem 1.1rem}.nv-status{grid-template-columns:1fr}.nv-grid-3{grid-template-columns:1fr 1fr}.nv-grid-3>:last-child{grid-column:1/-1}.nv-actions .ui-btn{flex:1}}
      `}</style>

      <div className="ui-breadcrumb">
        <Link href={editando ? '/admin/visitas' : '/admin/agenda'}><IconArrowLeft /> {editando ? 'Visitas' : 'Agenda'}</Link>
        {editando && (
          <>
            <span className="ui-breadcrumb-sep">/</span>
            <Link href={`/admin/visitas/${visitaId}`}>{clienteSel?.nome ?? 'Visita'}</Link>
          </>
        )}
        <span className="ui-breadcrumb-sep">/</span>
        <span className="ui-breadcrumb-atual">{editando ? 'Editar' : 'Nova visita'}</span>
      </div>
      <div className="ui-page-header">
        <div>
          <div className="ui-title">{editando ? 'Editar visita' : 'Agendar nova visita'}</div>
          <div className="ui-sub">
            {editando
              ? 'Altere qualquer informação da visita. As fotos e a observação de finalização continuam na página da visita.'
              : 'Escolha o consultor, o cliente e a data. Os detalhes podem ser preenchidos depois.'}
          </div>
        </div>
      </div>

      <div className="nv-layout">
        <form onSubmit={salvar} className="ui-card">
          <div className="nv-secao">
            <div className="nv-secao-head">
              <div className="nv-passo">1</div>
              <div>
                <div className="nv-secao-titulo">Consultor responsável <span style={{ color: '#E67E22' }}>*</span></div>
                <div className="nv-secao-desc">A visita aparece na agenda desta pessoa</div>
              </div>
            </div>
            {colabsVisiveis.length === 0 ? (
              <div className="ui-hint">Nenhum consultor ativo. <Link href="/admin/consultores/novo" style={{ color: '#E67E22', fontWeight: 600 }}>Cadastrar consultor</Link></div>
            ) : (
              <div className="nv-colabs" role="radiogroup" aria-label="Consultor">
                {colabsVisiveis.map(c => (
                  <button
                    type="button"
                    key={c.id}
                    role="radio"
                    aria-checked={form.funcionario_id === c.id}
                    className={`nv-colab ${form.funcionario_id === c.id ? 'ativo' : ''}`}
                    onClick={() => atualizar('funcionario_id', c.id)}
                  >
                    <span className="ui-avatar ui-avatar-sm">{(c.nome_completo || '?').charAt(0).toUpperCase()}</span>
                    {c.nome_completo}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="nv-secao">
            <div className="nv-secao-head">
              <div className="nv-passo">2</div>
              <div>
                <div className="nv-secao-titulo">Cliente, data e motivo</div>
                <div className="nv-secao-desc">Quem será visitado, quando e por quê</div>
              </div>
            </div>
            <div className="ui-field">
              <label className="ui-label">Cliente <span className="ui-req">*</span></label>
              <Combobox
                opcoes={clientes.map(c => ({ id: c.id, label: c.nome, sub: [c.nome_fazenda, c.cidade].filter(Boolean).join(' · ') || null }))}
                valor={form.cliente_id}
                onChange={id => atualizar('cliente_id', id)}
                placeholder="Buscar cliente por nome, fazenda ou cidade..."
                vazioTexto="Nenhum cliente encontrado"
                acaoExtra={{ label: '+ Cadastrar novo cliente', onClick: () => router.push('/admin/clientes/novo') }}
              />
            </div>
            <div className="nv-grid-3">
              <div className="ui-field">
                <label className="ui-label">Data <span className="ui-req">*</span></label>
                <input className="ui-input" type="date" value={form.data_visita} onChange={e => atualizar('data_visita', e.target.value)} required/>
              </div>
              <div className="ui-field">
                <label className="ui-label">Horário</label>
                <input className="ui-input" type="time" value={form.hora_visita} onChange={e => atualizar('hora_visita', e.target.value)}/>
              </div>
              <div className="ui-field">
                <label className="ui-label">Motivo</label>
                <select className="ui-select" value={form.motivo_visita} onChange={e => atualizar('motivo_visita', e.target.value)}>
                  <option value="">Selecione o motivo...</option>
                  {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            {form.motivo_visita === 'Outros' && (
              <div className="ui-field" style={{ marginBottom: 0 }}>
                <label className="ui-label">Descreva o motivo</label>
                <input className="ui-input" type="text" placeholder="Ex: visita técnica de pós-venda" value={form.motivo_outro} onChange={e => atualizar('motivo_outro', e.target.value)}/>
              </div>
            )}
          </div>

          {/* status só na edição: visita nova sempre nasce agendada */}
          {editando && <div className="nv-secao">
            <div className="nv-secao-head">
              <div className="nv-passo">3</div>
              <div>
                <div className="nv-secao-titulo">Status</div>
                <div className="nv-secao-desc">Use “Realizada” para registrar uma visita que já aconteceu</div>
              </div>
            </div>
            <div className="nv-status" role="radiogroup" aria-label="Status">
              {['agendada', 'realizada', 'cancelada'].map(s => {
                const sel = form.status === s
                return (
                  <button
                    type="button"
                    key={s}
                    role="radio"
                    aria-checked={sel}
                    className="nv-status-opt"
                    style={sel ? { borderColor: STATUS_COR[s], color: STATUS_COR[s], background: `${STATUS_COR[s]}12` } : undefined}
                    onClick={() => atualizar('status', s)}
                  >
                    {statusIcon(s, sel ? STATUS_COR[s] : '#8f978f')} {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                )
              })}
            </div>
          </div>}

          <div className="nv-secao" style={{ borderBottom: 'none' }}>
            <div className="nv-secao-head">
              <div className="nv-passo">{editando ? 4 : 3}</div>
              <div>
                <div className="nv-secao-titulo">Detalhes <span style={{ fontWeight: 400, color: '#8f978f', fontSize: '.74rem' }}>(opcional)</span></div>
                <div className="nv-secao-desc">{editando ? 'Anotações, recomendações e deslocamento' : 'Anotações e recomendações'}</div>
              </div>
            </div>
            <div className="ui-field">
              <label className="ui-label">Descrição da visita</label>
              <textarea className="ui-textarea" value={form.descricao} onChange={e => atualizar('descricao', e.target.value)} placeholder="O que foi ou será feito na visita..."/>
            </div>
            <div className="ui-field">
              <label className="ui-label">Recomendações</label>
              <textarea className="ui-textarea" style={{ minHeight: 80 }} value={form.recomendacoes} onChange={e => atualizar('recomendacoes', e.target.value)} placeholder="Recomendações para o produtor..."/>
            </div>
            <div className={editando ? 'ui-grid-2' : ''}>
              <div className="ui-field">
                <label className="ui-label">Próximo contato</label>
                <input className="ui-input" type="date" value={form.proximo_contato} onChange={e => atualizar('proximo_contato', e.target.value)}/>
              </div>
              {editando && (
                <div className="ui-field">
                  <label className="ui-label">KM rodado</label>
                  <input className="ui-input" type="number" min="0" step="0.1" placeholder="Ex: 142,5" value={form.km_rodado} onChange={e => atualizar('km_rodado', e.target.value)}/>
                </div>
              )}
            </div>
            {erro && <div className="ui-alert ui-alert-erro" style={{ marginBottom: 0 }}><IconAlert /> {erro}</div>}
          </div>

          <div className="nv-actions">
            <Link href={voltarHref} className="ui-btn ui-btn-ghost">Cancelar</Link>
            <button type="submit" className="ui-btn ui-btn-primary" disabled={salvando}>
              {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Salvar visita'}
            </button>
          </div>
        </form>

        <aside className="ui-card nv-resumo" aria-label="Resumo">
          <div className="nv-resumo-titulo">Resumo</div>
          <div className="nv-resumo-item">
            <div className="nv-resumo-icon"><IconUser /></div>
            <div>
              <div className="nv-resumo-label">Consultor</div>
              <div className={`nv-resumo-valor ${colabSel ? '' : 'vazio'}`}>{colabSel?.nome_completo ?? 'Não selecionado'}</div>
            </div>
          </div>
          <div className="nv-resumo-item">
            <div className="nv-resumo-icon"><IconSprout /></div>
            <div>
              <div className="nv-resumo-label">Cliente</div>
              <div className={`nv-resumo-valor ${clienteSel ? '' : 'vazio'}`}>
                {clienteSel ? <>{clienteSel.nome}{clienteSel.nome_fazenda && <div style={{ color: '#E67E22', fontSize: '.72rem', marginTop: '.1rem' }}>{clienteSel.nome_fazenda}</div>}</> : 'Não selecionado'}
              </div>
            </div>
          </div>
          <div className="nv-resumo-item">
            <div className="nv-resumo-icon"><IconCalendar /></div>
            <div>
              <div className="nv-resumo-label">Data</div>
              <div className={`nv-resumo-valor ${form.data_visita ? '' : 'vazio'}`}>
                {form.data_visita
                  ? new Date(form.data_visita + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
                  : 'Não definida'}
                {form.hora_visita && ` · ${form.hora_visita}`}
              </div>
            </div>
          </div>
          <div className="nv-resumo-item">
            <div className="nv-resumo-icon">{statusIcon(form.status, STATUS_COR[form.status])}</div>
            <div>
              <div className="nv-resumo-label">Status</div>
              <div className="nv-resumo-valor"><span className={`ui-badge ui-badge-${form.status}`}>{form.status.charAt(0).toUpperCase() + form.status.slice(1)}</span></div>
            </div>
          </div>
        </aside>
      </div>
    </>
  )
}

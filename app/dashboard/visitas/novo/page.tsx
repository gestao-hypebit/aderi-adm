'use client'

import { hojeISO } from '@/lib/dateUtils'
import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

type Cliente = { id: string; nome: string; nome_fazenda: string }

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

function IconArrowLeft() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
}
function IconCalendar({ color = 'currentColor' }: { color?: string }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function IconCheck({ color = 'currentColor', size = 14 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
}
function IconX({ color = 'currentColor', size = 14 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
}
function IconAlert({ color = 'currentColor' }: { color?: string }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
}

function statusIcon(status: string, color: string) {
  if (status === 'agendada') return <IconCalendar color={color} />
  if (status === 'realizada') return <IconCheck color={color} />
  return <IconX color={color} />
}

function NovaVisitaForm() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [form, setForm] = useState({
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
  const [carregando, setCarregando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase.from('clientes').select('id, nome, nome_fazenda').order('nome')
      setClientes(data || [])
      const clienteParam = searchParams.get('cliente')
      if (clienteParam) setForm(f => ({ ...f, cliente_id: clienteParam }))
      const dataParam = searchParams.get('data')
      if (dataParam) setForm(f => ({ ...f, data_visita: dataParam }))
    }
    carregar()
  }, [])

  function atualizar(campo: string, valor: string) {
    setForm(f => ({ ...f, [campo]: valor }))
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.cliente_id) { setErro('Selecione um cliente.'); return }
    setCarregando(true)
    setErro('')

    const { data: { user } } = await supabase.auth.getUser()

    const motivoFinal = form.motivo_visita === 'Outros' ? 'Outros' : form.motivo_visita
    const motivoOutroFinal = form.motivo_visita === 'Outros' ? form.motivo_outro : null

    const { error } = await supabase.from('visitas').insert({
      cliente_id: form.cliente_id,
      data_visita: form.data_visita,
      hora_visita: form.hora_visita || null,
      status: form.status,
      descricao: form.descricao,
      recomendacoes: form.recomendacoes,
      proximo_contato: form.proximo_contato || null,
      funcionario_id: user?.id,
      km_rodado: form.km_rodado ? parseFloat(form.km_rodado) : null,
      motivo_visita: motivoFinal || null,
      motivo_outro: motivoOutroFinal,
    })

    if (error) {
      setErro('Erro ao salvar. Tente novamente.')
      setCarregando(false)
      return
    }

    setSalvo(true)
    setCarregando(false)
    setTimeout(() => {
      router.push('/dashboard/visitas')
    }, 1500)
  }

  return (
    <>
      <style>{`
        .voltar{display:inline-flex;align-items:center;gap:.4rem;color:#E67E22;font-size:.82rem;font-weight:600;text-decoration:none;margin-bottom:1.2rem}
        .page-title{font-size:1.3rem;font-weight:600;color:#162a1e;margin-bottom:1.5rem}
        .form-card{background:#fff;border-radius:12px;padding:1.8rem;box-shadow:0 2px 8px rgba(0,0,0,.05);max-width:720px;margin:0 auto}
        .form-section{font-size:.7rem;font-weight:600;color:#E67E22;letter-spacing:.08em;text-transform:uppercase;margin:1.2rem 0 .8rem;padding-bottom:.4rem;border-bottom:1px solid #f0ede8}
        .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
        .form-full{grid-column:1/-1}
        .campo label{display:block;font-size:.72rem;font-weight:600;color:#555;letter-spacing:.04em;margin-bottom:.35rem}
        .campo input,.campo select,.campo textarea{width:100%;padding:.7rem 1rem;border:1.5px solid #eae5de;border-radius:8px;font-family:'Poppins',sans-serif;font-size:.85rem;color:#162a1e;outline:none;transition:border-color .2s;background:#fafaf8;box-sizing:border-box}
        .campo input:focus,.campo select:focus,.campo textarea:focus{border-color:#E67E22;background:#fff}
        .campo textarea{resize:vertical;min-height:100px}
        .status-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem}
        .status-opt{display:flex;align-items:center;justify-content:center;gap:.4rem;border:1.5px solid #eae5de;border-radius:8px;padding:.6rem;text-align:center;cursor:pointer;font-size:.78rem;font-weight:600;color:#888;transition:all .2s;background:#fafaf8}
        .status-opt.sel-agendada{border-color:#E67E22;background:#fff8f3;color:#E67E22}
        .status-opt.sel-realizada{border-color:#27ae60;background:#f0fdf4;color:#27ae60}
        .status-opt.sel-cancelada{border-color:#e74c3c;background:#fef2f2;color:#e74c3c}
        .motivo-select{width:100%;padding:.7rem 1rem;border:1.5px solid #eae5de;border-radius:8px;font-family:'Poppins',sans-serif;font-size:.85rem;color:#162a1e;outline:none;transition:border-color .2s;background:#fafaf8;cursor:pointer;box-sizing:border-box}
        .motivo-select:focus{border-color:#E67E22;background:#fff}
        .motivo-outro-box{margin-top:.6rem;animation:fadeIn .2s ease}
        @keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
        .err{display:flex;align-items:center;gap:.5rem;background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:.6rem 1rem;border-radius:8px;font-size:.8rem;margin-bottom:1rem}
        .sucesso{display:flex;align-items:center;gap:.5rem;background:#f0fdf4;border:1px solid #86efac;color:#166534;padding:.8rem 1rem;border-radius:8px;font-size:.85rem;font-weight:600;margin-bottom:1rem;animation:fadeIn .3s ease}
        .form-actions{display:flex;gap:.8rem;margin-top:1.5rem}
        .btn-salvar{background:#E67E22;color:#fff;border:none;padding:.8rem 1.8rem;border-radius:8px;font-family:'Poppins',sans-serif;font-size:.88rem;font-weight:600;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:.5rem}
        .btn-salvar:hover{background:#d35400}
        .btn-salvar:disabled{opacity:.6;cursor:not-allowed}
        .btn-salvar.salvo{background:#27ae60}
        .btn-cancelar{background:transparent;color:#888;border:1.5px solid #eae5de;padding:.8rem 1.8rem;border-radius:8px;font-family:'Poppins',sans-serif;font-size:.88rem;font-weight:600;cursor:pointer}
        @media(max-width:600px){.form-grid{grid-template-columns:1fr}}
      `}</style>

      <Link href="/dashboard/visitas" className="voltar"><IconArrowLeft /> Voltar</Link>
      <h1 className="page-title">Nova Visita</h1>

      <div className="form-card">
        <form onSubmit={salvar}>

          {/* CLIENTE */}
          <div className="form-section">Cliente</div>
          <div className="campo">
            <label>SELECIONAR CLIENTE *</label>
            <select value={form.cliente_id} onChange={e => atualizar('cliente_id', e.target.value)} required>
              <option value="">Selecione o cliente...</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nome}{c.nome_fazenda ? ` — ${c.nome_fazenda}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* DATA E KM */}
          <div className="form-section">Data e Deslocamento</div>
          <div className="form-grid">
            <div className="campo">
              <label>DATA DA VISITA *</label>
              <input type="date" value={form.data_visita} onChange={e => atualizar('data_visita', e.target.value)} required/>
            </div>
            <div className="campo">
              <label>KM RODADO</label>
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="Ex: 142.5"
                value={form.km_rodado}
                onChange={e => atualizar('km_rodado', e.target.value)}
              />
            </div>
          </div>

          {/* MOTIVO */}
          <div className="form-section">Motivo da Visita</div>
          <div className="campo">
            <label>MOTIVO DA VISITA</label>
            <select
              className="motivo-select"
              value={form.motivo_visita}
              onChange={e => atualizar('motivo_visita', e.target.value)}
            >
              <option value="">Selecione o motivo...</option>
              {MOTIVOS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {form.motivo_visita === 'Outros' && (
              <div className="motivo-outro-box">
                <input
                  type="text"
                  placeholder="Descreva o motivo..."
                  value={form.motivo_outro}
                  onChange={e => atualizar('motivo_outro', e.target.value)}
                />
              </div>
            )}
          </div>

          {/* STATUS */}
          <div className="form-section">Status</div>
          <div className="status-grid">
            {['agendada','realizada','cancelada'].map(s => {
              const cores: Record<string,string> = { agendada:'#E67E22', realizada:'#27ae60', cancelada:'#e74c3c' }
              return (
                <div
                  key={s}
                  className={`status-opt ${form.status === s ? `sel-${s}` : ''}`}
                  onClick={() => atualizar('status', s)}
                >
                  {statusIcon(s, form.status === s ? cores[s] : '#888')} {s.charAt(0).toUpperCase() + s.slice(1)}
                </div>
              )
            })}
          </div>

          {/* DETALHES */}
          <div className="form-section">Detalhes</div>
          <div className="campo">
            <label>DESCRIÇÃO DA VISITA</label>
            <textarea value={form.descricao} onChange={e => atualizar('descricao', e.target.value)} placeholder="O que foi feito na visita..."/>
          </div>
          <div className="campo">
            <label>RECOMENDAÇÕES</label>
            <textarea value={form.recomendacoes} onChange={e => atualizar('recomendacoes', e.target.value)} placeholder="Recomendações para o produtor..." style={{minHeight:'80px'}}/>
          </div>
          <div className="campo">
            <label>PRÓXIMO CONTATO</label>
            <input type="date" value={form.proximo_contato} onChange={e => atualizar('proximo_contato', e.target.value)}/>
          </div>

          {erro && <div className="err"><IconAlert /> {erro}</div>}
          {salvo && <div className="sucesso"><IconCheck color="#166534" /> Visita salva com sucesso! Redirecionando...</div>}

          <div className="form-actions">
            <button
              type="submit"
              className={`btn-salvar${salvo ? ' salvo' : ''}`}
              disabled={carregando || salvo}
            >
              {carregando ? 'Salvando...' : salvo ? (<><IconCheck /> Salvo!</>) : 'Salvar Visita'}
            </button>
            <button type="button" className="btn-cancelar" onClick={() => router.back()} disabled={carregando || salvo}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

export default function NovaVisitaPage() {
  return (
    <Suspense fallback={<div style={{textAlign:'center',padding:'3rem',color:'#aaa'}}>Carregando...</div>}>
      <NovaVisitaForm />
    </Suspense>
  )
}
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const UFS = ['MG','SP','GO','MT','MS','BA','PR','RS','SC','TO','PA','MA','PI','CE','RN','PB','PE','AL','SE','RJ','ES','RO','AC','AM','RR','AP','DF']
const CULTURAS = ['Café','Soja','Milho','Cana-de-açúcar','Algodão','Feijão','Arroz','Trigo','Pastagem','Horticultura','Fruticultura','Outro']

const VAZIO = {
  nome: '', cpf_cnpj: '', telefone: '', email: '',
  cidade: '', estado: 'MG', nome_fazenda: '',
  hectares: '', cultura_principal: '', observacoes: '',
}

function IconArrowLeft() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
}
function IconAlert() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
}

type Props = { clienteId?: string }

export default function ClienteForm({ clienteId }: Props) {
  const editando = !!clienteId
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState(VAZIO)
  const [nomeOriginal, setNomeOriginal] = useState('')
  const [carregandoDados, setCarregandoDados] = useState(editando)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!clienteId) return
    async function carregar() {
      const { data } = await supabase.from('clientes').select('*').eq('id', clienteId).single()
      if (data) {
        setNomeOriginal(data.nome || '')
        setForm({
          nome: data.nome || '',
          cpf_cnpj: data.cpf_cnpj || '',
          telefone: data.telefone || '',
          email: data.email || '',
          cidade: data.cidade || '',
          estado: data.estado || 'MG',
          nome_fazenda: data.nome_fazenda || '',
          hectares: data.hectares != null ? String(data.hectares) : '',
          cultura_principal: data.cultura_principal || '',
          observacoes: data.observacoes || '',
        })
      }
      setCarregandoDados(false)
    }
    carregar()
  }, [clienteId])

  function atualizar(campo: keyof typeof VAZIO, valor: string) {
    setForm(f => ({ ...f, [campo]: valor }))
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro('')
    const payload = { ...form, hectares: form.hectares ? parseFloat(form.hectares) : null }

    if (editando) {
      const { error } = await supabase.from('clientes').update(payload).eq('id', clienteId)
      if (error) { setErro('Erro ao salvar. Tente novamente.'); setSalvando(false); return }
      router.push(`/admin/clientes/${clienteId}`)
    } else {
      const { data, error } = await supabase.from('clientes').insert(payload).select('id').single()
      if (error || !data) { setErro('Erro ao salvar. Tente novamente.'); setSalvando(false); return }
      router.push(`/admin/clientes/${data.id}`)
    }
  }

  const voltarHref = editando ? `/admin/clientes/${clienteId}` : '/admin/clientes'

  if (carregandoDados) {
    return (
      <div style={{ maxWidth: 820 }}>
        <div className="ui-skeleton" style={{ height: 14, width: 160, marginBottom: '1rem' }} />
        <div className="ui-skeleton" style={{ height: 420, borderRadius: 16 }} />
      </div>
    )
  }

  return (
    <>
      <style>{`
        .cf-wrap{max-width:820px}
        .cf-secao{padding:1.35rem 1.5rem;border-bottom:1px solid #f2efea}
        .cf-secao-head{display:flex;align-items:center;gap:.7rem;margin-bottom:1.05rem}
        .cf-passo{width:26px;height:26px;border-radius:50%;background:#fdf3e9;color:#E67E22;font-size:.72rem;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .cf-secao-titulo{font-size:.9rem;font-weight:600;color:#162a1e}
        .cf-secao-desc{font-size:.7rem;color:#8f978f;margin-top:.1rem}
        .cf-grid-cidade{display:grid;grid-template-columns:1fr 110px;gap:0 1rem}
        .cf-actions{display:flex;gap:.6rem;justify-content:flex-end;padding:1rem 1.5rem;background:#faf8f5;border-radius:0 0 16px 16px}
        @media(max-width:600px){.cf-secao{padding:1.15rem 1.1rem}.cf-actions{padding:1rem 1.1rem}}
      `}</style>

      <div className="cf-wrap">
        <div className="ui-breadcrumb">
          <Link href="/admin/clientes"><IconArrowLeft /> Clientes</Link>
          {editando && (
            <>
              <span className="ui-breadcrumb-sep">/</span>
              <Link href={`/admin/clientes/${clienteId}`}>{nomeOriginal || 'Cliente'}</Link>
            </>
          )}
          <span className="ui-breadcrumb-sep">/</span>
          <span className="ui-breadcrumb-atual">{editando ? 'Editar' : 'Novo cliente'}</span>
        </div>
        <div className="ui-page-header">
          <div>
            <div className="ui-title">{editando ? 'Editar cliente' : 'Cadastrar cliente'}</div>
            <div className="ui-sub">
              {editando ? 'Atualize os dados do produtor.' : 'Só o nome é obrigatório. O restante pode ser completado depois.'}
            </div>
          </div>
        </div>

        <form onSubmit={salvar} className="ui-card">
          <div className="cf-secao">
            <div className="cf-secao-head">
              <div className="cf-passo">1</div>
              <div>
                <div className="cf-secao-titulo">Dados do produtor</div>
                <div className="cf-secao-desc">Identificação e contato</div>
              </div>
            </div>
            <div className="ui-field">
              <label className="ui-label">Nome completo <span className="ui-req">*</span></label>
              <input className="ui-input" value={form.nome} onChange={e => atualizar('nome', e.target.value)} placeholder="Nome do produtor" required autoFocus={!editando}/>
            </div>
            <div className="ui-grid-2">
              <div className="ui-field">
                <label className="ui-label">CPF / CNPJ</label>
                <input className="ui-input" value={form.cpf_cnpj} onChange={e => atualizar('cpf_cnpj', e.target.value)} placeholder="000.000.000-00"/>
              </div>
              <div className="ui-field">
                <label className="ui-label">Telefone</label>
                <input className="ui-input" type="tel" value={form.telefone} onChange={e => atualizar('telefone', e.target.value)} placeholder="(37) 99999-9999"/>
              </div>
            </div>
            <div className="ui-field" style={{ marginBottom: 0 }}>
              <label className="ui-label">E-mail</label>
              <input className="ui-input" type="email" value={form.email} onChange={e => atualizar('email', e.target.value)} placeholder="email@exemplo.com"/>
            </div>
          </div>

          <div className="cf-secao">
            <div className="cf-secao-head">
              <div className="cf-passo">2</div>
              <div>
                <div className="cf-secao-titulo">Propriedade</div>
                <div className="cf-secao-desc">Onde fica e o que produz</div>
              </div>
            </div>
            <div className="ui-grid-2">
              <div className="ui-field">
                <label className="ui-label">Nome da fazenda</label>
                <input className="ui-input" value={form.nome_fazenda} onChange={e => atualizar('nome_fazenda', e.target.value)} placeholder="Fazenda São João"/>
              </div>
              <div className="cf-grid-cidade">
                <div className="ui-field">
                  <label className="ui-label">Cidade</label>
                  <input className="ui-input" value={form.cidade} onChange={e => atualizar('cidade', e.target.value)} placeholder="Piumhi"/>
                </div>
                <div className="ui-field">
                  <label className="ui-label">UF</label>
                  <select className="ui-select" value={form.estado} onChange={e => atualizar('estado', e.target.value)}>
                    {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="ui-grid-2">
              <div className="ui-field" style={{ marginBottom: 0 }}>
                <label className="ui-label">Cultura principal</label>
                <select className="ui-select" value={form.cultura_principal} onChange={e => atualizar('cultura_principal', e.target.value)}>
                  <option value="">Selecione...</option>
                  {CULTURAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="ui-field" style={{ marginBottom: 0 }}>
                <label className="ui-label">Área (hectares)</label>
                <input className="ui-input" type="number" min="0" step="0.1" value={form.hectares} onChange={e => atualizar('hectares', e.target.value)} placeholder="0"/>
              </div>
            </div>
          </div>

          <div className="cf-secao" style={{ borderBottom: 'none' }}>
            <div className="cf-secao-head">
              <div className="cf-passo">3</div>
              <div>
                <div className="cf-secao-titulo">Observações <span style={{ fontWeight: 400, color: '#8f978f', fontSize: '.74rem' }}>(opcional)</span></div>
                <div className="cf-secao-desc">Qualquer informação útil para a equipe</div>
              </div>
            </div>
            <textarea className="ui-textarea" value={form.observacoes} onChange={e => atualizar('observacoes', e.target.value)} placeholder="Informações adicionais sobre o cliente..."/>
            {erro && <div className="ui-alert ui-alert-erro" style={{ marginTop: '1rem', marginBottom: 0 }}><IconAlert /> {erro}</div>}
          </div>

          <div className="cf-actions">
            <Link href={voltarHref} className="ui-btn ui-btn-ghost">Cancelar</Link>
            <button type="submit" className="ui-btn ui-btn-primary" disabled={salvando}>
              {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Cadastrar cliente'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

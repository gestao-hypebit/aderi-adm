'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { obterPosicao, linkPontoGoogle } from '@/lib/geo'

const Mapa = dynamic(() => import('@/app/components/Mapa'), { ssr: false, loading: () => <div className="ui-skeleton" style={{ height: 260, borderRadius: 12 }} /> })

const UFS = ['MG','SP','GO','MT','MS','BA','PR','RS','SC','TO','PA','MA','PI','CE','RN','PB','PE','AL','SE','RJ','ES','RO','AC','AM','RR','AP','DF']
export const CULTURAS = ['Café','Soja','Milho','Cana-de-açúcar','Algodão','Feijão','Arroz','Trigo','Pastagem','Horticultura','Fruticultura','Outro']

const VAZIO = {
  nome: '', cpf_cnpj: '', inscricao_produtor: '', telefone: '', email: '',
  cidade: '', estado: 'MG', nome_fazenda: '', hectares: '', cultura_principal: '', observacoes: '',
  latitude: '', longitude: '', responsavel_id: '',
}
type Form = typeof VAZIO
type Duplicado = { id: string; nome: string; nome_fazenda: string | null; responsavel: string | null }

function IconArrowLeft() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
}
function IconAlert() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
}
function IconGps() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/></svg>
}

type Props = { clienteId?: string; base: string; admin: boolean }

export default function ClienteForm({ clienteId, base, admin }: Props) {
  const editando = !!clienteId
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState<Form>(VAZIO)
  const [nomeOriginal, setNomeOriginal] = useState('')
  const [carregandoDados, setCarregandoDados] = useState(editando)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [consultores, setConsultores] = useState<{ id: string; nome_completo: string | null }[]>([])
  const [duplicados, setDuplicados] = useState<Duplicado[]>([])
  const [localizando, setLocalizando] = useState(false)
  const [mostrarMapa, setMostrarMapa] = useState(false)

  useEffect(() => {
    if (admin) {
      supabase.from('profiles').select('id, nome_completo').eq('role', 'colaborador').eq('ativo', true).order('nome_completo').then(({ data }) => setConsultores(data ?? []))
    }
    if (!clienteId) return
    supabase.from('clientes').select('*').eq('id', clienteId).single().then(({ data }) => {
      if (data) {
        setNomeOriginal(data.nome || '')
        setForm({
          nome: data.nome || '', cpf_cnpj: data.cpf_cnpj || '', inscricao_produtor: data.inscricao_produtor || '',
          telefone: data.telefone || '', email: data.email || '', cidade: data.cidade || '', estado: data.estado || 'MG',
          nome_fazenda: data.nome_fazenda || '', hectares: data.hectares != null ? String(data.hectares) : '',
          cultura_principal: data.cultura_principal || '', observacoes: data.observacoes || '',
          latitude: data.latitude != null ? String(data.latitude) : '', longitude: data.longitude != null ? String(data.longitude) : '',
          responsavel_id: data.responsavel_id || '',
        })
        setMostrarMapa(data.latitude != null)
      }
      setCarregandoDados(false)
    })
  }, [clienteId, admin])

  function atualizar(campo: keyof Form, valor: string) {
    setForm(f => ({ ...f, [campo]: valor }))
  }

  async function verificarDocumento() {
    const digitos = form.cpf_cnpj.replace(/\D/g, '')
    if (digitos.length < 11) { setDuplicados([]); return }
    const { data } = await supabase.rpc('cliente_por_documento', { doc: form.cpf_cnpj, ignorar: clienteId ?? null })
    setDuplicados((data ?? []) as Duplicado[])
  }

  async function usarMinhaLocalizacao() {
    setLocalizando(true)
    setErro('')
    try {
      const p = await obterPosicao()
      setForm(f => ({ ...f, latitude: p.lat.toFixed(6), longitude: p.lng.toFixed(6) }))
      setMostrarMapa(true)
    } catch (e) {
      setErro((e as Error).message)
    }
    setLocalizando(false)
  }

  const lat = parseFloat(form.latitude.replace(',', '.'))
  const lng = parseFloat(form.longitude.replace(',', '.'))
  const temPonto = !isNaN(lat) && !isNaN(lng)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro('')
    const payload: Record<string, unknown> = {
      nome: form.nome.trim(), cpf_cnpj: form.cpf_cnpj || null, inscricao_produtor: form.inscricao_produtor || null,
      telefone: form.telefone || null, email: form.email || null, cidade: form.cidade || null, estado: form.estado,
      nome_fazenda: form.nome_fazenda || null, hectares: form.hectares ? parseFloat(form.hectares) : null,
      cultura_principal: form.cultura_principal || null, observacoes: form.observacoes || null,
      latitude: temPonto ? lat : null, longitude: temPonto ? lng : null,
    }
    if (admin) payload.responsavel_id = form.responsavel_id || null

    if (editando) {
      const { error } = await supabase.from('clientes').update(payload).eq('id', clienteId)
      if (error) { setErro('Erro ao salvar. Tente novamente.'); setSalvando(false); return }
      router.push(`${base}/${clienteId}`)
    } else {
      const { data, error } = await supabase.from('clientes').insert(payload).select('id').single()
      if (error || !data) { setErro('Erro ao salvar. Tente novamente.'); setSalvando(false); return }
      router.push(`${base}/${data.id}`)
    }
  }

  const voltarHref = editando ? `${base}/${clienteId}` : base

  if (carregandoDados) {
    return <div style={{ maxWidth: 860 }}><div className="ui-skeleton" style={{ height: 14, width: 160, marginBottom: '1rem' }} /><div className="ui-skeleton" style={{ height: 420, borderRadius: 16 }} /></div>
  }

  return (
    <>
      <style>{`
        .cf-wrap{max-width:860px}
        .cf-secao{padding:1.35rem 1.5rem;border-bottom:1px solid #f2efea}
        .cf-secao-head{display:flex;align-items:center;gap:.7rem;margin-bottom:1.05rem}
        .cf-passo{width:26px;height:26px;border-radius:50%;background:#fdf3e9;color:#E67E22;font-size:.72rem;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .cf-secao-titulo{font-size:.9rem;font-weight:600;color:#162a1e}
        .cf-secao-desc{font-size:.7rem;color:#8f978f;margin-top:.1rem}
        .cf-grid-cidade{display:grid;grid-template-columns:1fr 110px;gap:0 1rem}
        .cf-grid-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0 1rem}
        .cf-dup{background:#fdf3e9;border:1px solid #f5d9bd;border-radius:10px;padding:.7rem .85rem;font-size:.76rem;color:#8a4a0e;margin:-.3rem 0 1rem}
        .cf-dup a{color:#c0651a;font-weight:600}
        .cf-loc{display:flex;gap:.6rem;flex-wrap:wrap;align-items:flex-end;margin-bottom:.8rem}
        .cf-loc .ui-field{margin-bottom:0;flex:1;min-width:140px}
        .cf-actions{display:flex;gap:.6rem;justify-content:flex-end;padding:1rem 1.5rem;background:#faf8f5;border-radius:0 0 16px 16px}
        @media(max-width:700px){.cf-grid-3{grid-template-columns:1fr}}
        @media(max-width:600px){.cf-secao{padding:1.15rem 1.1rem}.cf-actions{padding:1rem 1.1rem}}
      `}</style>

      <div className="cf-wrap">
        <div className="ui-breadcrumb">
          <Link href={base}><IconArrowLeft /> Clientes</Link>
          {editando && <><span className="ui-breadcrumb-sep">/</span><Link href={`${base}/${clienteId}`}>{nomeOriginal || 'Cliente'}</Link></>}
          <span className="ui-breadcrumb-sep">/</span>
          <span className="ui-breadcrumb-atual">{editando ? 'Editar' : 'Novo cliente'}</span>
        </div>
        <div className="ui-page-header">
          <div>
            <div className="ui-title">{editando ? 'Editar cliente' : 'Cadastrar cliente'}</div>
            <div className="ui-sub">{editando ? 'Atualize os dados do produtor.' : 'Só o nome é obrigatório. O restante pode ser completado depois.'}</div>
          </div>
        </div>

        <form onSubmit={salvar} className="ui-card">
          <div className="cf-secao">
            <div className="cf-secao-head">
              <div className="cf-passo">1</div>
              <div><div className="cf-secao-titulo">Dados do produtor</div><div className="cf-secao-desc">Identificação e contato principal</div></div>
            </div>
            <div className="ui-field">
              <label className="ui-label">Nome completo <span className="ui-req">*</span></label>
              <input className="ui-input" value={form.nome} onChange={e => atualizar('nome', e.target.value)} placeholder="Nome do produtor" required autoFocus={!editando} />
            </div>
            <div className="cf-grid-3">
              <div className="ui-field">
                <label className="ui-label">CPF / CNPJ</label>
                <input className="ui-input" value={form.cpf_cnpj} onChange={e => atualizar('cpf_cnpj', e.target.value)} onBlur={verificarDocumento} placeholder="000.000.000-00" />
              </div>
              <div className="ui-field">
                <label className="ui-label">Inscrição do produtor</label>
                <input className="ui-input" value={form.inscricao_produtor} onChange={e => atualizar('inscricao_produtor', e.target.value)} placeholder="Inscrição estadual" />
              </div>
              <div className="ui-field">
                <label className="ui-label">Telefone</label>
                <input className="ui-input" type="tel" value={form.telefone} onChange={e => atualizar('telefone', e.target.value)} placeholder="(37) 99999-9999" />
              </div>
            </div>
            {duplicados.length > 0 && (
              <div className="cf-dup" role="alert">
                <b>Atenção:</b> este CPF/CNPJ já está cadastrado
                {duplicados.map(d => (
                  <div key={d.id} style={{ marginTop: '.25rem' }}>
                    · <Link href={`${base}/${d.id}`} target="_blank">{d.nome}</Link>{d.nome_fazenda ? ` (${d.nome_fazenda})` : ''}{d.responsavel ? ` — responsável: ${d.responsavel}` : ''}
                  </div>
                ))}
                <div style={{ marginTop: '.35rem' }}>Confira para não criar um cadastro duplicado.</div>
              </div>
            )}
            <div className={admin ? 'ui-grid-2' : ''}>
              <div className="ui-field" style={{ marginBottom: 0 }}>
                <label className="ui-label">E-mail</label>
                <input className="ui-input" type="email" value={form.email} onChange={e => atualizar('email', e.target.value)} placeholder="email@exemplo.com" />
              </div>
              {admin && (
                <div className="ui-field" style={{ marginBottom: 0 }}>
                  <label className="ui-label">Consultor responsável</label>
                  <select className="ui-select" value={form.responsavel_id} onChange={e => atualizar('responsavel_id', e.target.value)}>
                    <option value="">Sem responsável</option>
                    {consultores.map(c => <option key={c.id} value={c.id}>{c.nome_completo}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="cf-secao">
            <div className="cf-secao-head">
              <div className="cf-passo">2</div>
              <div><div className="cf-secao-titulo">Propriedade</div><div className="cf-secao-desc">Onde fica e o que produz</div></div>
            </div>
            <div className="ui-grid-2">
              <div className="ui-field">
                <label className="ui-label">Nome da fazenda</label>
                <input className="ui-input" value={form.nome_fazenda} onChange={e => atualizar('nome_fazenda', e.target.value)} placeholder="Fazenda São João" />
              </div>
              <div className="cf-grid-cidade">
                <div className="ui-field">
                  <label className="ui-label">Cidade</label>
                  <input className="ui-input" value={form.cidade} onChange={e => atualizar('cidade', e.target.value)} placeholder="Piumhi" />
                </div>
                <div className="ui-field">
                  <label className="ui-label">UF</label>
                  <select className="ui-select" value={form.estado} onChange={e => atualizar('estado', e.target.value)}>{UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}</select>
                </div>
              </div>
            </div>
            <div className="ui-grid-2">
              <div className="ui-field">
                <label className="ui-label">Cultura principal</label>
                <select className="ui-select" value={form.cultura_principal} onChange={e => atualizar('cultura_principal', e.target.value)}>
                  <option value="">Selecione...</option>
                  {CULTURAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="ui-field">
                <label className="ui-label">Área (hectares)</label>
                <input className="ui-input" type="number" min="0" step="0.1" value={form.hectares} onChange={e => atualizar('hectares', e.target.value)} placeholder="0" />
              </div>
            </div>

            <label className="ui-label">Localização da sede</label>
            <div className="cf-loc">
              <div className="ui-field"><input className="ui-input" value={form.latitude} onChange={e => atualizar('latitude', e.target.value)} placeholder="Latitude (ex.: -20.4652)" aria-label="Latitude" /></div>
              <div className="ui-field"><input className="ui-input" value={form.longitude} onChange={e => atualizar('longitude', e.target.value)} placeholder="Longitude (ex.: -45.9583)" aria-label="Longitude" /></div>
              <button type="button" className="ui-btn ui-btn-secondary" onClick={usarMinhaLocalizacao} disabled={localizando}><IconGps /> {localizando ? 'Localizando...' : 'Usar minha localização'}</button>
              <button type="button" className="ui-btn ui-btn-ghost" onClick={() => setMostrarMapa(m => !m)}>{mostrarMapa ? 'Ocultar mapa' : 'Marcar no mapa'}</button>
            </div>
            {mostrarMapa && (
              <>
                <Mapa
                  altura={260}
                  marcadores={temPonto ? [{ id: 'sede', lat, lng, titulo: form.nome_fazenda || form.nome || 'Sede', cor: '#E67E22' }] : []}
                  onClicar={p => setForm(f => ({ ...f, latitude: p.lat.toFixed(6), longitude: p.lng.toFixed(6) }))}
                />
                <div className="ui-hint">Clique no mapa para marcar a sede da fazenda.{temPonto && <> · <a href={linkPontoGoogle({ lat, lng })} target="_blank" rel="noreferrer" style={{ color: '#E67E22', fontWeight: 600 }}>Ver no Google Maps</a></>}</div>
              </>
            )}
            {!mostrarMapa && <div className="ui-hint">Com a localização, o cliente aparece no mapa da rota do dia. Também dá para salvar durante o check-in da visita.</div>}
          </div>

          <div className="cf-secao" style={{ borderBottom: 'none' }}>
            <div className="cf-secao-head">
              <div className="cf-passo">3</div>
              <div><div className="cf-secao-titulo">Observações <span style={{ fontWeight: 400, color: '#8f978f', fontSize: '.74rem' }}>(opcional)</span></div><div className="cf-secao-desc">Qualquer informação útil para a equipe</div></div>
            </div>
            <textarea className="ui-textarea" value={form.observacoes} onChange={e => atualizar('observacoes', e.target.value)} placeholder="Informações adicionais sobre o cliente..." />
            <div className="ui-hint">Outros contatos (gerente, agrônomo...) são cadastrados na ficha do cliente.</div>
            {erro && <div className="ui-alert ui-alert-erro" style={{ marginTop: '1rem', marginBottom: 0 }}><IconAlert /> {erro}</div>}
          </div>

          <div className="cf-actions">
            <Link href={voltarHref} className="ui-btn ui-btn-ghost">Cancelar</Link>
            <button type="submit" className="ui-btn ui-btn-primary" disabled={salvando}>{salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Cadastrar cliente'}</button>
          </div>
        </form>
      </div>
    </>
  )
}

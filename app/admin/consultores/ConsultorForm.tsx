'use client'

import { useEffect, useState } from 'react'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { createClient as createIsolatedClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function IconArrowLeft() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
}
function IconAlert() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
}
function IconCheck() {
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
}
function IconCopy() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
}
function IconRefresh() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
}

function gerarSenha() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const arr = new Uint32Array(10)
  crypto.getRandomValues(arr)
  return Array.from(arr, n => chars[n % chars.length]).join('')
}

type Props = { consultorId?: string }

export default function ConsultorForm({ consultorId }: Props) {
  const editando = !!consultorId
  const router = useRouter()
  const supabase = createBrowserClient()

  const [form, setForm] = useState({ nome_completo: '', email: '', senha: '', cargo: '', telefone: '', role: 'colaborador', ativo: true })
  const [nomeOriginal, setNomeOriginal] = useState('')
  const [souEu, setSouEu] = useState(false)
  const [carregandoDados, setCarregandoDados] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [criado, setCriado] = useState<{ id: string; email: string; senha: string; precisaConfirmar: boolean } | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (consultorId) {
        const { data } = await supabase.from('profiles').select('nome_completo, cargo, telefone, role, ativo').eq('id', consultorId).single()
        if (data) {
          setNomeOriginal(data.nome_completo || '')
          setForm(f => ({
            ...f,
            nome_completo: data.nome_completo || '',
            cargo: data.cargo || '',
            telefone: data.telefone || '',
            role: data.role || 'colaborador',
            ativo: data.ativo !== false,
          }))
        }
        setSouEu(user?.id === consultorId)
      } else {
        setForm(f => ({ ...f, senha: gerarSenha() }))
      }
      setCarregandoDados(false)
    }
    carregar()
  }, [consultorId])

  function atualizar<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm(f => ({ ...f, [campo]: valor }))
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!form.nome_completo.trim()) { setErro('Informe o nome.'); return }
    setSalvando(true)

    const perfil = {
      nome_completo: form.nome_completo.trim(),
      cargo: form.cargo.trim() || null,
      telefone: form.telefone.trim() || null,
      role: form.role,
      ativo: form.ativo,
    }

    if (editando) {
      const { error } = await supabase.from('profiles').update(perfil).eq('id', consultorId)
      if (error) { setErro('Não foi possível salvar. Verifique se você tem permissão de administrador.'); setSalvando(false); return }
      router.push(`/admin/consultores/${consultorId}`)
      return
    }

    if (form.senha.length < 6) { setErro('A senha inicial precisa ter pelo menos 6 caracteres.'); setSalvando(false); return }

    // Cliente isolado: cria a conta do consultor sem trocar a sessão do admin logado.
    const isolado = createIsolatedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'aderi-cadastro-consultor' },
    })
    const { data, error } = await isolado.auth.signUp({
      email: form.email.trim(),
      password: form.senha,
      options: { data: { nome_completo: perfil.nome_completo } },
    })

    if (error || !data.user) {
      const msg = error?.message ?? ''
      setErro(
        /rate limit/i.test(msg) ? 'Muitos cadastros em pouco tempo. Aguarde alguns minutos e tente de novo.'
        : /registered|exists/i.test(msg) ? 'Já existe uma conta com este e-mail.'
        : /password/i.test(msg) ? 'Senha fraca. Use pelo menos 6 caracteres.'
        : 'Não foi possível criar a conta. Verifique o e-mail e tente novamente.'
      )
      setSalvando(false)
      return
    }
    // Supabase devolve um usuário "fantasma" sem identidades quando o e-mail já existe
    if (data.user.identities && data.user.identities.length === 0) {
      setErro('Já existe uma conta com este e-mail.')
      setSalvando(false)
      return
    }

    // O perfil é criado pela trigger handle_new_user; completa cargo, telefone e papel.
    await supabase.from('profiles').update(perfil).eq('id', data.user.id)

    setCriado({ id: data.user.id, email: form.email.trim(), senha: form.senha, precisaConfirmar: !data.session })
    setSalvando(false)
  }

  async function copiarAcesso() {
    if (!criado) return
    const texto = `Acesso ao sistema Aderi Agro\nE-mail: ${criado.email}\nSenha: ${criado.senha}\n${location.origin}/login`
    try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000) } catch {}
  }

  if (carregandoDados) {
    return (
      <div style={{ maxWidth: 760 }}>
        <div className="ui-skeleton" style={{ height: 14, width: 160, marginBottom: '1rem' }} />
        <div className="ui-skeleton" style={{ height: 380, borderRadius: 16 }} />
      </div>
    )
  }

  if (criado) {
    return (
      <div className="ui-card" style={{ maxWidth: 560, padding: '2rem' }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: '#eaf7ef', color: '#27ae60', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}><IconCheck /></div>
        <div className="ui-title" style={{ fontSize: '1.25rem' }}>Consultor cadastrado</div>
        <div className="ui-sub">
          {criado.precisaConfirmar
            ? <>Enviamos um e-mail de confirmação para <b>{criado.email}</b>. O consultor precisa clicar no link antes do primeiro acesso.</>
            : <>A conta já está ativa. Envie os dados de acesso abaixo para o consultor.</>}
        </div>
        <div style={{ background: '#faf8f5', border: '1px solid #f2efea', borderRadius: 12, padding: '1rem 1.1rem', margin: '1.3rem 0', fontSize: '.82rem', lineHeight: 1.9 }}>
          <div><span style={{ color: '#8f978f' }}>E-mail:</span> <b>{criado.email}</b></div>
          <div><span style={{ color: '#8f978f' }}>Senha inicial:</span> <b style={{ fontFamily: 'monospace', fontSize: '.92rem' }}>{criado.senha}</b></div>
        </div>
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
          <button className="ui-btn ui-btn-secondary" onClick={copiarAcesso}><IconCopy /> {copiado ? 'Copiado!' : 'Copiar dados de acesso'}</button>
          <Link href={`/admin/consultores/${criado.id}`} className="ui-btn ui-btn-primary">Abrir ficha do consultor</Link>
        </div>
        <div className="ui-hint" style={{ marginTop: '1rem' }}>Oriente o consultor a trocar a senha em “Esqueci minha senha” na tela de login.</div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        .csf-wrap{max-width:760px}
        .csf-secao{padding:1.35rem 1.5rem;border-bottom:1px solid #f2efea}
        .csf-secao-head{display:flex;align-items:center;gap:.7rem;margin-bottom:1.05rem}
        .csf-passo{width:26px;height:26px;border-radius:50%;background:#fdf3e9;color:#E67E22;font-size:.72rem;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .csf-secao-titulo{font-size:.9rem;font-weight:600;color:#162a1e}
        .csf-secao-desc{font-size:.7rem;color:#8f978f;margin-top:.1rem}
        .csf-senha{display:flex;gap:.5rem}
        .csf-senha .ui-input{font-family:monospace;font-size:.9rem;letter-spacing:.04em}
        .csf-papel{display:grid;grid-template-columns:1fr 1fr;gap:.6rem}
        .csf-papel-opt{text-align:left;border:1.5px solid #eae5de;border-radius:12px;padding:.85rem 1rem;background:#fff;cursor:pointer;font-family:'Poppins',sans-serif;transition:all .15s}
        .csf-papel-opt:hover{border-color:#cfc8bd}
        .csf-papel-opt.ativo{border-color:#E67E22;background:#fffaf5;box-shadow:0 0 0 3px rgba(230,126,34,.12)}
        .csf-papel-titulo{font-size:.82rem;font-weight:600;color:#162a1e}
        .csf-papel-desc{font-size:.68rem;color:#8f978f;margin-top:.25rem;line-height:1.5}
        .csf-switch{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.9rem 1rem;border:1.5px solid #eae5de;border-radius:12px}
        .csf-toggle{width:44px;height:24px;border-radius:999px;border:none;background:#d8d1c6;position:relative;cursor:pointer;flex-shrink:0;transition:background .2s}
        .csf-toggle::after{content:'';position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:transform .2s}
        .csf-toggle.on{background:#27ae60}
        .csf-toggle.on::after{transform:translateX(20px)}
        .csf-toggle:disabled{opacity:.5;cursor:not-allowed}
        .csf-actions{display:flex;gap:.6rem;justify-content:flex-end;padding:1rem 1.5rem;background:#faf8f5;border-radius:0 0 16px 16px}
        @media(max-width:600px){.csf-secao{padding:1.15rem 1.1rem}.csf-actions{padding:1rem 1.1rem}.csf-papel{grid-template-columns:1fr}.csf-actions .ui-btn{flex:1}}
      `}</style>

      <div className="csf-wrap">
        <div className="ui-breadcrumb">
          <Link href="/admin/consultores"><IconArrowLeft /> Consultores</Link>
          {editando && (
            <>
              <span className="ui-breadcrumb-sep">/</span>
              <Link href={`/admin/consultores/${consultorId}`}>{nomeOriginal || 'Consultor'}</Link>
            </>
          )}
          <span className="ui-breadcrumb-sep">/</span>
          <span className="ui-breadcrumb-atual">{editando ? 'Editar' : 'Novo consultor'}</span>
        </div>
        <div className="ui-page-header">
          <div>
            <div className="ui-title">{editando ? 'Editar consultor' : 'Cadastrar consultor'}</div>
            <div className="ui-sub">
              {editando ? 'Atualize os dados, o papel ou o acesso desta pessoa.' : 'Cria a conta de acesso. O consultor entra com o e-mail e a senha inicial.'}
            </div>
          </div>
        </div>

        <form onSubmit={salvar} className="ui-card">
          <div className="csf-secao">
            <div className="csf-secao-head">
              <div className="csf-passo">1</div>
              <div>
                <div className="csf-secao-titulo">Dados pessoais</div>
                <div className="csf-secao-desc">Como a pessoa aparece no sistema</div>
              </div>
            </div>
            <div className="ui-field">
              <label className="ui-label">Nome completo <span className="ui-req">*</span></label>
              <input className="ui-input" value={form.nome_completo} onChange={e => atualizar('nome_completo', e.target.value)} placeholder="Ex: Gabriel Henrique" required autoFocus={!editando}/>
            </div>
            <div className="ui-grid-2">
              <div className="ui-field" style={{ marginBottom: 0 }}>
                <label className="ui-label">Cargo</label>
                <input className="ui-input" value={form.cargo} onChange={e => atualizar('cargo', e.target.value)} placeholder="Consultor técnico de campo"/>
              </div>
              <div className="ui-field" style={{ marginBottom: 0 }}>
                <label className="ui-label">Telefone</label>
                <input className="ui-input" type="tel" value={form.telefone} onChange={e => atualizar('telefone', e.target.value)} placeholder="(37) 99999-9999"/>
              </div>
            </div>
          </div>

          {!editando && (
            <div className="csf-secao">
              <div className="csf-secao-head">
                <div className="csf-passo">2</div>
                <div>
                  <div className="csf-secao-titulo">Acesso</div>
                  <div className="csf-secao-desc">E-mail de login e senha inicial</div>
                </div>
              </div>
              <div className="ui-field">
                <label className="ui-label">E-mail <span className="ui-req">*</span></label>
                <input className="ui-input" type="email" value={form.email} onChange={e => atualizar('email', e.target.value)} placeholder="nome@aderiagro.com.br" required/>
              </div>
              <div className="ui-field" style={{ marginBottom: 0 }}>
                <label className="ui-label">Senha inicial <span className="ui-req">*</span></label>
                <div className="csf-senha">
                  <input className="ui-input" value={form.senha} onChange={e => atualizar('senha', e.target.value)} minLength={6} required/>
                  <button type="button" className="ui-btn ui-btn-secondary" onClick={() => atualizar('senha', gerarSenha())} title="Gerar outra senha"><IconRefresh /></button>
                </div>
                <div className="ui-hint">Gerada automaticamente. Você verá os dados de acesso para enviar ao consultor depois de salvar.</div>
              </div>
            </div>
          )}

          <div className="csf-secao" style={{ borderBottom: 'none' }}>
            <div className="csf-secao-head">
              <div className="csf-passo">{editando ? 2 : 3}</div>
              <div>
                <div className="csf-secao-titulo">Papel e acesso</div>
                <div className="csf-secao-desc">O que a pessoa pode ver no sistema</div>
              </div>
            </div>
            <div className="csf-papel" role="radiogroup" aria-label="Papel">
              {[
                ['colaborador', 'Consultor', 'Vê e registra apenas as próprias visitas e clientes, no app de campo.'],
                ['admin', 'Administrador', 'Acesso total: todos os clientes, consultores, visitas e relatórios.'],
              ].map(([valor, titulo, desc]) => (
                <button
                  type="button"
                  key={valor}
                  role="radio"
                  aria-checked={form.role === valor}
                  className={`csf-papel-opt ${form.role === valor ? 'ativo' : ''}`}
                  onClick={() => atualizar('role', valor)}
                  disabled={souEu}
                >
                  <div className="csf-papel-titulo">{titulo}</div>
                  <div className="csf-papel-desc">{desc}</div>
                </button>
              ))}
            </div>
            {souEu && <div className="ui-hint">Você não pode alterar o seu próprio papel nem desativar a sua conta.</div>}

            {editando && (
              <div className="csf-switch" style={{ marginTop: '1rem' }}>
                <div>
                  <div className="csf-papel-titulo">Acesso ativo</div>
                  <div className="csf-papel-desc">
                    {form.ativo ? 'A pessoa consegue entrar no sistema.' : 'Acesso bloqueado. O histórico de visitas é mantido.'}
                  </div>
                </div>
                <button type="button" className={`csf-toggle ${form.ativo ? 'on' : ''}`} onClick={() => atualizar('ativo', !form.ativo)} disabled={souEu} aria-pressed={form.ativo} aria-label="Acesso ativo" />
              </div>
            )}

            {erro && <div className="ui-alert ui-alert-erro" style={{ marginTop: '1rem', marginBottom: 0 }}><IconAlert /> {erro}</div>}
          </div>

          <div className="csf-actions">
            <Link href={editando ? `/admin/consultores/${consultorId}` : '/admin/consultores'} className="ui-btn ui-btn-ghost">Cancelar</Link>
            <button type="submit" className="ui-btn ui-btn-primary" disabled={salvando}>
              {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Cadastrar consultor'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

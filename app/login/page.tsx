'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Modo = 'login' | 'esqueci' | 'esqueci-ok'

export default function LoginPage() {
  const [modo, setModo] = useState<Modo>('login')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setCarregando(true)
    setErro('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) { setErro('Email ou senha incorretos.'); setCarregando(false); return }
    router.push('/dashboard')
  }

  async function handleEsqueci(e: React.FormEvent) {
    e.preventDefault()
    setCarregando(true)
    setErro('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nova-senha`
    })
    if (error) { setErro('Erro ao enviar email. Verifique o endereço.'); setCarregando(false); return }
    setModo('esqueci-ok')
    setCarregando(false)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@400;700;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .page{min-height:100vh;background:#ece9e3;display:flex;align-items:center;justify-content:center;padding:2rem;font-family:'Comfortaa',sans-serif}
        .card{display:flex;width:100%;max-width:860px;border-radius:20px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.13)}
        .left{flex:0 0 44%;position:relative;min-height:520px;overflow:hidden}
        .left-bg{position:absolute;inset:0;background:url('/imgLogin.jpg') center/cover no-repeat}
        .left-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(10,38,20,.55) 0%,rgba(10,38,20,.92) 100%)}
        .left-content{position:relative;z-index:1;height:100%;display:flex;flex-direction:column;justify-content:space-between;padding:2rem}
        .logo{display:flex;align-items:center;gap:8px;font-weight:900;font-size:1.05rem;color:#fff}
        .logo img{width:28px;height:28px;object-fit:contain;flex-shrink:0}
        .logo span{color:#E67E22}
        .badge{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.18);color:#fff;font-size:.72rem;padding:.32rem .75rem;border-radius:20px;margin-bottom:.9rem}
        .left-h{font-weight:900;font-size:1.6rem;color:#fff;line-height:1.25;margin-bottom:.6rem}
        .left-p{color:rgba(255,255,255,.5);font-size:.78rem;line-height:1.65}
        .right{flex:1;background:#fff;padding:2.8rem 2.4rem;display:flex;align-items:center}
        .fw{width:100%}
        .ft{font-weight:700;font-size:1.35rem;color:#1a1a1a;margin-bottom:.25rem}
        .fs{color:#aaa;font-size:.78rem;margin-bottom:1.7rem}
        .campo{margin-bottom:.9rem}
        .campo label{display:block;font-size:.68rem;font-weight:700;color:#555;letter-spacing:.05em;margin-bottom:.4rem}
        .campo input{width:100%;padding:.75rem 1rem;border:1.5px solid #eae5de;border-radius:8px;background:#fafaf8;font-family:'Comfortaa',sans-serif;font-size:.85rem;color:#1a1a1a;outline:none;transition:border-color .2s,box-shadow .2s}
        .campo input:focus{border-color:#E67E22;box-shadow:0 0 0 3px rgba(230,126,34,.1);background:#fff}
        .campo input::placeholder{color:#c5bdb4}
        .esqueci{display:block;text-align:right;font-size:.72rem;color:#E67E22;font-weight:700;cursor:pointer;text-decoration:none;margin-top:.4rem}
        .err{background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:.65rem 1rem;border-radius:8px;font-size:.8rem;margin-bottom:.8rem}
        .ok{background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d;padding:1rem;border-radius:8px;font-size:.85rem;line-height:1.6;margin-bottom:1rem;text-align:center}
        .btn{width:100%;padding:.85rem;background:#E67E22;color:#fff;border:none;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.9rem;font-weight:700;cursor:pointer;transition:background .2s,transform .1s;margin-top:.5rem}
        .btn:hover{background:#d35400}
        .btn:active{transform:scale(.99)}
        .btn:disabled{opacity:.6;cursor:not-allowed}
        .btn-sec{width:100%;padding:.85rem;background:transparent;color:#E67E22;border:1.5px solid #E67E22;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.9rem;font-weight:700;cursor:pointer;transition:all .2s;margin-top:.75rem}
        .btn-sec:hover{background:#fff8f3}
        .div{display:flex;align-items:center;gap:.6rem;margin:1.2rem 0;color:#ddd;font-size:.78rem}
        .div::before,.div::after{content:'';flex:1;height:1px;background:#eee}
        .adm{text-align:center;font-size:.76rem;color:#aaa}
        .adm a{color:#E67E22;font-weight:700;text-decoration:none}
        .voltar{display:flex;align-items:center;gap:4px;font-size:.78rem;color:#E67E22;font-weight:700;cursor:pointer;background:none;border:none;font-family:'Comfortaa',sans-serif;margin-bottom:1.5rem;padding:0}
        @media(max-width:640px){.left{display:none}.card{max-width:420px}}
      `}</style>

      <div className="page">
        <div className="card">
          <div className="left">
            <div className="left-bg"></div>
            <div className="left-overlay"></div>
            <div className="left-content">
              <div className="logo">
                <img src="/logo-aderi.png" alt="Aderi" />
                aderi <span>agronegócios</span>
              </div>
              <div>
                <div className="badge">🔒 Área restrita</div>
                <h2 className="left-h">Sua lavoura,<br/>mais rentabilidade<br/>para você.</h2>
                <p className="left-p">Acesse o sistema interno da Aderi Agro</p>
              </div>
            </div>
          </div>

          <div className="right">
            <div className="fw">

              {/* MODO LOGIN */}
              {modo === 'login' && (
                <>
                  <h1 className="ft">Bem-vindo de volta</h1>
                  <p className="fs">Entre com suas credenciais para continuar</p>
                  <form onSubmit={handleLogin}>
                    <div className="campo">
                      <label>E-MAIL</label>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com.br" required/>
                    </div>
                    <div className="campo">
                      <label>SENHA</label>
                      <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" required/>
                      <button type="button" className="esqueci" onClick={() => { setErro(''); setModo('esqueci') }}>
                        Esqueci minha senha
                      </button>
                    </div>
                    {erro && <div className="err">{erro}</div>}
                    <button type="submit" className="btn" disabled={carregando}>
                      {carregando ? 'Entrando...' : 'Entrar'}
                    </button>
                  </form>
                  <div className="div">ou</div>
                  <p className="adm">Não tem conta? <a href="/cadastro">Cadastre-se</a></p>
                </>
              )}

              {/* MODO ESQUECI SENHA */}
              {modo === 'esqueci' && (
                <>
                  <button className="voltar" onClick={() => { setErro(''); setModo('login') }}>
                    ← Voltar ao login
                  </button>
                  <h1 className="ft">Recuperar senha</h1>
                  <p className="fs">Digite seu email e enviaremos um link para criar uma nova senha</p>
                  <form onSubmit={handleEsqueci}>
                    <div className="campo">
                      <label>E-MAIL</label>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com.br" required/>
                    </div>
                    {erro && <div className="err">{erro}</div>}
                    <button type="submit" className="btn" disabled={carregando}>
                      {carregando ? 'Enviando...' : 'Enviar link de recuperação'}
                    </button>
                    <button type="button" className="btn-sec" onClick={() => { setErro(''); setModo('login') }}>
                      Cancelar
                    </button>
                  </form>
                </>
              )}

              {/* MODO ESQUECI OK */}
              {modo === 'esqueci-ok' && (
                <>
                  <h1 className="ft">Email enviado!</h1>
                  <p className="fs">Verifique sua caixa de entrada</p>
                  <div className="ok">
                    📬 Enviamos um link de recuperação para <strong>{email}</strong>.<br/>
                    Clique no link do email para criar uma nova senha.
                  </div>
                  <button className="btn" onClick={() => { setModo('login'); setEmail('') }}>
                    Voltar ao login
                  </button>
                </>
              )}

            </div>
          </div>
        </div>
      </div>
    </>
  )
}
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function CadastroPage() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [ok, setOk] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (senha !== confirma) { setErro('As senhas não coincidem.'); return }
    if (senha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return }
    setCarregando(true)
    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome_completo: nome } }
    })
    if (error) { console.log('>>> ERRO SIGNUP:', error); setErro('Erro ao criar conta. Tente novamente.'); setCarregando(false); return }
    setOk(true)
    setCarregando(false)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .page{min-height:100vh;background:#ece9e3;display:flex;align-items:center;justify-content:center;padding:2rem;font-family:'Poppins',sans-serif}
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
        .ft{font-weight:600;font-size:1.35rem;color:#1a1a1a;margin-bottom:.25rem}
        .fs{color:#aaa;font-size:.78rem;margin-bottom:1.7rem}
        .campo{margin-bottom:.9rem}
        .campo label{display:block;font-size:.68rem;font-weight:600;color:#555;letter-spacing:.05em;margin-bottom:.4rem}
        .campo input{width:100%;padding:.75rem 1rem;border:1.5px solid #eae5de;border-radius:8px;background:#fafaf8;font-family:'Poppins',sans-serif;font-size:.85rem;color:#1a1a1a;outline:none;transition:border-color .2s,box-shadow .2s}
        .campo input:focus{border-color:#E67E22;box-shadow:0 0 0 3px rgba(230,126,34,.1);background:#fff}
        .campo input::placeholder{color:#c5bdb4}
        .err{background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:.65rem 1rem;border-radius:8px;font-size:.8rem;margin-bottom:.8rem}
        .ok{background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d;padding:1rem;border-radius:8px;font-size:.85rem;line-height:1.7;margin-bottom:1rem;text-align:center}
        .btn{width:100%;padding:.85rem;background:#E67E22;color:#fff;border:none;border-radius:8px;font-family:'Poppins',sans-serif;font-size:.9rem;font-weight:600;cursor:pointer;transition:background .2s;margin-top:.5rem}
        .btn:hover{background:#d35400}
        .btn:disabled{opacity:.6;cursor:not-allowed}
        .adm{text-align:center;font-size:.76rem;color:#aaa;margin-top:1.2rem}
        .adm a{color:#E67E22;font-weight:600;text-decoration:none}
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
                <div className="badge">🌱 Nova conta</div>
                <h2 className="left-h">Comece agora<br/>sua jornada<br/>no campo.</h2>
                <p className="left-p">Crie sua conta e acesse o sistema da Aderi Agro</p>
              </div>
            </div>
          </div>

          <div className="right">
            <div className="fw">
              {!ok ? (
                <>
                  <h1 className="ft">Criar conta</h1>
                  <p className="fs">Preencha seus dados para se cadastrar</p>
                  <form onSubmit={handleCadastro}>
                    <div className="campo">
                      <label>NOME COMPLETO</label>
                      <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome completo" required/>
                    </div>
                    <div className="campo">
                      <label>E-MAIL</label>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com.br" required/>
                    </div>
                    <div className="campo">
                      <label>SENHA</label>
                      <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" required/>
                    </div>
                    <div className="campo">
                      <label>CONFIRMAR SENHA</label>
                      <input type="password" value={confirma} onChange={e => setConfirma(e.target.value)} placeholder="Repita a senha" required/>
                    </div>
                    {erro && <div className="err">{erro}</div>}
                    <button type="submit" className="btn" disabled={carregando}>
                      {carregando ? 'Criando conta...' : 'Criar conta'}
                    </button>
                  </form>
                  <p className="adm">Já tem conta? <a href="/login">Fazer login</a></p>
                </>
              ) : (
                <>
                  <h1 className="ft">Conta criada!</h1>
                  <p className="fs">Verifique seu email para continuar</p>
                  <div className="ok">
                    📬 Enviamos um email de confirmação para <strong>{email}</strong>.<br/>
                    Clique no link do email para ativar sua conta.
                  </div>
                  <button className="btn" onClick={() => router.push('/login')}>
                    Ir para o login
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
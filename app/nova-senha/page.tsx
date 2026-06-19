'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function NovaSenhaPage() {
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [ok, setOk] = useState(false)
  const [sessaoOk, setSessaoOk] = useState(false)
  const [sessaoErro, setSessaoErro] = useState(false)
  const [verificando, setVerificando] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function estabelecerSessao() {
      // PKCE flow: ?code= na URL
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          setSessaoErro(true)
          setVerificando(false)
          return
        }
        setSessaoOk(true)
        setVerificando(false)
        return
      }

      // Implicit flow / sessão já existente
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setSessaoOk(true)
        setVerificando(false)
        return
      }

      // Aguarda evento PASSWORD_RECOVERY caso a sessão ainda não tenha carregado
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
          setSessaoOk(true)
          setVerificando(false)
        }
      })

      // Timeout de segurança: 5 segundos sem sessão = link expirado/inválido
      const timer = setTimeout(() => {
        setSessaoErro(true)
        setVerificando(false)
        subscription.unsubscribe()
      }, 5000)

      return () => {
        clearTimeout(timer)
        subscription.unsubscribe()
      }
    }

    estabelecerSessao()
  }, [])

  async function handleNovaSenha(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (senha !== confirma) { setErro('As senhas não coincidem.'); return }
    if (senha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return }
    setCarregando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) { setErro('Erro ao atualizar senha. O link pode ter expirado.'); setCarregando(false); return }
    setOk(true)
    setCarregando(false)
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@400;700;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .page{min-height:100vh;background:#ece9e3;display:flex;align-items:center;justify-content:center;padding:2rem;font-family:'Comfortaa',sans-serif}
        .card{display:flex;width:100%;max-width:860px;border-radius:20px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.13)}
        .left{flex:0 0 44%;position:relative;min-height:480px;overflow:hidden}
        .left-bg{position:absolute;inset:0;background:url('/imgLogin.jpg') center/cover no-repeat}
        .left-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(10,38,20,.55) 0%,rgba(10,38,20,.92) 100%)}
        .left-content{position:relative;z-index:1;height:100%;display:flex;flex-direction:column;justify-content:space-between;padding:2rem}
        .logo{display:flex;align-items:center;gap:8px;font-weight:900;font-size:1.05rem;color:#fff}
        .logo img{width:28px;height:28px;object-fit:contain;flex-shrink:0}
        .logo span{color:#E67E22}
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
        .err{background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:.65rem 1rem;border-radius:8px;font-size:.8rem;margin-bottom:.8rem}
        .ok{background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d;padding:1rem;border-radius:8px;font-size:.85rem;line-height:1.7;text-align:center}
        .aviso-link{background:#fef3e2;border:1px solid #fde68a;color:#92400e;padding:1rem;border-radius:8px;font-size:.85rem;line-height:1.7}
        .carregando{color:#aaa;font-size:.85rem;text-align:center;padding:2rem 0}
        .btn{width:100%;padding:.85rem;background:#E67E22;color:#fff;border:none;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.9rem;font-weight:700;cursor:pointer;transition:background .2s;margin-top:.5rem}
        .btn:hover{background:#d35400}
        .btn:disabled{opacity:.6;cursor:not-allowed}
        .btn-sec{width:100%;padding:.85rem;background:transparent;color:#162a1e;border:1.5px solid #eae5de;border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.9rem;font-weight:700;cursor:pointer;margin-top:.6rem}
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
                <h2 className="left-h">Quase lá!<br/>Defina sua<br/>nova senha.</h2>
                <p className="left-p">Escolha uma senha segura para proteger sua conta</p>
              </div>
            </div>
          </div>

          <div className="right">
            <div className="fw">
              {ok ? (
                <div className="ok">
                  Senha atualizada com sucesso!<br />
                  Redirecionando para o dashboard...
                </div>
              ) : verificando ? (
                <div className="carregando">Validando link de recuperação...</div>
              ) : sessaoErro ? (
                <>
                  <h1 className="ft">Link inválido</h1>
                  <div className="aviso-link">
                    Este link de recuperação expirou ou já foi utilizado.<br />
                    Solicite um novo link na tela de login.
                  </div>
                  <button className="btn-sec" onClick={() => router.push('/login')}>
                    Voltar ao login
                  </button>
                </>
              ) : (
                <>
                  <h1 className="ft">Nova senha</h1>
                  <p className="fs">Digite e confirme sua nova senha</p>
                  <form onSubmit={handleNovaSenha}>
                    <div className="campo">
                      <label>NOVA SENHA</label>
                      <input
                        type="password"
                        value={senha}
                        onChange={e => setSenha(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        required
                        autoFocus
                      />
                    </div>
                    <div className="campo">
                      <label>CONFIRMAR SENHA</label>
                      <input
                        type="password"
                        value={confirma}
                        onChange={e => setConfirma(e.target.value)}
                        placeholder="Repita a nova senha"
                        required
                      />
                    </div>
                    {erro && <div className="err">{erro}</div>}
                    <button type="submit" className="btn" disabled={carregando}>
                      {carregando ? 'Salvando...' : 'Salvar nova senha'}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

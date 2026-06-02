import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@400;700;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Comfortaa',sans-serif;background:#f0ede8}
        .header{background:#162a1e;padding:1rem 2rem;display:flex;align-items:center;justify-content:space-between}
        .logo{display:flex;align-items:center;gap:8px;font-weight:900;font-size:1rem;color:#fff}
        .logo img{width:26px;height:26px;object-fit:contain}
        .logo span{color:#E67E22}
        .user-area{display:flex;align-items:center;gap:1rem}
        .user-email{color:rgba(255,255,255,0.6);font-size:.78rem}
        .page{padding:2rem}
        .card{background:#fff;border-radius:16px;padding:2rem;box-shadow:0 4px 20px rgba(0,0,0,0.06)}
        .card h1{font-size:1.4rem;font-weight:700;color:#162a1e;margin-bottom:.3rem}
        .card p{color:#aaa;font-size:.85rem}
      `}</style>

      <header className="header">
        <div className="logo">
          <img src="/logo-aderi.png" alt="Aderi" />
          aderi <span>agronegócios</span>
        </div>
        <div className="user-area">
          <span className="user-email">{user.email}</span>
          <form action="/api/logout" method="POST">
            <button type="submit" style={{
              background: 'transparent',
              border: '1.5px solid rgba(255,255,255,0.25)',
              color: '#fff',
              padding: '0.4rem 1rem',
              borderRadius: '8px',
              fontFamily: 'Comfortaa, sans-serif',
              fontSize: '.78rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}>
              Sair
            </button>
          </form>
        </div>
      </header>

      <div className="page">
        <div className="card">
          <h1>Dashboard</h1>
          <p>Bem-vindo de volta, {user.email}</p>
        </div>
      </div>
    </>
  )
}
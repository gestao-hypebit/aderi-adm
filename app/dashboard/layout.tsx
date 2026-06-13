'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [menuAberto, setMenuAberto] = useState(false)
  const pathname = usePathname()

  const links = [
  { href: '/dashboard', label: 'Início', icon: '🏠' },
  { href: '/dashboard/clientes', label: 'Clientes', icon: '👥' },
  { href: '/dashboard/visitas', label: 'Visitas', icon: '📋' },
  { href: '/dashboard/agendamento', label: 'Agenda', icon: '📅' },
  { href: '/dashboard/km', label: 'Controle de KM', icon: '⛽' },
  { href: '/dashboard/relatorios', label: 'Relatórios', icon: '📊' },
    ]

  // Verifica se o link está ativo (exato ou começa com o href para subrotas)
  function isAtivo(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@400;700;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Comfortaa',sans-serif;background:#f0ede8}
        .layout{display:flex;min-height:100vh}

        /* SIDEBAR */
        .sidebar{width:240px;background:#162a1e;display:flex;flex-direction:column;position:fixed;top:0;left:0;height:100vh;z-index:100;transition:transform .3s}
        .sidebar-logo{padding:1.5rem;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:8px}
        .sidebar-logo img{width:28px;height:28px;object-fit:contain}
        .sidebar-logo span{font-weight:900;font-size:.95rem;color:#fff}
        .sidebar-logo span b{color:#E67E22}
        .sidebar-nav{flex:1;padding:1rem 0;overflow-y:auto}
        .nav-label{font-size:.65rem;font-weight:700;color:rgba(255,255,255,.3);letter-spacing:.1em;padding:.5rem 1.5rem;margin-top:.5rem}
        .nav-link{display:flex;align-items:center;gap:.75rem;padding:.75rem 1.5rem;color:rgba(255,255,255,.6);text-decoration:none;font-size:.85rem;font-weight:700;transition:all .2s;border-left:3px solid transparent}
        .nav-link:hover{color:#fff;background:rgba(255,255,255,.05)}
        .nav-link.ativo{color:#fff;background:rgba(230,126,34,.12);border-left-color:#E67E22}
        .nav-link .icon{font-size:1rem;width:20px;text-align:center}
        .sidebar-footer{padding:1rem 1.5rem;border-top:1px solid rgba(255,255,255,.08)}
        .sidebar-footer form{width:100%}
        .btn-sair{width:100%;padding:.65rem;background:transparent;border:1.5px solid rgba(255,255,255,.2);color:rgba(255,255,255,.6);border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.78rem;font-weight:700;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:.5rem}
        .btn-sair:hover{border-color:#E67E22;color:#E67E22}

        /* MAIN */
        .main{margin-left:240px;flex:1;display:flex;flex-direction:column;min-height:100vh;overflow-x:hidden}
        .topbar{background:#fff;padding:1rem 2rem;border-bottom:1px solid #eae5de;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50;width:100%}
        .topbar-user{display:flex;align-items:center;gap:.75rem}
        .user-avatar{width:34px;height:34px;border-radius:50%;background:#E67E22;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.85rem}
        .content{padding:2rem;flex:1}

        /* MOBILE */
        .menu-toggle{display:none;background:none;border:none;cursor:pointer;font-size:1.4rem;color:#162a1e}
        @media(max-width:768px){
          .sidebar{transform:translateX(-100%)}
          .sidebar.aberto{transform:translateX(0)}
          .main{margin-left:0}
          .menu-toggle{display:block}
          .overlay{display:block;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99}
        }
        .overlay{display:none}
      `}</style>

      <div className="layout">
        {menuAberto && <div className="overlay" onClick={() => setMenuAberto(false)}/>}

        <aside className={`sidebar ${menuAberto ? 'aberto' : ''}`}>
          <div className="sidebar-logo">
            <img src="/logo-aderi.png" alt="Aderi"/>
            <span>aderi <b>agro</b></span>
          </div>

          <nav className="sidebar-nav">
            <div className="nav-label">MENU</div>
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link ${isAtivo(link.href) ? 'ativo' : ''}`}
                onClick={() => setMenuAberto(false)}
              >
                <span className="icon">{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="sidebar-footer">
            <form action="/api/logout" method="POST">
              <button type="submit" className="btn-sair">
                🚪 Sair do sistema
              </button>
            </form>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <button className="menu-toggle" onClick={() => setMenuAberto(!menuAberto)}>☰</button>
            <span className="topbar-titulo">
              {links.find(l => isAtivo(l.href))?.label || 'Dashboard'}
            </span>
            <div className="topbar-user">
              <div className="user-avatar">J</div>
            </div>
          </header>

          <main className="content">
            {children}
          </main>
        </div>
      </div>
    </>
  )
}
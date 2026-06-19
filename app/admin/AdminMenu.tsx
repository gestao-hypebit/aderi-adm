'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function IconHome() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
}
function IconCalendar() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function IconClipboard() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
}
function IconBarChart() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
}
function IconMenu() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
}
function IconLogout() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
}

export default function AdminMenu({ children }: { children: React.ReactNode }) {
  const [menuAberto, setMenuAberto] = useState(false)
  const [nomeUsuario, setNomeUsuario] = useState('')
  const [inicialUsuario, setInicialUsuario] = useState('')
  const pathname = usePathname()

  useEffect(() => {
    const supabase = createClient()
    async function carregarPerfil() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('nome_completo')
        .eq('id', user.id)
        .single()
      if (data) {
        const nome = data.nome_completo || user.email || ''
        setNomeUsuario(nome.split(' ')[0])
        setInicialUsuario(nome.charAt(0).toUpperCase())
      }
    }
    carregarPerfil()
  }, [])

  const links = [
    { href: '/admin', label: 'Início', Icon: IconHome },
    { href: '/admin/agenda', label: 'Agenda', Icon: IconCalendar },
    { href: '/admin/visitas', label: 'Visitas', Icon: IconClipboard },
    { href: '/admin/relatorios', label: 'Relatórios', Icon: IconBarChart },
  ]

  function isAtivo(href: string) {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@400;700;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Comfortaa',sans-serif;background:#f0ede8}
        .layout{display:flex;min-height:100vh}
        .sidebar{width:240px;background:#162a1e;display:flex;flex-direction:column;position:fixed;top:0;left:0;height:100vh;z-index:100;transition:transform .3s}
        .sidebar-logo{padding:1.5rem;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:8px}
        .sidebar-logo img{width:28px;height:28px;object-fit:contain}
        .sidebar-logo span{font-weight:900;font-size:.95rem;color:#fff}
        .sidebar-logo span b{color:#E67E22}
        .admin-badge{font-size:.6rem;font-weight:700;color:#162a1e;background:#E67E22;padding:.15rem .5rem;border-radius:10px;letter-spacing:.05em;flex-shrink:0}
        .sidebar-nav{flex:1;padding:1rem 0;overflow-y:auto}
        .nav-label{font-size:.65rem;font-weight:700;color:rgba(255,255,255,.3);letter-spacing:.1em;padding:.5rem 1.5rem;margin-top:.5rem}
        .nav-link{display:flex;align-items:center;gap:.75rem;padding:.75rem 1.5rem;color:rgba(255,255,255,.6);text-decoration:none;font-size:.85rem;font-weight:700;transition:all .2s;border-left:3px solid transparent}
        .nav-link:hover{color:#fff;background:rgba(255,255,255,.05)}
        .nav-link.ativo{color:#fff;background:rgba(230,126,34,.12);border-left-color:#E67E22}
        .nav-link .icon{width:20px;display:flex;align-items:center;justify-content:center}
        .sidebar-footer{padding:1rem 1.5rem;border-top:1px solid rgba(255,255,255,.08)}
        .sidebar-footer form{width:100%}
        .btn-sair{width:100%;padding:.65rem;background:transparent;border:1.5px solid rgba(255,255,255,.2);color:rgba(255,255,255,.6);border-radius:8px;font-family:'Comfortaa',sans-serif;font-size:.78rem;font-weight:700;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:.5rem}
        .btn-sair:hover{border-color:#E67E22;color:#E67E22}
        .main{margin-left:240px;flex:1;display:flex;flex-direction:column;min-height:100vh;overflow-x:hidden}
        .topbar{background:#fff;padding:1rem 2rem;border-bottom:1px solid #eae5de;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50;width:100%}
        .topbar-titulo{font-weight:700;color:#162a1e}
        .topbar-user{display:flex;align-items:center;gap:.75rem}
        .user-nome{font-size:.82rem;font-weight:700;color:#555}
        .user-avatar{width:34px;height:34px;border-radius:50%;background:#E67E22;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.85rem;flex-shrink:0}
        .content{padding:2rem;flex:1}
        .menu-toggle{display:none;background:none;border:none;cursor:pointer;color:#162a1e;line-height:0}
        @media(max-width:768px){
          .sidebar{transform:translateX(-100%)}
          .sidebar.aberto{transform:translateX(0)}
          .main{margin-left:0}
          .menu-toggle{display:block}
          .overlay{display:block;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99}
          .user-nome{display:none}
        }
        .overlay{display:none}
      `}</style>

      <div className="layout">
        {menuAberto && <div className="overlay" onClick={() => setMenuAberto(false)}/>}

        <aside className={`sidebar ${menuAberto ? 'aberto' : ''}`}>
          <div className="sidebar-logo">
            <img src="/logo-aderi.png" alt="Aderi"/>
            <span>aderi <b>agro</b></span>
            <span className="admin-badge">ADMIN</span>
          </div>

          <nav className="sidebar-nav">
            <div className="nav-label">MENU</div>
            {links.map(link => {
              const Icon = link.Icon
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`nav-link ${isAtivo(link.href) ? 'ativo' : ''}`}
                  onClick={() => setMenuAberto(false)}
                >
                  <span className="icon"><Icon /></span>
                  {link.label}
                </Link>
              )
            })}
          </nav>

          <div className="sidebar-footer">
            <form action="/api/logout" method="POST">
              <button type="submit" className="btn-sair">
                <IconLogout /> Sair do sistema
              </button>
            </form>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <button className="menu-toggle" onClick={() => setMenuAberto(!menuAberto)}><IconMenu /></button>
            <span className="topbar-titulo">
              {links.find(l => isAtivo(l.href))?.label || 'Painel Admin'}
            </span>
            <div className="topbar-user">
              {nomeUsuario && <span className="user-nome">{nomeUsuario}</span>}
              <div className="user-avatar">{inicialUsuario || 'A'}</div>
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

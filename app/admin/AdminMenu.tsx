'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import CommandPalette from './_ui/CommandPalette'

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
function IconUsers() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}
function IconBriefcase() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
}
function IconDoc() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>
}
function IconCart() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
}
function IconBox() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
}
function IconMenu() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
}
function IconLogout() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
}
function IconPlus() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function IconClose() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
}

const grupos = [
  {
    titulo: 'Visão geral',
    links: [
      { href: '/admin', label: 'Painel', Icon: IconHome },
      { href: '/admin/agenda', label: 'Agenda da equipe', Icon: IconCalendar },
    ],
  },
  {
    titulo: 'Operação',
    links: [
      { href: '/admin/visitas', label: 'Visitas', Icon: IconClipboard },
      { href: '/admin/clientes', label: 'Clientes', Icon: IconUsers },
      { href: '/admin/consultores', label: 'Consultores', Icon: IconBriefcase },
    ],
  },
  {
    titulo: 'Comercial',
    links: [
      { href: '/admin/cotacoes', label: 'Cotações', Icon: IconDoc },
      { href: '/admin/pedidos', label: 'Pedidos', Icon: IconCart },
      { href: '/admin/produtos', label: 'Produtos', Icon: IconBox },
    ],
  },
  {
    titulo: 'Análises',
    links: [
      { href: '/admin/relatorios', label: 'Relatórios', Icon: IconBarChart },
    ],
  },
]

const titulos: [string, string][] = [
  ['/admin/visitas/novo', 'Nova visita'],
  ['/admin/visitas/', 'Detalhe da visita'],
  ['/admin/visitas', 'Visitas'],
  ['/admin/agenda', 'Agenda da equipe'],
  ['/admin/clientes/novo', 'Novo cliente'],
  ['/admin/clientes/', 'Ficha do cliente'],
  ['/admin/clientes', 'Clientes'],
  ['/admin/consultores/novo', 'Novo consultor'],
  ['/admin/consultores/', 'Ficha do consultor'],
  ['/admin/consultores', 'Consultores'],
  ['/admin/cotacoes/nova', 'Nova cotação'],
  ['/admin/cotacoes/', 'Cotação'],
  ['/admin/cotacoes', 'Cotações'],
  ['/admin/produtos', 'Produtos'],
  ['/admin/pedidos', 'Pedidos'],
  ['/admin/relatorios/equipe', 'Relatório · Desempenho da equipe'],
  ['/admin/relatorios/visitas', 'Relatório · Visitas'],
  ['/admin/relatorios/carteira', 'Relatório · Cobertura da carteira'],
  ['/admin/relatorios/vendas', 'Relatório · Cotações e vendas'],
  ['/admin/relatorios/km', 'Relatório · KM e combustível'],
  ['/admin/relatorios', 'Relatórios'],
]

export default function AdminMenu({ children }: { children: React.ReactNode }) {
  const [menuAberto, setMenuAberto] = useState(false)
  const [buscaAberta, setBuscaAberta] = useState(false)
  const [novoAberto, setNovoAberto] = useState(false)
  const novoRef = useRef<HTMLDivElement>(null)

  // Atalhos globais: Ctrl/⌘+K abre a busca
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setBuscaAberta(true) }
    }
    function fora(e: MouseEvent) {
      if (novoRef.current && !novoRef.current.contains(e.target as Node)) setNovoAberto(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', fora)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', fora) }
  }, [])
  const [nomeCompleto, setNomeCompleto] = useState('')
  const [email, setEmail] = useState('')
  const pathname = usePathname()

  useEffect(() => {
    const supabase = createClient()
    async function carregarPerfil() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setEmail(user.email || '')
      const { data } = await supabase
        .from('profiles')
        .select('nome_completo')
        .eq('id', user.id)
        .single()
      setNomeCompleto(data?.nome_completo || user.email || '')
    }
    carregarPerfil()
  }, [])

  function isAtivo(href: string) {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  const tituloPagina = pathname.endsWith('/editar')
    ? 'Editar'
    : titulos.find(([p]) => pathname.startsWith(p))?.[1] ?? 'Painel'
  const hojeTexto = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const inicial = nomeCompleto.charAt(0).toUpperCase() || 'A'
  const primeiroNome = nomeCompleto.split(' ')[0]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Poppins',sans-serif;background:#f0ede8;color:#162a1e;-webkit-font-smoothing:antialiased}
        .layout{display:flex;min-height:100vh}

        .sidebar{width:252px;background:#162a1e;background-image:radial-gradient(120% 60% at 0% 0%,rgba(230,126,34,.10) 0%,transparent 60%);display:flex;flex-direction:column;position:fixed;top:0;left:0;height:100vh;z-index:100;transition:transform .3s ease}
        .sidebar-logo{padding:1.4rem 1.3rem 1.2rem;display:flex;align-items:center;gap:10px}
        .sidebar-logo img{width:30px;height:30px;object-fit:contain}
        .sidebar-logo-txt{font-weight:900;font-size:.98rem;color:#fff;line-height:1.1}
        .sidebar-logo-txt b{color:#E67E22}
        .sidebar-logo-sub{font-size:.58rem;font-weight:600;color:rgba(255,255,255,.4);letter-spacing:.14em;text-transform:uppercase;margin-top:.2rem}
        .sidebar-close{display:none;margin-left:auto;background:none;border:none;color:rgba(255,255,255,.6);cursor:pointer;line-height:0}

        .sidebar-cta{margin:.2rem 1rem .6rem}
        .sidebar-cta a{display:flex;align-items:center;justify-content:center;gap:.5rem;background:#E67E22;color:#fff;text-decoration:none;font-size:.8rem;font-weight:600;padding:.72rem;border-radius:10px;box-shadow:0 4px 14px rgba(230,126,34,.3);transition:background .15s,transform .15s}
        .sidebar-cta a:hover{background:#d35400}
        .sidebar-cta a:active{transform:translateY(1px)}

        .sidebar-nav{flex:1;padding:.4rem .75rem;overflow-y:auto}
        .nav-grupo{margin-top:1.1rem}
        .nav-label{font-size:.6rem;font-weight:600;color:rgba(255,255,255,.32);letter-spacing:.14em;text-transform:uppercase;padding:0 .75rem;margin-bottom:.4rem}
        .nav-link{display:flex;align-items:center;gap:.75rem;padding:.66rem .75rem;margin-bottom:2px;color:rgba(255,255,255,.62);text-decoration:none;font-size:.82rem;font-weight:600;border-radius:9px;transition:background .15s,color .15s;position:relative}
        .nav-link:hover{color:#fff;background:rgba(255,255,255,.06)}
        .nav-link.ativo{color:#fff;background:rgba(255,255,255,.09)}
        .nav-link.ativo::before{content:'';position:absolute;left:-.75rem;top:22%;bottom:22%;width:3px;border-radius:0 3px 3px 0;background:#E67E22}
        .nav-link.ativo .icon{color:#E67E22}
        .nav-link .icon{width:20px;display:flex;align-items:center;justify-content:center;flex-shrink:0}

        .sidebar-footer{padding:.9rem .75rem 1rem;border-top:1px solid rgba(255,255,255,.07);display:flex;flex-direction:column;gap:.35rem}
        .sidebar-user{display:flex;align-items:center;gap:.7rem;padding:.65rem .75rem;border-radius:11px;background:rgba(255,255,255,.05)}
        .sidebar-user-avatar{width:34px;height:34px;border-radius:50%;background:#E67E22;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:.85rem;flex-shrink:0}
        .sidebar-user-info{flex:1;min-width:0}
        .sidebar-user-nome{font-size:.78rem;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .sidebar-user-email{font-size:.62rem;color:rgba(255,255,255,.42);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:.15rem}
        .sidebar-sair{background:none;border:none;color:rgba(255,255,255,.5);cursor:pointer;width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;transition:background .15s,color .15s;flex-shrink:0}
        .sidebar-sair:hover{background:rgba(231,76,60,.15);color:#ff8a7d}

        .main{margin-left:252px;flex:1;display:flex;flex-direction:column;min-height:100vh;min-width:0}
        .topbar{background:rgba(240,237,232,.85);backdrop-filter:saturate(1.4) blur(10px);-webkit-backdrop-filter:saturate(1.4) blur(10px);padding:.9rem 2.2rem;border-bottom:1px solid rgba(22,42,30,.06);display:flex;align-items:center;gap:1rem;position:sticky;top:0;z-index:50}
        .topbar-titulo{font-weight:600;color:#162a1e;font-size:.92rem}
        .topbar-data{font-size:.72rem;color:#8f978f;white-space:nowrap}
        .topbar-busca{margin-left:auto;display:flex;align-items:center;gap:.6rem;width:min(340px,32vw);padding:.5rem .55rem .5rem .8rem;background:#fff;border:1px solid #eae5de;border-radius:10px;font-family:'Poppins',sans-serif;font-size:.76rem;color:#8f978f;cursor:pointer;transition:border-color .15s,box-shadow .15s}
        .topbar-busca:hover{border-color:#cfc8bd;box-shadow:0 2px 8px rgba(22,42,30,.06)}
        .topbar-busca span{flex:1;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .topbar-kbd{font-size:.62rem;font-weight:600;color:#8f978f;border:1px solid #eae5de;border-radius:6px;padding:.12rem .4rem;background:#faf8f5}
        .topbar-novo{position:relative}
        .topbar-novo-menu{position:absolute;right:0;top:calc(100% + 6px);background:#fff;border:1px solid #eae5de;border-radius:12px;box-shadow:0 16px 40px rgba(22,42,30,.16);padding:.35rem;min-width:220px;z-index:200}
        .topbar-novo-menu a{display:flex;align-items:center;gap:.65rem;padding:.6rem .7rem;border-radius:8px;font-size:.78rem;font-weight:600;color:#162a1e;text-decoration:none}
        .topbar-novo-menu a:hover{background:#f7f5f1}
        .topbar-novo-menu small{display:block;font-size:.64rem;color:#8f978f;font-weight:400;margin-top:.1rem}
        .topbar-novo-ico{width:30px;height:30px;border-radius:8px;background:#fdf3e9;color:#E67E22;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .topbar-data::first-letter{text-transform:uppercase}
        .topbar-user{display:flex;align-items:center;gap:.6rem}
        .user-nome{font-size:.8rem;font-weight:600;color:#5b6660}
        .user-role{font-size:.64rem;font-weight:600;padding:.26rem .6rem;border-radius:20px;letter-spacing:.03em;white-space:nowrap;background:rgba(230,126,34,.12);color:#c0651a;border:1px solid rgba(230,126,34,.25)}
        .content{padding:1.9rem 2.2rem 3rem;flex:1;width:100%}

        .menu-toggle{display:none;background:none;border:none;cursor:pointer;color:#162a1e;line-height:0}
        .overlay{display:none}
        @media(max-width:1200px){.topbar-data{display:none}}
        @media(max-width:900px){
          .sidebar{transform:translateX(-100%);box-shadow:none}
          .sidebar.aberto{transform:translateX(0);box-shadow:0 0 40px rgba(0,0,0,.3)}
          .sidebar-close{display:block}
          .main{margin-left:0}
          .menu-toggle{display:block}
          .overlay{display:block;position:fixed;inset:0;background:rgba(13,31,20,.5);z-index:99}
          .topbar{padding:.8rem 1.1rem}
          .topbar-data,.user-nome,.user-role{display:none}
          .topbar-busca{width:auto;padding:.5rem}
          .topbar-busca span,.topbar-busca .topbar-kbd{display:none}
          .topbar-novo-label{display:none}
          .content{padding:1.3rem 1rem 2.5rem}
        }
        @media print{.sidebar,.topbar{display:none !important}.main{margin-left:0 !important}.content{padding:0 !important}}
      `}</style>

      <div className="layout">
        {menuAberto && <div className="overlay" onClick={() => setMenuAberto(false)}/>}

        <aside className={`sidebar ${menuAberto ? 'aberto' : ''}`}>
          <div className="sidebar-logo">
            <img src="/logo-aderi.png" alt="Aderi"/>
            <div>
              <div className="sidebar-logo-txt">aderi <b>agro</b></div>
              <div className="sidebar-logo-sub">Administração</div>
            </div>
            <button className="sidebar-close" onClick={() => setMenuAberto(false)} aria-label="Fechar menu"><IconClose /></button>
          </div>

          <div className="sidebar-cta">
            <Link href="/admin/visitas/novo" onClick={() => setMenuAberto(false)}><IconPlus /> Nova visita</Link>
          </div>

          <nav className="sidebar-nav">
            {grupos.map(grupo => (
              <div key={grupo.titulo} className="nav-grupo">
                <div className="nav-label">{grupo.titulo}</div>
                {grupo.links.map(({ href, label, Icon }) => (
                  <Link key={href} href={href} className={`nav-link ${isAtivo(href) ? 'ativo' : ''}`} onClick={() => setMenuAberto(false)}>
                    <span className="icon"><Icon /></span>
                    {label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-user">
              <div className="sidebar-user-avatar">{inicial}</div>
              <div className="sidebar-user-info">
                <div className="sidebar-user-nome">{nomeCompleto || 'Administrador'}</div>
                <div className="sidebar-user-email">{email}</div>
              </div>
              <form action="/api/logout" method="POST">
                <button type="submit" className="sidebar-sair" title="Sair do sistema" aria-label="Sair do sistema">
                  <IconLogout />
                </button>
              </form>
            </div>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <button className="menu-toggle" onClick={() => setMenuAberto(true)} aria-label="Abrir menu"><IconMenu /></button>
            <span className="topbar-titulo">{tituloPagina}</span>
            <button className="topbar-busca" onClick={() => setBuscaAberta(true)} aria-label="Buscar (Ctrl+K)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <span>Buscar cliente, consultor, visita...</span>
              <kbd className="topbar-kbd">Ctrl K</kbd>
            </button>
            <div className="topbar-novo" ref={novoRef}>
              <button className="ui-btn ui-btn-primary ui-btn-sm" onClick={() => setNovoAberto(a => !a)} aria-haspopup="menu" aria-expanded={novoAberto}>
                <IconPlus /> <span className="topbar-novo-label">Novo</span>
              </button>
              {novoAberto && (
                <div className="topbar-novo-menu" role="menu" onClick={() => setNovoAberto(false)}>
                  <Link href="/admin/visitas/novo" role="menuitem"><span className="topbar-novo-ico"><IconCalendar /></span><span>Visita<small>Agendar para um consultor</small></span></Link>
                  <Link href="/admin/clientes/novo" role="menuitem"><span className="topbar-novo-ico"><IconUsers /></span><span>Cliente<small>Cadastrar produtor</small></span></Link>
                  <Link href="/admin/cotacoes/nova" role="menuitem"><span className="topbar-novo-ico"><IconDoc /></span><span>Cotação<small>Orçamento e pedido do cliente</small></span></Link>
                  <Link href="/admin/consultores/novo" role="menuitem"><span className="topbar-novo-ico"><IconBriefcase /></span><span>Consultor<small>Criar acesso da equipe</small></span></Link>
                </div>
              )}
            </div>
            <span className="topbar-data" suppressHydrationWarning>{hojeTexto}</span>
            <div className="topbar-user">
              {primeiroNome && <span className="user-nome">{primeiroNome}</span>}
              <span className="user-role">Administrador</span>
            </div>
          </header>

          <main className="content">
            {children}
          </main>
          {buscaAberta && <CommandPalette aberto onFechar={() => setBuscaAberta(false)} />}
        </div>
      </div>
    </>
  )
}

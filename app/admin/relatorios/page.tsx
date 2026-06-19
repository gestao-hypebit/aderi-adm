import Link from 'next/link'

function IconClipboard() {
  return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E67E22" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
}
function IconUsers() {
  return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E67E22" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}
function IconCar() {
  return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E67E22" strokeWidth="2"><path d="M5 17h14M5 17a2 2 0 0 1-2-2v-2a2 2 0 0 1 .5-1.32L5.5 9a2 2 0 0 1 1.5-.68h10a2 2 0 0 1 1.5.68l2 2.68A2 2 0 0 1 21 13v2a2 2 0 0 1-2 2"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/></svg>
}
function IconArrow() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
}

const relatorios = [
  {
    href: '/admin/relatorios/visitas',
    titulo: 'Relatório de Visitas',
    desc: 'Gere PDFs detalhados das visitas técnicas realizadas, com dados do produtor, da propriedade, recomendações e fotos.',
    Icon: IconClipboard,
    cor: '#27ae60',
  },
  {
    href: '/admin/relatorios/clientes',
    titulo: 'Relatório de Clientes',
    desc: 'Ficha completa de produtores: dados cadastrais, resumo de visitas e últimos atendimentos.',
    Icon: IconUsers,
    cor: '#162a1e',
  },
  {
    href: '/admin/relatorios/km',
    titulo: 'Relatório de KM / Combustível',
    desc: 'Resumo de quilometragem rodada e abastecimentos por período, com detalhamento dia a dia.',
    Icon: IconCar,
    cor: '#E67E22',
  },
]

export default function AdminRelatoriosHub() {
  return (
    <>
      <style>{`
        .rel-hub-header{margin-bottom:1.8rem}
        .rel-hub-titulo{font-size:1.4rem;font-weight:700;color:#162a1e}
        .rel-hub-sub{color:#aaa;font-size:.82rem;margin-top:.25rem}
        .rel-hub-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1.2rem}
        .rel-hub-card{background:#fff;border-radius:14px;padding:1.6rem;box-shadow:0 2px 8px rgba(0,0,0,.05);text-decoration:none;display:flex;flex-direction:column;transition:transform .15s,box-shadow .15s;border-top:3px solid}
        .rel-hub-card:hover{transform:translateY(-3px);box-shadow:0 6px 20px rgba(0,0,0,.1)}
        .rel-hub-icon{margin-bottom:1rem}
        .rel-hub-card-titulo{font-size:1rem;font-weight:700;color:#162a1e;margin-bottom:.5rem}
        .rel-hub-card-desc{font-size:.8rem;color:#888;line-height:1.6;flex:1}
        .rel-hub-card-link{display:inline-flex;align-items:center;gap:.4rem;font-size:.78rem;font-weight:700;color:#E67E22;margin-top:1.1rem}
      `}</style>

      <div className="rel-hub-header">
        <div className="rel-hub-titulo">Relatórios</div>
        <div className="rel-hub-sub">Escolha o tipo de relatório que deseja gerar</div>
      </div>

      <div className="rel-hub-grid">
        {relatorios.map(({ href, titulo, desc, Icon, cor }) => (
          <Link key={href} href={href} className="rel-hub-card" style={{ borderTopColor: cor }}>
            <div className="rel-hub-icon"><Icon /></div>
            <div className="rel-hub-card-titulo">{titulo}</div>
            <div className="rel-hub-card-desc">{desc}</div>
            <div className="rel-hub-card-link">Acessar <IconArrow /></div>
          </Link>
        ))}
      </div>
    </>
  )
}

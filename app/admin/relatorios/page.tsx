import Link from 'next/link'

function IconClipboard() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
}
function IconUsers() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}
function IconCar() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 17h14M5 17a2 2 0 0 1-2-2v-2a2 2 0 0 1 .5-1.32L5.5 9a2 2 0 0 1 1.5-.68h10a2 2 0 0 1 1.5.68l2 2.68A2 2 0 0 1 21 13v2a2 2 0 0 1-2 2"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/></svg>
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
    fundo: '#eaf7ef',
    tag: 'PDF por visita',
  },
  {
    href: '/admin/relatorios/clientes',
    titulo: 'Relatório de Clientes',
    desc: 'Ficha completa de produtores: dados cadastrais, resumo de visitas e últimos atendimentos.',
    Icon: IconUsers,
    cor: '#162a1e',
    fundo: '#e8ece9',
    tag: 'Ficha do produtor',
  },
  {
    href: '/admin/relatorios/km',
    titulo: 'Relatório de KM / Combustível',
    desc: 'Resumo de quilometragem rodada e abastecimentos por período, com detalhamento dia a dia.',
    Icon: IconCar,
    cor: '#E67E22',
    fundo: '#fdf3e9',
    tag: 'Imprimir / PDF',
  },
]

export default function AdminRelatoriosHub() {
  return (
    <>
      <style>{`
        .rel-hub-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:1.1rem}
        .rel-hub-card{padding:1.5rem;text-decoration:none;display:flex;flex-direction:column;position:relative;overflow:hidden}
        .rel-hub-card:hover .rel-hub-card-link{gap:.6rem}
        .rel-hub-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.2rem}
        .rel-hub-icon{width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center}
        .rel-hub-tag{font-size:.62rem;font-weight:700;color:#8f978f;background:#f7f5f1;border:1px solid #eae5de;border-radius:999px;padding:.25rem .6rem}
        .rel-hub-card-titulo{font-size:1rem;font-weight:700;color:#162a1e;margin-bottom:.45rem}
        .rel-hub-card-desc{font-size:.78rem;color:#8f978f;line-height:1.65;flex:1}
        .rel-hub-card-link{display:inline-flex;align-items:center;gap:.4rem;font-size:.78rem;font-weight:700;color:#E67E22;margin-top:1.2rem;padding-top:1rem;border-top:1px solid #f2efea;transition:gap .2s}
      `}</style>

      <div className="ui-page-header">
        <div>
          <div className="ui-title">Relatórios</div>
          <div className="ui-sub">Escolha o tipo de relatório. Todos podem ser filtrados por período e consultor.</div>
        </div>
      </div>

      <div className="rel-hub-grid">
        {relatorios.map(({ href, titulo, desc, Icon, cor, fundo, tag }) => (
          <Link key={href} href={href} className="ui-card ui-card-hover rel-hub-card">
            <div className="rel-hub-top">
              <div className="rel-hub-icon" style={{ background: fundo, color: cor }}><Icon /></div>
              <span className="rel-hub-tag">{tag}</span>
            </div>
            <div className="rel-hub-card-titulo">{titulo}</div>
            <div className="rel-hub-card-desc">{desc}</div>
            <div className="rel-hub-card-link">Abrir relatório <IconArrow /></div>
          </Link>
        ))}
      </div>
    </>
  )
}

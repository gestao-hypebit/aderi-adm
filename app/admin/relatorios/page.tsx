import Link from 'next/link'

function IconClipboard() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
}
function IconUsers() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}
function IconDoc() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>
}
function IconRoute() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/></svg>
}
function IconTrophy() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>
}
function IconArrow() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
}

const RELATORIOS = [
  { href: '/admin/relatorios/equipe', titulo: 'Desempenho da equipe', Icon: IconTrophy, cor: '#1a7f4b', fundo: '#eaf7ef',
    desc: 'Placar por consultor: visitas, clientes atendidos, KM, custo por visita, vendas e conversão.',
    perguntas: ['Quem está entregando mais?', 'Quanto custa cada visita?'] },
  { href: '/admin/relatorios/visitas', titulo: 'Visitas', Icon: IconClipboard, cor: '#E67E22', fundo: '#fdf3e9',
    desc: 'Volume por status, consultor, motivo e mês, com a lista detalhada para exportar.',
    perguntas: ['Quais motivos geram mais visitas?', 'Quantas foram canceladas?'] },
  { href: '/admin/relatorios/carteira', titulo: 'Cobertura da carteira', Icon: IconUsers, cor: '#162a1e', fundo: '#eef1ef',
    desc: 'Há quanto tempo cada cliente não recebe visita, quem nunca foi visitado e cobertura por cidade.',
    perguntas: ['Quem está esquecido?', 'Quais cidades têm menos atenção?'] },
  { href: '/admin/relatorios/vendas', titulo: 'Cotações e vendas', Icon: IconDoc, cor: '#1a7f4b', fundo: '#eaf7ef',
    desc: 'Funil de cotações, conversão e valor aprovado por consultor, produtos mais vendidos e principais clientes.',
    perguntas: ['Qual produto mais vende?', 'Qual a margem média?'] },
  { href: '/admin/relatorios/km', titulo: 'KM e combustível', Icon: IconRoute, cor: '#162a1e', fundo: '#eef1ef',
    desc: 'Rodagem, consumo (km/L), custo por km e por visita, por consultor e por mês, com a lista de lançamentos para conferir e excluir.',
    perguntas: ['Quem consome mais?', 'Quanto gasto por visita?'] },
]

export default function RelatoriosPage() {
  return (
    <>
      <style>{`
        .rh-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1.1rem}
        .rh-card{padding:1.3rem 1.35rem;display:flex;flex-direction:column;gap:.8rem;text-decoration:none;color:inherit}
        .rh-top{display:flex;align-items:center;gap:.8rem}
        .rh-ico{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .rh-tit{font-size:.98rem;font-weight:600;color:#162a1e}
        .rh-desc{font-size:.78rem;color:#5b6660;line-height:1.6}
        .rh-pergs{display:flex;flex-wrap:wrap;gap:.35rem}
        .rh-perg{font-size:.68rem;color:#5b6660;background:#f7f5f1;border-radius:999px;padding:.25rem .6rem}
        .rh-abrir{margin-top:auto;display:inline-flex;align-items:center;gap:.35rem;font-size:.76rem;font-weight:600;color:#E67E22}
      `}</style>

      <div className="ui-page-header">
        <div>
          <div className="ui-title">Relatórios</div>
          <div className="ui-sub">Análises da operação com filtro por período e consultor. Todos podem ser exportados em CSV ou impressos.</div>
        </div>
      </div>

      <div className="rh-grid">
        {RELATORIOS.map(({ href, titulo, Icon, cor, fundo, desc, perguntas }) => (
          <Link key={href} href={href} className="ui-card ui-card-hover rh-card">
            <div className="rh-top">
              <div className="rh-ico" style={{ background: fundo, color: cor }}><Icon /></div>
              <div className="rh-tit">{titulo}</div>
            </div>
            <div className="rh-desc">{desc}</div>
            <div className="rh-pergs">{perguntas.map(p => <span key={p} className="rh-perg">{p}</span>)}</div>
            <span className="rh-abrir">Abrir relatório <IconArrow /></span>
          </Link>
        ))}
      </div>
    </>
  )
}

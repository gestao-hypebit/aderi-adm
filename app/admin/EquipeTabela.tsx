'use client'

import Link from 'next/link'
import Tabela from '@/app/components/Tabela'

export type LinhaEquipe = {
  id: string
  nome: string
  realizadas: number
  agendadas: number
  clientes: number
  km: number
  litros: number
  gasto: number
  vendido: number
}

const moeda = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const taxa = (c: LinhaEquipe) => (c.realizadas + c.agendadas ? Math.round((c.realizadas / (c.realizadas + c.agendadas)) * 100) : null)

function IconPlus() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}

export default function EquipeTabela({ linhas }: { linhas: LinhaEquipe[] }) {
  return (
    <Tabela
      linhas={linhas}
      chave={c => c.id}
      href={c => `/admin/consultores/${c.id}`}
      rotulo="consultores"
      porPagina={10}
      ordemInicial={{ coluna: 'real', direcao: 'desc' }}
      vazio={<div className="ui-empty"><div className="ui-empty-title">Nenhum consultor ativo</div><div className="ui-empty-text">Cadastre a equipe em Consultores.</div></div>}
      colunas={[
        { id: 'nome', titulo: 'Consultor', ordenar: (a, b) => a.nome.localeCompare(b.nome),
          celula: c => <div className="ui-cel"><span className="ui-avatar ui-avatar-sm">{c.nome.charAt(0).toUpperCase()}</span><span className="ui-cel-titulo">{c.nome}</span></div> },
        { id: 'real', titulo: 'Realizadas', alinhar: 'dir', ordenar: (a, b) => a.realizadas - b.realizadas || a.vendido - b.vendido, celula: c => <span className="ui-cel-num ui-cel-forte">{c.realizadas}</span> },
        { id: 'agend', titulo: 'Agendadas', alinhar: 'dir', ocultar: 'celular', ordenar: (a, b) => a.agendadas - b.agendadas, celula: c => <span className="ui-cel-num">{c.agendadas}</span> },
        { id: 'taxa', titulo: 'Conclusão', alinhar: 'dir', ordenar: (a, b) => (taxa(a) ?? -1) - (taxa(b) ?? -1),
          celula: c => {
            const t = taxa(c)
            const cor = t == null ? '#b8bdb6' : t >= 70 ? '#1a7f4b' : '#E67E22'
            return (
              <div className="ui-cel" style={{ gap: '.55rem', justifyContent: 'flex-end' }}>
                <span className="ui-cel-num" style={{ color: cor, fontWeight: 600 }}>{t == null ? '—' : `${t}%`}</span>
                <div className="ui-progress" style={{ width: 64, height: 5 }}><span style={{ width: `${t ?? 0}%`, background: cor }} /></div>
              </div>
            )
          } },
        { id: 'cli', titulo: 'Clientes', alinhar: 'dir', ocultar: 'tablet', ordenar: (a, b) => a.clientes - b.clientes, celula: c => <span className="ui-cel-num">{c.clientes}</span> },
        { id: 'km', titulo: 'KM', alinhar: 'dir', ocultar: 'tablet', ordenar: (a, b) => a.km - b.km, celula: c => <span className="ui-cel-num">{c.km.toLocaleString('pt-BR')}</span> },
        { id: 'kml', titulo: 'km/L', alinhar: 'dir', ocultar: 'tablet', ordenar: (a, b) => (a.litros ? a.km / a.litros : 0) - (b.litros ? b.km / b.litros : 0),
          celula: c => c.litros > 0 ? <span className="ui-cel-num">{(c.km / c.litros).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</span> : <span className="ui-cel-mudo">—</span> },
        { id: 'comb', titulo: 'Combustível', alinhar: 'dir', ocultar: 'tablet', ordenar: (a, b) => a.gasto - b.gasto, celula: c => <span className="ui-cel-num">{moeda(c.gasto)}</span> },
        { id: 'venda', titulo: 'Vendas efetivadas', alinhar: 'dir', ordenar: (a, b) => a.vendido - b.vendido,
          celula: c => c.vendido ? <span className="ui-cel-num ui-cel-forte">{moeda(c.vendido)}</span> : <span className="ui-cel-mudo">—</span> },
        { id: 'acoes', titulo: '', alinhar: 'dir', ocultar: 'celular',
          celula: c => (
            <div className="ui-cel-acoes">
              <Link href={`/admin/agenda?func=${c.id}`} className="ui-btn ui-btn-ghost ui-btn-sm">Agenda</Link>
              <Link href={`/admin/visitas/novo?funcionario=${c.id}`} className="ui-btn ui-btn-secondary ui-btn-sm"><IconPlus /> Agendar</Link>
            </div>
          ) },
      ]}
    />
  )
}

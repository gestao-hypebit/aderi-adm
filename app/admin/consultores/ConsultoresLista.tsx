'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Tabela, { Paginacao, usePaginacao } from '@/app/components/Tabela'
import { linkWhatsApp } from '@/lib/contato'
import { SeletorVisao, useVisao } from '@/app/components/AlternarVisao'

export type LinhaConsultor = {
  id: string
  nome: string
  cargo: string
  telefone: string | null
  realizadas: number
  agendadas: number
  clientes: number
  km: number
  atrasadas: number
  proxima: string | null
  ultimaAtividade: string | null
}

const fmt = (d: string) => d.split('-').reverse().slice(0, 2).join('/')
const taxaDe = (c: LinhaConsultor) => {
  const total = c.realizadas + c.agendadas
  return total > 0 ? Math.round((c.realizadas / total) * 100) : null
}
const corTaxa = (t: number | null) => (t == null ? '#b8bdb6' : t >= 70 ? '#1a7f4b' : '#E67E22')

function Taxa({ c }: { c: LinhaConsultor }) {
  const t = taxaDe(c)
  return (
    <div className="ui-cel" style={{ gap: '.55rem', justifyContent: 'flex-end' }}>
      <span className="ui-cel-num ui-cel-forte" style={{ color: corTaxa(t) }}>{t == null ? '—' : `${t}%`}</span>
      <div className="ui-progress" style={{ width: 64, height: 5 }}><span style={{ width: `${t ?? 0}%`, background: corTaxa(t) }} /></div>
    </div>
  )
}

export default function ConsultoresLista({ linhas }: { linhas: LinhaConsultor[] }) {
  const [visao, setVisao] = useVisao('admin-consultores')
  const cards = usePaginacao(linhas, 24)
  const router = useRouter()
  const [erro, setErro] = useState('')

  async function desativar(id: string) {
    setErro('')
    const { error } = await createClient().from('profiles').update({ ativo: false }).eq('id', id)
    if (error) { setErro('Não foi possível desativar o acesso.'); return }
    router.refresh()
  }

  return (
    <>
      <style>{`
        .col-barra{display:flex;justify-content:flex-end;margin-bottom:1rem}
        .col-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:1.1rem}
        .col-card{padding:1.3rem;display:flex;flex-direction:column;gap:1rem;text-decoration:none;color:inherit}
        .col-head{display:flex;align-items:center;gap:.8rem}
        .col-stats{display:grid;grid-template-columns:repeat(4,1fr);background:#faf8f5;border:1px solid #f2efea;border-radius:12px}
        .col-stat{padding:.7rem .4rem;text-align:center;border-right:1px solid #f2efea}
        .col-stat:last-child{border-right:none}
        .col-stat b{display:block;font-size:1rem;font-weight:600;color:#162a1e}
        .col-stat span{font-size:.58rem;font-weight:600;color:#8f978f;text-transform:uppercase;letter-spacing:.05em}
        .col-linha{display:flex;justify-content:space-between;font-size:.74rem;color:#8f978f}
        .col-linha b{color:#162a1e;font-weight:600}
        .col-atrasada{display:inline-flex;font-size:.64rem;font-weight:600;color:#c0392b;background:#fdeeec;border-radius:999px;padding:.15rem .5rem;margin-top:.25rem}
      `}</style>

      {erro && <div className="ui-alert ui-alert-erro">{erro}</div>}
      <div className="col-barra"><SeletorVisao visao={visao} onChange={setVisao} /></div>

      {visao === 'cards' ? (
        <>
          <div className="col-grid">
            {cards.visiveis.map(c => {
              const t = taxaDe(c)
              return (
                <Link key={c.id} href={`/admin/consultores/${c.id}`} className="ui-card ui-card-hover col-card">
                  <div className="col-head">
                    <div className="ui-avatar ui-avatar-lg">{c.nome.charAt(0).toUpperCase()}</div>
                    <div className="ui-cel-txt" style={{ flex: 1 }}>
                      <div className="ui-cel-titulo" style={{ fontSize: '.95rem' }}>{c.nome}</div>
                      <div className="ui-cel-sub">{c.cargo}</div>
                      {c.atrasadas > 0 && <span className="col-atrasada">{c.atrasadas} atrasada{c.atrasadas > 1 ? 's' : ''}</span>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="ui-cel-forte" style={{ fontSize: '1.1rem', color: corTaxa(t) }}>{t == null ? '—' : `${t}%`}</div>
                      <div className="ui-cel-sub" style={{ textTransform: 'uppercase', fontSize: '.58rem', fontWeight: 600 }}>Conclusão</div>
                    </div>
                  </div>
                  <div className="ui-progress"><span style={{ width: `${t ?? 0}%`, background: corTaxa(t) }} /></div>
                  <div className="col-stats">
                    <div className="col-stat"><b>{c.realizadas}</b><span>Realizadas</span></div>
                    <div className="col-stat"><b>{c.agendadas}</b><span>Agendadas</span></div>
                    <div className="col-stat"><b>{c.clientes}</b><span>Clientes</span></div>
                    <div className="col-stat"><b>{c.km.toLocaleString('pt-BR')}</b><span>KM</span></div>
                  </div>
                  <div className="col-linha"><span>Próxima visita</span><b style={{ color: c.proxima ? '#E67E22' : '#b8bdb6' }}>{c.proxima ? fmt(c.proxima) : 'Nada agendado'}</b></div>
                  <div className="col-linha"><span>Última atividade</span><b>{c.ultimaAtividade ? fmt(c.ultimaAtividade) : '—'}</b></div>
                </Link>
              )
            })}
          </div>
          <Paginacao controle={cards.controle} rotulo="consultores" solta />
        </>
      ) : (
        <Tabela
          linhas={linhas}
          chave={c => c.id}
          href={c => `/admin/consultores/${c.id}`}
          rotulo="consultores"
          acoes={c => [
            { rotulo: 'Abrir ficha', icone: 'ver', href: `/admin/consultores/${c.id}` },
            { rotulo: 'Editar', icone: 'editar', href: `/admin/consultores/${c.id}/editar` },
            { rotulo: 'Ver agenda', icone: 'agenda', href: `/admin/agenda?func=${c.id}` },
            { rotulo: 'Agendar visita', icone: 'visita', href: `/admin/visitas/novo?funcionario=${c.id}` },
            !!linkWhatsApp(c.telefone) && { rotulo: 'WhatsApp', icone: 'whatsapp', href: linkWhatsApp(c.telefone)!, novaAba: true },
            { rotulo: 'Desativar acesso', icone: 'desativar', perigo: true, onClick: () => desativar(c.id),
              confirmar: { titulo: `Desativar o acesso de ${c.nome}?`, botao: 'Desativar acesso',
                texto: 'A pessoa não consegue mais entrar no sistema e deixa de aparecer para novos agendamentos. Visitas, clientes e histórico são mantidos. Dá para reativar na ficha.' } },
          ]}
          colunas={[
            { id: 'nome', titulo: 'Consultor', ordenar: (a, b) => a.nome.localeCompare(b.nome),
              celula: c => (
                <div className="ui-cel">
                  <div className="ui-avatar">{c.nome.charAt(0).toUpperCase()}</div>
                  <div className="ui-cel-txt">
                    <div className="ui-cel-titulo">{c.nome}</div>
                    <div className="ui-cel-sub">{c.cargo}{c.atrasadas > 0 && <span style={{ color: '#c0392b', fontWeight: 600 }}> · {c.atrasadas} atrasada{c.atrasadas > 1 ? 's' : ''}</span>}</div>
                  </div>
                </div>
              ) },
            { id: 'taxa', titulo: 'Conclusão', alinhar: 'dir', largura: '140px', ordenar: (a, b) => (taxaDe(a) ?? -1) - (taxaDe(b) ?? -1), celula: c => <Taxa c={c} /> },
            { id: 'real', titulo: 'Realizadas', alinhar: 'dir', ordenar: (a, b) => a.realizadas - b.realizadas, celula: c => <span className="ui-cel-num ui-cel-forte">{c.realizadas}</span> },
            { id: 'agend', titulo: 'Agendadas', alinhar: 'dir', ocultar: 'celular', ordenar: (a, b) => a.agendadas - b.agendadas, celula: c => <span className="ui-cel-num">{c.agendadas}</span> },
            { id: 'cli', titulo: 'Clientes', alinhar: 'dir', ocultar: 'tablet', ordenar: (a, b) => a.clientes - b.clientes, celula: c => <span className="ui-cel-num">{c.clientes}</span> },
            { id: 'km', titulo: 'KM', alinhar: 'dir', ocultar: 'tablet', ordenar: (a, b) => a.km - b.km, celula: c => <span className="ui-cel-num">{c.km.toLocaleString('pt-BR')}</span> },
            { id: 'prox', titulo: 'Próxima visita', ocultar: 'tablet', ordenar: (a, b) => (a.proxima ?? '9').localeCompare(b.proxima ?? '9'),
              celula: c => c.proxima ? <span className="ui-cel-num" style={{ color: '#E67E22', fontWeight: 600 }}>{fmt(c.proxima)}</span> : <span className="ui-cel-mudo">Nada agendado</span> },
            { id: 'ult', titulo: 'Última atividade', ocultar: 'tablet', ordenar: (a, b) => (a.ultimaAtividade ?? '').localeCompare(b.ultimaAtividade ?? ''),
              celula: c => <span className="ui-cel-num">{c.ultimaAtividade ? fmt(c.ultimaAtividade) : '—'}</span> },
          ]}
        />
      )}
    </>
  )
}

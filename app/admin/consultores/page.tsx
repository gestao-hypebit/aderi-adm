import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { calcRange } from '@/lib/dateUtils'

type Perfil = { id: string; nome_completo: string | null; cargo: string | null; role: string; ativo: boolean | null; created_at: string | null }

type Resumo = {
  realizadas: number
  agendadas: number
  canceladas: number
  clientes: Set<string>
  km: number
  proxima: string | null
  ultimaAtividade: string | null
}

function IconPlus() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function IconCalendar() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function IconUsers() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}

const fmt = (d: string) => new Date(d + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '').replace(' de ', ' ')

export default async function AdminConsultoresPage() {
  const supabase = await createClient()
  const { inicio, fim } = calcRange('este-mes')
  const hoje = new Date().toISOString().slice(0, 10)

  const [{ data: perfis }, { data: visitasMes }, { data: proximas }, { data: kms }, { data: recentes }, { data: atrasadas }] = await Promise.all([
    supabase.from('profiles').select('id, nome_completo, cargo, role, ativo, created_at').order('nome_completo'),
    supabase.from('visitas').select('funcionario_id, status, cliente_id').gte('data_visita', inicio).lte('data_visita', fim),
    supabase.from('visitas').select('funcionario_id, data_visita').eq('status', 'agendada').gte('data_visita', hoje).order('data_visita'),
    supabase.from('km_diario').select('funcionario_id, km_inicial, km_final').gte('data', inicio).lte('data', fim),
    supabase.from('visitas').select('funcionario_id, data_visita').lte('data_visita', hoje).order('data_visita', { ascending: false }).limit(500),
    supabase.from('visitas').select('funcionario_id').eq('status', 'agendada').lt('data_visita', hoje),
  ])

  const resumo = new Map<string, Resumo>()
  const get = (id: string) => {
    if (!resumo.has(id)) resumo.set(id, { realizadas: 0, agendadas: 0, canceladas: 0, clientes: new Set(), km: 0, proxima: null, ultimaAtividade: null })
    return resumo.get(id)!
  }

  ;(visitasMes ?? []).forEach((v: any) => {
    const r = get(v.funcionario_id)
    if (v.status === 'realizada') r.realizadas++
    else if (v.status === 'agendada') r.agendadas++
    else if (v.status === 'cancelada') r.canceladas++
    if (v.cliente_id) r.clientes.add(v.cliente_id)
  })
  ;(proximas ?? []).forEach((v: any) => { const r = get(v.funcionario_id); if (!r.proxima) r.proxima = v.data_visita })
  ;(recentes ?? []).forEach((v: any) => { const r = get(v.funcionario_id); if (!r.ultimaAtividade) r.ultimaAtividade = v.data_visita })
  ;(kms ?? []).forEach((k: any) => {
    if (k.km_inicial != null && k.km_final != null) get(k.funcionario_id).km += Number(k.km_final) - Number(k.km_inicial)
  })

  const todos = (perfis ?? []) as Perfil[]
  const consultores = todos.filter(p => p.role !== 'admin' && p.ativo !== false)
  const admins = todos.filter(p => p.role === 'admin' && p.ativo !== false)
  const inativos = todos.filter(p => p.ativo === false)
  const atrasadasPor = new Map<string, number>()
  ;(atrasadas ?? []).forEach((v: any) => atrasadasPor.set(v.funcionario_id, (atrasadasPor.get(v.funcionario_id) ?? 0) + 1))
  const mesNome = new Date().toLocaleDateString('pt-BR', { month: 'long' })

  return (
    <>
      <style>{`
        .co-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:1.1rem;margin-bottom:1.4rem}
        .co-card{padding:1.3rem;display:flex;flex-direction:column;gap:1.05rem;position:relative}
        .co-card-link{position:absolute;inset:0;border-radius:16px;z-index:0}
        .co-card>*:not(.co-card-link){position:relative;z-index:1;pointer-events:none}
        .co-card .co-acoes,.co-card .co-acoes *{pointer-events:auto}
        .co-atrasada{display:inline-flex;align-items:center;gap:.3rem;font-size:.66rem;font-weight:700;color:#c0392b;background:#fdeeec;border-radius:999px;padding:.2rem .55rem;margin-top:.3rem}
        .co-inativo{display:flex;align-items:center;gap:.7rem;padding:.65rem .95rem .65rem .65rem;text-decoration:none;opacity:.75;transition:opacity .15s}
        .co-inativo:hover{opacity:1}
        .co-head{display:flex;align-items:center;gap:.8rem}
        .co-nome{font-size:.98rem;font-weight:700;color:#162a1e}
        .co-cargo{font-size:.7rem;color:#8f978f;margin-top:.15rem}
        .co-taxa{margin-left:auto;text-align:right}
        .co-taxa-num{font-size:1.1rem;font-weight:700;color:#162a1e}
        .co-taxa-label{font-size:.6rem;font-weight:700;color:#8f978f;text-transform:uppercase;letter-spacing:.06em}
        .co-stats{display:grid;grid-template-columns:repeat(4,1fr);background:#faf8f5;border:1px solid #f2efea;border-radius:12px}
        .co-stat{padding:.7rem .4rem;text-align:center;border-right:1px solid #f2efea}
        .co-stat:last-child{border-right:none}
        .co-stat-num{font-size:1rem;font-weight:700;color:#162a1e}
        .co-stat-label{font-size:.58rem;font-weight:700;color:#8f978f;text-transform:uppercase;letter-spacing:.05em;margin-top:.2rem}
        .co-linhas{display:flex;flex-direction:column;gap:.45rem}
        .co-linha{display:flex;justify-content:space-between;gap:.6rem;font-size:.74rem;color:#8f978f}
        .co-linha b{color:#162a1e;font-weight:700}
        .co-acoes{display:flex;gap:.45rem;flex-wrap:wrap;margin-top:auto;padding-top:.2rem}
        .co-acoes .ui-btn{flex:1}
        .co-admins{display:flex;gap:.6rem;flex-wrap:wrap}
        .co-admin{display:flex;align-items:center;gap:.6rem;padding:.65rem .95rem .65rem .65rem;text-decoration:none}
        .co-admin-nome{font-size:.8rem;font-weight:700;color:#162a1e}
        .co-dica{font-size:.72rem;color:#8f978f;margin-top:.8rem;line-height:1.6}
      `}</style>

      <div className="ui-page-header">
        <div>
          <div className="ui-title">Consultores</div>
          <div className="ui-sub">
            {consultores.length} consultor{consultores.length !== 1 ? 'es' : ''} em campo · números de {mesNome}
          </div>
        </div>
        <div className="ui-header-actions">
          <Link href="/admin/agenda" className="ui-btn ui-btn-secondary"><IconCalendar /> Agenda da equipe</Link>
          <Link href="/admin/consultores/novo" className="ui-btn ui-btn-primary"><IconPlus /> Novo consultor</Link>
        </div>
      </div>

      {consultores.length === 0 ? (
        <div className="ui-card" style={{ marginBottom: '1.4rem' }}>
          <div className="ui-empty">
            <div className="ui-empty-icon"><IconUsers /></div>
            <div className="ui-empty-title">Nenhum consultor cadastrado</div>
            <div className="ui-empty-text">Cadastre a equipe de campo para começar a agendar visitas.</div>
            <Link href="/admin/consultores/novo" className="ui-btn ui-btn-secondary ui-btn-sm"><IconPlus /> Novo consultor</Link>
          </div>
        </div>
      ) : (
        <div className="co-grid">
          {consultores.map(p => {
            const r = resumo.get(p.id)
            const nome = p.nome_completo || 'Sem nome'
            const total = (r?.realizadas ?? 0) + (r?.agendadas ?? 0)
            const taxa = total > 0 ? Math.round(((r?.realizadas ?? 0) / total) * 100) : 0
            return (
              <div key={p.id} className="ui-card ui-card-hover co-card">
                <Link href={`/admin/consultores/${p.id}`} className="co-card-link" aria-label={`Abrir ficha de ${nome}`} />
                <div className="co-head">
                  <div className="ui-avatar ui-avatar-lg">{nome.charAt(0).toUpperCase()}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="co-nome">{nome}</div>
                    <div className="co-cargo">{p.cargo || 'Consultor de campo'}</div>
                    {(atrasadasPor.get(p.id) ?? 0) > 0 && <span className="co-atrasada">{atrasadasPor.get(p.id)} atrasada{atrasadasPor.get(p.id)! > 1 ? 's' : ''}</span>}
                  </div>
                  <div className="co-taxa">
                    <div className="co-taxa-num" style={{ color: total === 0 ? '#b8bdb6' : taxa >= 70 ? '#27ae60' : '#E67E22' }}>{total === 0 ? '—' : `${taxa}%`}</div>
                    <div className="co-taxa-label">Conclusão</div>
                  </div>
                </div>

                <div className="ui-progress">
                  <span style={{ width: `${taxa}%`, background: taxa >= 70 ? '#27ae60' : '#E67E22' }} />
                </div>

                <div className="co-stats">
                  <div className="co-stat"><div className="co-stat-num">{r?.realizadas ?? 0}</div><div className="co-stat-label">Realizadas</div></div>
                  <div className="co-stat"><div className="co-stat-num">{r?.agendadas ?? 0}</div><div className="co-stat-label">Agendadas</div></div>
                  <div className="co-stat"><div className="co-stat-num">{r?.clientes.size ?? 0}</div><div className="co-stat-label">Clientes</div></div>
                  <div className="co-stat"><div className="co-stat-num">{(r?.km ?? 0).toLocaleString('pt-BR')}</div><div className="co-stat-label">KM</div></div>
                </div>

                <div className="co-linhas">
                  <div className="co-linha"><span>Próxima visita</span><b style={{ color: r?.proxima ? '#E67E22' : '#b8bdb6' }}>{r?.proxima ? fmt(r.proxima) : 'Nada agendado'}</b></div>
                  <div className="co-linha"><span>Última atividade</span><b>{r?.ultimaAtividade ? fmt(r.ultimaAtividade) : '—'}</b></div>
                </div>

                <div className="co-acoes">
                  <Link href={`/admin/agenda?func=${p.id}`} className="ui-btn ui-btn-secondary ui-btn-sm"><IconCalendar /> Agenda</Link>
                  <Link href={`/admin/consultores/${p.id}`} className="ui-btn ui-btn-ghost ui-btn-sm">Ficha</Link>
                  <Link href={`/admin/visitas/novo?funcionario=${p.id}`} className="ui-btn ui-btn-dark ui-btn-sm"><IconPlus /> Agendar</Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {admins.length > 0 && (
        <>
          <div className="ui-section-label">Administradores</div>
          <div className="co-admins">
            {admins.map(a => (
              <Link key={a.id} href={`/admin/consultores/${a.id}`} className="ui-card ui-card-hover co-admin">
                <div className="ui-avatar" style={{ background: '#E67E22' }}>{(a.nome_completo || 'A').charAt(0).toUpperCase()}</div>
                <div>
                  <div className="co-admin-nome">{a.nome_completo || 'Sem nome'}</div>
                  <span className="ui-badge ui-badge-agendada" style={{ marginTop: '.25rem' }}>Administrador</span>
                </div>
              </Link>
            ))}
          </div>
          <div className="co-dica">
            Para promover alguém a administrador, abra a ficha da pessoa e clique em <b>Editar</b>.
          </div>
        </>
      )}

      {inativos.length > 0 && (
        <>
          <div className="ui-section-label">Acesso desativado · {inativos.length}</div>
          <div className="co-admins">
            {inativos.map(a => (
              <Link key={a.id} href={`/admin/consultores/${a.id}`} className="ui-card co-inativo">
                <div className="ui-avatar" style={{ background: '#b8bdb6' }}>{(a.nome_completo || '?').charAt(0).toUpperCase()}</div>
                <div>
                  <div className="co-admin-nome">{a.nome_completo || 'Sem nome'}</div>
                  <span className="ui-badge ui-badge-cancelada" style={{ marginTop: '.25rem' }}>Desativado</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  )
}

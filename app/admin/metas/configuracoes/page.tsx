'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import NumInput from '@/app/components/cotacoes/NumInput'
import { carregarCadastros, type Consultor, type DadosCadastro, type Grupo, type Unidade } from '@/lib/metas/cadastros'

function IconArrowLeft() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
}

type Perfil = { id: string; nome_completo: string | null }

export default function ConfiguracoesMetasPage() {
  const supabase = createClient()
  const [dados, setDados] = useState<DadosCadastro | null>(null) // null até carregar
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [params, setParams] = useState({ juros: 0, imposto: 0, fator: 0, amarelo: 0, verde: 0 })
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [consultores, setConsultores] = useState<Consultor[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [salvando, setSalvando] = useState('')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    carregarCadastros(supabase).then(d => {
      setDados(d)
      setParams({ juros: d.config.taxa_juros_mensal, imposto: d.config.aliquota_imposto, fator: d.config.fator_comissao, amarelo: d.config.limite_amarelo, verde: d.config.limite_verde })
      setGrupos(d.grupos); setConsultores(d.consultores); setUnidades(d.unidades)
    }).catch(() => setErro('Não foi possível carregar as configurações.'))
    supabase.from('profiles').select('id, nome_completo').order('nome_completo').then(({ data }) => setPerfis(data ?? []))
  }, [versao])

  async function executar(secao: string, fn: () => PromiseLike<{ error: { message: string } | null }[]>) {
    setSalvando(secao); setErro(''); setOk('')
    const rs = await fn()
    setSalvando('')
    const e = rs.find(r => r.error)?.error
    if (e) { setErro(`Erro ao salvar: ${e.message}`); return }
    setOk('Salvo.')
    setVersao(v => v + 1)
  }

  const salvarParametros = () => {
    if (params.amarelo >= params.verde) { setErro('O limite do amarelo precisa ser menor que o do verde.'); return }
    executar('params', async () => [await supabase.from('configuracoes').update({
      meta_juros_mes: params.juros, meta_aliquota_imposto: params.imposto, meta_fator_comissao: params.fator,
      meta_limite_amarelo: params.amarelo, meta_limite_verde: params.verde, updated_at: new Date().toISOString(),
    }).eq('id', 1)])
  }

  const salvarGrupos = () => {
    if (grupos.some(g => !g.nome.trim())) { setErro('Todo grupo precisa de nome.'); return }
    executar('grupos', () => Promise.all(grupos.map(g => g.id > 0
      ? supabase.from('grupos_produto').update({ nome: g.nome.trim(), descricao: g.descricao?.trim() || null, ordem: g.ordem, ativo: g.ativo }).eq('id', g.id)
      : supabase.from('grupos_produto').insert({ nome: g.nome.trim(), descricao: g.descricao?.trim() || null, ordem: g.ordem, ativo: g.ativo }))))
  }

  const salvarConsultores = () => {
    if (consultores.some(c => !c.nome.trim())) { setErro('Todo consultor precisa de nome.'); return }
    const vinculos = consultores.map(c => c.profile_id).filter(Boolean)
    if (new Set(vinculos).size !== vinculos.length) { setErro('O mesmo usuário está ligado a dois consultores.'); return }
    executar('consultores', () => Promise.all(consultores.map(c => {
      const linha = { nome: c.nome.trim(), unidade_id: c.unidade_id, ativo: c.ativo, profile_id: c.profile_id || null }
      return c.id.startsWith('novo-') ? supabase.from('consultores_comerciais').insert(linha) : supabase.from('consultores_comerciais').update(linha).eq('id', c.id)
    })))
  }

  const salvarUnidades = () => {
    if (unidades.some(u => !u.nome.trim())) { setErro('Toda unidade precisa de nome.'); return }
    executar('unidades', () => Promise.all(unidades.map(u => supabase.from('unidades_negocio').update({ nome: u.nome.trim(), ativo: u.ativo }).eq('id', u.id))))
  }

  if (!dados) return erro ? <div className="ui-alert ui-alert-erro">{erro}</div> : <div className="ui-skeleton" style={{ height: 400 }} />

  const campoPct = (rotulo: string, k: keyof typeof params, dica: string) => (
    <div className="ui-field">
      <label className="ui-label">{rotulo}</label>
      <NumInput pct casas={2} valor={params[k]} onChange={n => setParams(p => ({ ...p, [k]: n }))} />
      <div className="ui-hint">{dica}</div>
    </div>
  )

  return (
    <>
      <style>{`
        .cf-tab{width:100%;border-collapse:collapse;font-size:.78rem}
        .cf-tab th{font-size:.62rem;font-weight:600;color:#8f978f;text-transform:uppercase;letter-spacing:.06em;padding:.45rem .4rem;text-align:left}
        .cf-tab td{padding:.3rem .4rem;border-top:1px solid #f7f5f1;vertical-align:middle}
        .cf-acoes{display:flex;justify-content:space-between;gap:.5rem;margin-top:.8rem}
      `}</style>

      <div className="ui-breadcrumb">
        <Link href="/admin/metas"><IconArrowLeft /> Painel de metas</Link>
        <span className="ui-breadcrumb-sep">/</span>
        <span className="ui-breadcrumb-atual">Configurações</span>
      </div>
      <div className="ui-page-header">
        <div>
          <div className="ui-title">Configurações de metas</div>
          <div className="ui-sub">Parâmetros de cálculo, faixas de cor e cadastros do módulo.</div>
        </div>
      </div>

      {erro && <div className="ui-alert ui-alert-erro">{erro}</div>}
      {ok && <div className="ui-alert ui-alert-ok">{ok}</div>}

      <div className="ui-card ui-card-pad" style={{ marginBottom: '1.25rem' }}>
        <div className="ui-card-title" style={{ marginBottom: '.3rem' }}>Parâmetros de cálculo da venda</div>
        <div className="ui-hint" style={{ marginBottom: '.9rem' }}>Gravados em cada venda no lançamento ou na importação: mudar aqui não altera vendas já lançadas.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0 1rem' }}>
          {campoPct('Juros ao mês', 'juros', 'Custo financeiro da compra até o recebimento')}
          {campoPct('Alíquota de imposto', 'imposto', 'Sobre o resultado bruto')}
          {campoPct('Fator de comissão', 'fator', '% comissão = margem líquida × fator')}
          {campoPct('Amarelo a partir de', 'amarelo', 'Abaixo disso, vermelho')}
          {campoPct('Verde a partir de', 'verde', 'Meta atingida')}
        </div>
        <div className="cf-acoes" style={{ justifyContent: 'flex-end' }}>
          <button className="ui-btn ui-btn-primary ui-btn-sm" onClick={salvarParametros} disabled={!!salvando}>{salvando === 'params' ? 'Salvando...' : 'Salvar parâmetros'}</button>
        </div>
      </div>

      <div className="ui-card ui-card-pad" style={{ marginBottom: '1.25rem', overflowX: 'auto' }}>
        <div className="ui-card-title" style={{ marginBottom: '.6rem' }}>Grupos de produto</div>
        <table className="cf-tab">
          <thead><tr><th>Nome</th><th>Descrição</th><th style={{ width: 80 }}>Ordem</th><th style={{ width: 70 }}>Ativo</th></tr></thead>
          <tbody>
            {grupos.map((g, i) => (
              <tr key={g.id}>
                <td><input className="ui-input ui-input-sm" value={g.nome} onChange={e => setGrupos(xs => xs.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} /></td>
                <td><input className="ui-input ui-input-sm" value={g.descricao ?? ''} onChange={e => setGrupos(xs => xs.map((x, j) => j === i ? { ...x, descricao: e.target.value } : x))} /></td>
                <td><input type="number" className="ui-input ui-input-sm" value={g.ordem} onChange={e => setGrupos(xs => xs.map((x, j) => j === i ? { ...x, ordem: Number(e.target.value) } : x))} /></td>
                <td><input type="checkbox" checked={g.ativo} onChange={e => setGrupos(xs => xs.map((x, j) => j === i ? { ...x, ativo: e.target.checked } : x))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ui-hint">Grupo com vendas não pode ser excluído; desative para tirar dos formulários.</div>
        <div className="cf-acoes">
          <button className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => setGrupos(xs => [...xs, { id: -Date.now(), nome: '', descricao: null, ordem: xs.length + 1, ativo: true }])}>Adicionar grupo</button>
          <button className="ui-btn ui-btn-primary ui-btn-sm" onClick={salvarGrupos} disabled={!!salvando}>{salvando === 'grupos' ? 'Salvando...' : 'Salvar grupos'}</button>
        </div>
      </div>

      <div className="ui-card ui-card-pad" style={{ marginBottom: '1.25rem', overflowX: 'auto' }}>
        <div className="ui-card-title" style={{ marginBottom: '.3rem' }}>Consultores comerciais</div>
        <div className="ui-hint" style={{ marginBottom: '.6rem' }}>A unidade do consultor é gravada em cada venda: trocar aqui não muda vendas antigas.</div>
        <table className="cf-tab">
          <thead><tr><th>Nome</th><th>Unidade</th><th>Usuário do sistema</th><th style={{ width: 70 }}>Ativo</th></tr></thead>
          <tbody>
            {consultores.map((c, i) => (
              <tr key={c.id}>
                <td><input className="ui-input ui-input-sm" value={c.nome} onChange={e => setConsultores(xs => xs.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} /></td>
                <td>
                  <select className="ui-select ui-select-sm" value={c.unidade_id} onChange={e => setConsultores(xs => xs.map((x, j) => j === i ? { ...x, unidade_id: Number(e.target.value) } : x))}>
                    {unidades.map(u => <option key={u.id} value={u.id}>{u.codigo} · {u.nome}</option>)}
                  </select>
                </td>
                <td>
                  <select className="ui-select ui-select-sm" value={c.profile_id ?? ''} onChange={e => setConsultores(xs => xs.map((x, j) => j === i ? { ...x, profile_id: e.target.value || null } : x))}>
                    <option value="">Sem usuário</option>
                    {perfis.map(p => <option key={p.id} value={p.id}>{p.nome_completo ?? p.id}</option>)}
                  </select>
                </td>
                <td><input type="checkbox" checked={c.ativo} onChange={e => setConsultores(xs => xs.map((x, j) => j === i ? { ...x, ativo: e.target.checked } : x))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ui-hint">{/* TODO(cliente): Fabrício é consultor da unidade IV ou unidade própria com meta? */}Fabrício está na unidade IV, como nas planilhas (a confirmar com o cliente).</div>
        <div className="cf-acoes">
          <button className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => setConsultores(xs => [...xs, { id: `novo-${Date.now()}`, nome: '', unidade_id: unidades[0]?.id ?? 1, ativo: true, profile_id: null }])}>Adicionar consultor</button>
          <button className="ui-btn ui-btn-primary ui-btn-sm" onClick={salvarConsultores} disabled={!!salvando}>{salvando === 'consultores' ? 'Salvando...' : 'Salvar consultores'}</button>
        </div>
      </div>

      <div className="ui-card ui-card-pad" style={{ overflowX: 'auto' }}>
        <div className="ui-card-title" style={{ marginBottom: '.6rem' }}>Unidades de negócio</div>
        <table className="cf-tab">
          <thead><tr><th style={{ width: 70 }}>Código</th><th>Nome</th><th style={{ width: 70 }}>Ativa</th></tr></thead>
          <tbody>
            {unidades.map((u, i) => (
              <tr key={u.id}>
                <td>{u.codigo}</td>
                <td><input className="ui-input ui-input-sm" value={u.nome} onChange={e => setUnidades(xs => xs.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} /></td>
                <td><input type="checkbox" checked={u.ativo} onChange={e => setUnidades(xs => xs.map((x, j) => j === i ? { ...x, ativo: e.target.checked } : x))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="cf-acoes" style={{ justifyContent: 'flex-end' }}>
          <button className="ui-btn ui-btn-primary ui-btn-sm" onClick={salvarUnidades} disabled={!!salvando}>{salvando === 'unidades' ? 'Salvando...' : 'Salvar unidades'}</button>
        </div>
      </div>
    </>
  )
}

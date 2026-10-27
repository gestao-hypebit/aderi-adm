'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ConfirmDialog from '@/app/admin/_ui/ConfirmDialog'
import NumInput from '@/app/components/cotacoes/NumInput'
import { brl } from '@/lib/cotacao'
import { carregarCadastros, type DadosCadastro } from '@/lib/metas/cadastros'
import { MESES_CURTOS } from '@/lib/metas/vendas'

// Grade grupos × meses por unidade. A meta anual é a soma dos 12 meses (não é digitada).
// A mesma grade guarda o realizado de anos anteriores (totais mensais, sem venda linha a linha).
type Tabela = 'metas' | 'realizado_historico'
type Grade = Record<string, number> // `${grupo}-${mes}` → valor

function IconArrowLeft() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
}

const anoAtual = Number(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 4))

export default function CadastroMetasPage() {
  const supabase = createClient()
  const [dados, setDados] = useState<DadosCadastro | null>(null)
  const [tabela, setTabela] = useState<Tabela>('metas')
  const [ano, setAno] = useState(anoAtual)
  const [unidade, setUnidade] = useState(1)
  const [grade, setGrade] = useState<Grade>({})
  const [original, setOriginal] = useState<Grade>({})
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [copiar, setCopiar] = useState<{ de: number; para: number } | null>(null)
  const [copiando, setCopiando] = useState(false)
  const [versao, setVersao] = useState(0)

  useEffect(() => { carregarCadastros(supabase).then(setDados).catch(() => setErro('Não foi possível carregar os cadastros.')) }, [])

  useEffect(() => {
    let vivo = true
    supabase.from(tabela).select('grupo_id, mes, valor').eq('ano', ano).eq('unidade_id', unidade).then(({ data, error }) => {
      if (!vivo) return
      if (error) { setErro('Não foi possível carregar os valores.'); return }
      const g: Grade = {}
      for (const r of data ?? []) g[`${r.grupo_id}-${r.mes}`] = Number(r.valor)
      setGrade(g); setOriginal(g); setCarregando(false)
    })
    return () => { vivo = false }
  }, [tabela, ano, unidade, versao])

  const grupos = (dados?.grupos ?? []).filter(g => g.ativo || Object.keys(grade).some(k => k.startsWith(`${g.id}-`) && grade[k]))
  const v = (g: number, m: number) => grade[`${g}-${m}`] ?? 0
  const totalLinha = (g: number) => MESES_CURTOS.reduce((s, _, i) => s + v(g, i + 1), 0)
  const totalColuna = (m: number) => grupos.reduce((s, g) => s + v(g.id, m), 0)
  const totalUnidade = grupos.reduce((s, g) => s + totalLinha(g.id), 0)
  const alterado = useMemo(() => Object.keys({ ...grade, ...original }).some(k => (grade[k] ?? 0) !== (original[k] ?? 0)), [grade, original])

  function trocar(acao: () => void, mudou = true) {
    if (!mudou) return
    if (alterado && !window.confirm('Há alterações não salvas. Descartar?')) return
    setOk(''); setErro(''); setCarregando(true)
    acao()
  }

  async function salvar() {
    setSalvando(true); setErro(''); setOk('')
    const linhas = grupos.flatMap(g => MESES_CURTOS.map((_, i) => ({ ano, unidade_id: unidade, grupo_id: g.id, mes: i + 1, valor: v(g.id, i + 1), updated_at: new Date().toISOString() })))
    const { error } = await supabase.from(tabela).upsert(linhas, { onConflict: 'ano,unidade_id,grupo_id,mes' })
    setSalvando(false)
    if (error) { setErro(`Erro ao salvar: ${error.message}`); return }
    setOriginal(grade)
    setOk('Salvo.')
  }

  // Copia todas as unidades de um ano para outro (sobrescreve o destino)
  async function executarCopia() {
    if (!copiar) return
    setCopiando(true); setErro(''); setOk('')
    const { data, error } = await supabase.from(tabela).select('unidade_id, grupo_id, mes, valor').eq('ano', copiar.de)
    if (error || !data?.length) { setCopiando(false); setCopiar(null); setErro(error ? 'Não foi possível ler o ano de origem.' : `Não há valores em ${copiar.de}.`); return }
    const { error: e2 } = await supabase.from(tabela).upsert(
      data.map(r => ({ ...r, ano: copiar.para, updated_at: new Date().toISOString() })), { onConflict: 'ano,unidade_id,grupo_id,mes' })
    setCopiando(false)
    const { de, para: destino } = copiar
    setCopiar(null)
    if (e2) { setErro(`Erro ao copiar: ${e2.message}`); return }
    setOk(`Copiado de ${de} para ${destino} (todas as unidades).`)
    setCarregando(true)
    setAno(destino)
    setVersao(x => x + 1)
  }

  const unidadeAtual = dados?.unidades.find(u => u.id === unidade)

  return (
    <>
      <style>{`
        .mg-tab{width:100%;border-collapse:collapse;font-size:.76rem}
        .mg-tab th{font-size:.62rem;font-weight:600;color:#8f978f;text-transform:uppercase;letter-spacing:.06em;padding:.5rem .3rem;text-align:right;white-space:nowrap}
        .mg-tab th:first-child,.mg-tab td:first-child{text-align:left;position:sticky;left:0;background:var(--superficie);z-index:1;min-width:130px}
        .mg-tab td{padding:.25rem .2rem;border-top:1px solid #f7f5f1;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
        .mg-tab td .ui-input{min-width:96px;text-align:right;padding:.35rem .45rem;font-size:.76rem}
        .mg-tab tfoot td,.mg-tab .mg-total{font-weight:600}
        .mg-tab tfoot td{border-top:1px solid #eae5de;padding:.55rem .3rem}
      `}</style>

      <div className="ui-breadcrumb">
        <Link href="/admin/metas"><IconArrowLeft /> Painel de metas</Link>
        <span className="ui-breadcrumb-sep">/</span>
        <span className="ui-breadcrumb-atual">Cadastro</span>
      </div>

      <div className="ui-page-header">
        <div>
          <div className="ui-title">{tabela === 'metas' ? 'Metas' : 'Realizado de anos anteriores'}</div>
          <div className="ui-sub">{tabela === 'metas' ? 'Meta mensal por grupo. A meta do ano é a soma dos meses.' : 'Totais mensais por grupo, usados na comparação com o ano anterior.'}</div>
        </div>
        <div className="ui-header-actions">
          <div className="ui-segmented">
            <button type="button" className={tabela === 'metas' ? 'ativo' : ''} onClick={() => trocar(() => setTabela('metas'), tabela !== 'metas')}>Metas</button>
            <button type="button" className={tabela === 'realizado_historico' ? 'ativo' : ''} onClick={() => trocar(() => setTabela('realizado_historico'), tabela !== 'realizado_historico')}>Realizado anterior</button>
          </div>
        </div>
      </div>

      {erro && <div className="ui-alert ui-alert-erro">{erro}</div>}
      {ok && <div className="ui-alert ui-alert-ok">{ok}</div>}

      <div className="ui-card ui-card-pad" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="ui-field" style={{ marginBottom: 0 }}>
          <label className="ui-label">Ano</label>
          <input type="number" className="ui-input ui-input-sm" style={{ width: 110 }} value={ano} onChange={e => { const a = Number(e.target.value); if (a > 2000 && a < 2100) trocar(() => setAno(a), a !== ano) }} />
        </div>
        <div className="ui-segmented" role="tablist" aria-label="Unidade">
          {dados?.unidades.map(u => (
            <button key={u.id} type="button" className={u.id === unidade ? 'ativo' : ''} onClick={() => trocar(() => setUnidade(u.id), u.id !== unidade)}>{u.codigo} · {u.nome}</button>
          ))}
        </div>
        <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setCopiar({ de: ano - 1, para: ano })}>Copiar de outro ano</button>
      </div>

      <div className="ui-card" style={{ overflowX: 'auto', padding: '.4rem .8rem' }}>
        {carregando ? <div className="ui-skeleton" style={{ height: 260 }} /> : (
          <table className="mg-tab">
            <thead>
              <tr><th>Grupo</th>{MESES_CURTOS.map(m => <th key={m}>{m}</th>)}<th>Total</th></tr>
            </thead>
            <tbody>
              {grupos.map(g => (
                <tr key={g.id}>
                  <td>{g.nome}</td>
                  {MESES_CURTOS.map((_, i) => (
                    <td key={i}>
                      <NumInput valor={v(g.id, i + 1)} casas={2} ariaLabel={`${g.nome} ${MESES_CURTOS[i]}`} onChange={n => { setGrade(x => ({ ...x, [`${g.id}-${i + 1}`]: n })); setOk('') }} />
                    </td>
                  ))}
                  <td className="mg-total">{brl(totalLinha(g.id))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td>Total {unidadeAtual?.codigo}</td>{MESES_CURTOS.map((_, i) => <td key={i}>{brl(totalColuna(i + 1))}</td>)}<td>{brl(totalUnidade)}</td></tr>
            </tfoot>
          </table>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem', marginTop: '1rem' }}>
        {alterado && <button className="ui-btn ui-btn-ghost" onClick={() => setGrade(original)} disabled={salvando}>Desfazer</button>}
        <button className="ui-btn ui-btn-primary" onClick={salvar} disabled={salvando || !alterado}>{salvando ? 'Salvando...' : `Salvar ${unidadeAtual?.codigo ?? ''} · ${ano}`}</button>
      </div>

      <ConfirmDialog
        aberto={!!copiar}
        titulo={`Copiar ${tabela === 'metas' ? 'metas' : 'realizado'} de outro ano`}
        confirmarTexto="Copiar"
        carregando={copiando}
        onConfirmar={executarCopia}
        onCancelar={() => setCopiar(null)}
      >
        {copiar && (
          <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            De
            <input type="number" className="ui-input ui-input-sm" style={{ width: 100 }} value={copiar.de} onChange={e => setCopiar({ ...copiar, de: Number(e.target.value) })} />
            para
            <input type="number" className="ui-input ui-input-sm" style={{ width: 100 }} value={copiar.para} onChange={e => setCopiar({ ...copiar, para: Number(e.target.value) })} />
            <div className="ui-hint" style={{ width: '100%' }}>Copia todas as unidades e grupos. Os valores que já existirem no ano de destino são substituídos.</div>
          </div>
        )}
      </ConfirmDialog>
    </>
  )
}

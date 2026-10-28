'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Tabela from '@/app/components/Tabela'
import { brl } from '@/lib/cotacao'
import { dataBR } from '@/lib/csv'
import { carregarCadastros, cadastrosImportacao, type DadosCadastro } from '@/lib/metas/cadastros'
import { MODALIDADES, TIPOS, type TipoMapeamento } from '@/lib/metas/nomes'
import { LAYOUTS, lerWorkbook } from '@/lib/metas/importacao/planilhaAd'
import { chaveDuplicidade, conciliar, resolverLeitura, type LinhaValida } from '@/lib/metas/importacao/resolver'
import { decodificarCsv, lerEdpe, type LeituraErp } from '@/lib/metas/importacao/erpEdpe'
import { Kpi } from '../Comum'
import ImportarErp from './ImportarErp'
import type { LeituraPlanilha } from '@/lib/metas/importacao/tipos'

type Historico = { id: string; arquivo: string; created_at: string; linhas_importadas: number; linhas_ignoradas: number; relatorio: { conciliacao?: { total_planilha: number | null; importado: number; diferenca: number | null } } | null }

const ROTULO_TIPO: Record<TipoMapeamento, string> = { consultor: 'Consultor', grupo: 'Grupo', modalidade: 'Modalidade', tipo: 'D/C', vendedor: 'Vendedor (ERP)' }

function IconArrowLeft() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
}
function IconUpload() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
}

const lote = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))

export default function ImportarVendasPage() {
  const supabase = createClient()
  const [dados, setDados] = useState<DadosCadastro | null>(null)
  const [layoutId, setLayoutId] = useState(LAYOUTS[0].id)
  const [leitura, setLeitura] = useState<LeituraPlanilha | null>(null)
  const [leituraErp, setLeituraErp] = useState<LeituraErp | null>(null)
  const [competencia, setCompetencia] = useState('') // AAAA-MM
  const [lendo, setLendo] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [mapear, setMapear] = useState<Record<string, string>>({})
  const [duplicadasBanco, setDuplicadasBanco] = useState<Set<string>>(new Set())
  const [pularDuplicadas, setPularDuplicadas] = useState(true)
  const [gravando, setGravando] = useState(false)
  const [historico, setHistorico] = useState<Historico[]>([])
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    carregarCadastros(supabase).then(setDados).catch(() => setErro('Não foi possível carregar os cadastros de metas.'))
    supabase.from('importacoes').select('id, arquivo, created_at, linhas_importadas, linhas_ignoradas, relatorio').order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => setHistorico((data ?? []) as Historico[]))
  }, [versao])

  const res = useMemo(() => {
    if (!leitura || !dados) return null
    return resolverLeitura(leitura, cadastrosImportacao(dados), dados.config, competencia ? competencia + '-01' : null)
  }, [leitura, dados, competencia])
  const conc = useMemo(() => (leitura && res ? conciliar(leitura, res) : null), [leitura, res])

  // Duplicidade com o que já está gravado (DAV + produto + quantidade + valor)
  useEffect(() => {
    if (!res) return
    const davs = [...new Set(res.validas.map(v => v.venda.dav).filter((d): d is string => !!d))]
    Promise.all(lote(davs, 150).map(ds => supabase.from('vendas').select('dav, produto, quantidade, preco_unitario').in('dav', ds)))
      .then(rs => setDuplicadasBanco(new Set(rs.flatMap(r => (r.data ?? []).map(v => chaveDuplicidade({ ...v, quantidade: Number(v.quantidade), preco_unitario: Number(v.preco_unitario) }))))))
  }, [res])

  const ehDuplicada = (v: LinhaValida) => duplicadasBanco.has(chaveDuplicidade(v.venda))
  const aGravar = res ? res.validas.filter(v => !(pularDuplicadas && ehDuplicada(v))) : []
  const nomeConsultor = (id: string) => dados?.consultores.find(c => c.id === id)?.nome ?? id
  const nomeGrupo = (id: number) => dados?.grupos.find(g => g.id === id)?.nome ?? id

  async function abrirArquivo(f: File) {
    setErro(''); setOk(''); setLeitura(null); setLeituraErp(null); setMapear({}); setLendo(true)
    try {
      if (/\.csv$/i.test(f.name)) {
        const l = lerEdpe(decodificarCsv(await f.arrayBuffer()), f.name)
        if (!l.pedidos.length) throw new Error('Nenhum pedido encontrado. O CSV deve ser o relatório EDPE010 do ERP (pedido em uma linha, itens nas linhas de baixo).')
        setLeituraErp(l)
        setLendo(false)
        return
      }
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(await f.arrayBuffer())
      const l = lerWorkbook(wb, f.name, layoutId)
      if (!l.linhas.length) throw new Error('Nenhuma linha de venda encontrada. Confira se a aba tem a linha de cabeçalho com "Data:" na coluna A.')
      setLeitura(l)
      setCompetencia(l.competencia?.slice(0, 7) ?? '')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível ler o arquivo.')
    }
    setLendo(false)
  }

  async function salvarMapeamentos() {
    const linhas = Object.entries(mapear).filter(([, v]) => v).map(([k, valor]) => {
      const [tipo, texto_original] = k.split('|')
      return { tipo, texto_original, valor }
    })
    if (!linhas.length) return
    const { error } = await supabase.from('mapeamento_nomes').upsert(linhas, { onConflict: 'tipo,texto_original' })
    if (error) { setErro('Não foi possível salvar os mapeamentos.'); return }
    setMapear({})
    setDados(await carregarCadastros(supabase))
  }

  async function gravar() {
    if (!leitura || !res || !conc || !aGravar.length) return
    setGravando(true); setErro(''); setOk('')
    const relatorio = {
      conciliacao: conc,
      competencia: competencia || null,
      taxa_juros_mensal: leitura.taxa_juros_mensal,
      totais_planilha: leitura.totais,
      erros: res.com_erro.map(e => ({ linha: e.lida.linha, erros: e.erros, produto: e.lida.produto, faturamento: e.lida.faturamento })),
      ignoradas: res.ignoradas.map(l => ({ linha: l.linha, motivo: l.ignorada, data: l.data_bruta, faturamento: l.faturamento })),
      duplicadas_puladas: res.validas.filter(v => pularDuplicadas && ehDuplicada(v)).map(v => v.venda.linha_origem),
      toneladas_nao_inferidas: res.validas.filter(v => v.toneladas_origem == null && v.toneladas_motivo).map(v => ({ linha: v.venda.linha_origem, produto: v.venda.produto, motivo: v.toneladas_motivo })),
    }
    const { data: imp, error } = await supabase.from('importacoes').insert({
      layout: layoutId, arquivo: leitura.arquivo, linhas_lidas: leitura.linhas.length,
      linhas_importadas: aGravar.length, linhas_ignoradas: leitura.linhas.length - aGravar.length, relatorio,
    }).select('id').single()
    if (error || !imp) { setGravando(false); setErro('Não foi possível registrar a importação.'); return }

    for (const parte of lote(aGravar, 500)) {
      const { error: e } = await supabase.from('vendas').insert(parte.map(v => ({ ...v.venda, importacao_id: imp.id })))
      if (e) {
        // desfaz o que entrou: importação é tudo ou nada
        await supabase.from('vendas').delete().eq('importacao_id', imp.id)
        await supabase.from('importacoes').delete().eq('id', imp.id)
        setGravando(false)
        setErro(`Erro ao gravar as vendas; nada foi importado. (${e.message})`)
        return
      }
    }
    setGravando(false)
    setOk(`${aGravar.length} vendas importadas de ${leitura.arquivo}.`)
    setLeitura(null)
    setVersao(v => v + 1)
  }

  const opcoesMapeamento = (tipo: TipoMapeamento) =>
    tipo === 'consultor' ? (dados?.consultores ?? []).filter(c => c.ativo).map(c => ({ valor: c.id, rotulo: c.nome }))
      : tipo === 'grupo' ? (dados?.grupos ?? []).filter(g => g.ativo).map(g => ({ valor: String(g.id), rotulo: g.nome }))
        : tipo === 'modalidade' ? MODALIDADES : TIPOS

  return (
    <>
      <div className="ui-breadcrumb">
        <Link href="/admin/metas/vendas"><IconArrowLeft /> Vendas</Link>
        <span className="ui-breadcrumb-sep">/</span>
        <span className="ui-breadcrumb-atual">Importar</span>
      </div>

      <div className="ui-page-header">
        <div>
          <div className="ui-title">Importar vendas</div>
          <div className="ui-sub">Relatório do ERP (EDPE010, .csv) ou planilha mensal AD (.xlsx). Confira a prévia antes de gravar.</div>
        </div>
      </div>

      {erro && <div className="ui-alert ui-alert-erro">{erro}</div>}
      {ok && <div className="ui-alert ui-alert-ok">{ok}</div>}

      <div className="ui-card ui-card-pad" style={{ marginBottom: '1.25rem' }}>
        <div className="ui-grid-2">
          <div className="ui-field">
            <label className="ui-label">Layout da planilha (.xlsx)</label>
            <select className="ui-select" value={layoutId} onChange={e => setLayoutId(e.target.value)}>
              {LAYOUTS.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </div>
          <div className="ui-field">
            <label className="ui-label">Arquivo (.csv do ERP ou .xlsx)</label>
            <label className="ui-btn ui-btn-secondary" style={{ cursor: 'pointer', justifyContent: 'center' }}>
              <IconUpload /> {lendo ? 'Lendo...' : 'Escolher arquivo'}
              <input type="file" accept=".xlsx,.csv" hidden disabled={lendo || !dados} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) abrirArquivo(f) }} />
            </label>
          </div>
        </div>
        <div className="ui-hint">
          O relatório do ERP preenche data, DAV, cliente, produto, quantidade e preço, e sugere consultor, grupo e D/C pelo histórico.
          As vendas entram &quot;a completar&quot; e você termina (custo, frete, datas) na tela de <Link href="/admin/metas/lancamentos">Lançamentos</Link>.
        </div>
      </div>

      {leituraErp && dados && (
        <ImportarErp
          leitura={leituraErp}
          dados={dados}
          onCancelar={() => setLeituraErp(null)}
          onRecarregarCadastros={async () => setDados(await carregarCadastros(supabase))}
        />
      )}

      {leitura && res && conc && (
        <>
          <div className="ui-card ui-card-pad" style={{ marginBottom: '1.25rem' }}>
            <div className="ui-grid-2">
              <div className="ui-field">
                <label className="ui-label">Mês de referência</label>
                <input type="month" className="ui-input" value={competencia} onChange={e => setCompetencia(e.target.value)} />
                <div className="ui-hint">É nele que as vendas somam no painel, mesmo com data de outro mês (como na planilha). Lido de &quot;REF. MÊS&quot;.</div>
              </div>
              <div className="ui-field">
                <label className="ui-label">Arquivo</label>
                <div>{leitura.arquivo} · aba {leitura.aba} · juros {leitura.taxa_juros_mensal != null ? `${(leitura.taxa_juros_mensal * 100).toLocaleString('pt-BR')}% a.m.` : 'padrão'}</div>
              </div>
            </div>
          </div>

          <div className="ui-kpis">
            <Kpi rotulo="Vendas válidas" valor={String(res.validas.length)} sub={brl(conc.importado)} />
            <Kpi rotulo="Total da planilha" valor={conc.total_planilha != null ? brl(conc.total_planilha) : '—'} sub={conc.diferenca != null ? `diferença ${brl(conc.diferenca)}` : 'total não encontrado'} />
            <Kpi rotulo="Com erro" valor={String(res.com_erro.length)} sub="não serão importadas" />
            <Kpi rotulo="Ignoradas" valor={String(res.ignoradas.length)} sub="canceladas ou sem data" />
            <Kpi rotulo="Já existem" valor={String(res.validas.filter(ehDuplicada).length)} sub="DAV + produto + qtd + valor" />
          </div>

          {conc.nao_explicado != null && Math.abs(conc.nao_explicado) > 0.01 && (
            <div className="ui-alert ui-alert-erro">
              {brl(conc.nao_explicado)} da diferença com o total da planilha não vem das linhas que ficaram de fora. Confira se o total da planilha está atualizado.
            </div>
          )}

          {res.nao_reconhecidos.length > 0 && (
            <div className="ui-card ui-card-pad" style={{ marginBottom: '1.25rem' }}>
              <div className="ui-card-title" style={{ marginBottom: '.75rem' }}>Nomes não reconhecidos</div>
              <div className="ui-hint" style={{ marginBottom: '.75rem' }}>Escolha a que cada nome corresponde. O mapeamento fica salvo para as próximas importações.</div>
              {res.nao_reconhecidos.map(n => {
                const k = `${n.tipo}|${n.texto}`
                return (
                  <div key={k} style={{ display: 'flex', gap: '.75rem', alignItems: 'center', marginBottom: '.5rem', flexWrap: 'wrap' }}>
                    <span className="ui-badge ui-badge-neutro">{ROTULO_TIPO[n.tipo]}</span>
                    <strong style={{ minWidth: 160 }}>&quot;{n.texto}&quot;</strong>
                    <span className="ui-cel-mudo">{n.ocorrencias} linha(s) →</span>
                    <select className="ui-select ui-select-sm" style={{ maxWidth: 240 }} value={mapear[k] ?? ''} onChange={e => setMapear(m => ({ ...m, [k]: e.target.value }))}>
                      <option value="">Não mapear</option>
                      {opcoesMapeamento(n.tipo).map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
                    </select>
                  </div>
                )
              })}
              <button className="ui-btn ui-btn-primary ui-btn-sm" style={{ marginTop: '.5rem' }} disabled={!Object.values(mapear).some(Boolean)} onClick={salvarMapeamentos}>Salvar mapeamentos</button>
            </div>
          )}

          <div className="ui-section-label">Vendas válidas</div>
          <Tabela
            linhas={res.validas}
            chave={v => String(v.venda.linha_origem)}
            rotulo="vendas"
            reiniciar={leitura}
            destaque={ehDuplicada}
            colunas={[
              { id: 'linha', titulo: 'Linha', celula: v => v.venda.linha_origem, alinhar: 'dir', largura: '64px' },
              { id: 'data', titulo: 'Data', celula: v => dataBR(v.venda.data), largura: '96px' },
              { id: 'cliente', titulo: 'Cliente', celula: v => <span className="ui-cel-txt">{v.venda.cliente}</span>, ocultar: 'tablet' },
              { id: 'produto', titulo: 'Produto', celula: v => <span className="ui-cel-txt">{v.venda.produto}</span> },
              { id: 'qtd', titulo: 'Qtd', celula: v => v.venda.quantidade.toLocaleString('pt-BR'), alinhar: 'dir', ocultar: 'celular' },
              { id: 'valor', titulo: 'Faturamento', celula: v => brl(v.venda.faturamento), alinhar: 'dir', ordenar: (a, b) => a.venda.faturamento - b.venda.faturamento },
              { id: 'grupo', titulo: 'Grupo', celula: v => nomeGrupo(v.venda.grupo_id), ocultar: 'celular' },
              { id: 'consultor', titulo: 'Consultor', celula: v => nomeConsultor(v.venda.consultor_id), ocultar: 'celular' },
              { id: 'mod', titulo: 'Mod./Tipo', celula: v => `${v.venda.modalidade === 'VERDE_AGRO' ? 'Verde Agro' : 'Direta'} · ${v.venda.tipo}`, ocultar: 'tablet' },
              { id: 'avisos', titulo: 'Avisos', celula: v => (
                <span className="ui-cel-sub">{[ehDuplicada(v) && 'Já existe no sistema', ...v.avisos].filter(Boolean).join(' · ') || '—'}</span>
              ) },
            ]}
          />

          {res.com_erro.length > 0 && (
            <>
              <div className="ui-section-label" style={{ marginTop: '1.25rem' }}>Linhas com erro (não serão importadas)</div>
              <Tabela
                linhas={res.com_erro}
                chave={e => String(e.lida.linha)}
                rotulo="linhas"
                colunas={[
                  { id: 'linha', titulo: 'Linha', celula: e => e.lida.linha, alinhar: 'dir', largura: '64px' },
                  { id: 'produto', titulo: 'Produto', celula: e => <span className="ui-cel-txt">{e.lida.produto || '—'}</span> },
                  { id: 'valor', titulo: 'Valor', celula: e => (e.lida.faturamento != null ? brl(e.lida.faturamento) : '—'), alinhar: 'dir' },
                  { id: 'erro', titulo: 'Erro', celula: e => e.erros.join('; ') },
                ]}
              />
            </>
          )}

          {conc.fora_com_valor.length > 0 && (
            <>
              <div className="ui-section-label" style={{ marginTop: '1.25rem' }}>Conciliação: linhas da planilha que ficaram de fora</div>
              <Tabela
                linhas={conc.fora_com_valor}
                chave={f => String(f.linha)}
                rotulo="linhas"
                paginar={false}
                colunas={[
                  { id: 'linha', titulo: 'Linha', celula: f => f.linha, alinhar: 'dir', largura: '64px' },
                  { id: 'valor', titulo: 'Valor', celula: f => brl(f.valor), alinhar: 'dir' },
                  { id: 'motivo', titulo: 'Motivo', celula: f => f.motivo },
                ]}
              />
            </>
          )}

          <div className="ui-card ui-card-pad" style={{ marginTop: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
              <input type="checkbox" checked={pularDuplicadas} onChange={e => setPularDuplicadas(e.target.checked)} />
              Não importar as que já existem no sistema
            </label>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <button className="ui-btn ui-btn-ghost" onClick={() => setLeitura(null)} disabled={gravando}>Cancelar</button>
              <button className="ui-btn ui-btn-primary" onClick={gravar} disabled={gravando || !aGravar.length || !competencia}>
                {gravando ? 'Gravando...' : `Importar ${aGravar.length} vendas (${brl(aGravar.reduce((s, v) => s + v.venda.faturamento, 0))})`}
              </button>
            </div>
          </div>
        </>
      )}

      {!leitura && !leituraErp && (
        <>
          <div className="ui-section-label" style={{ marginTop: '.5rem' }}>Importações anteriores</div>
          <Tabela
            linhas={historico}
            chave={h => h.id}
            rotulo="importações"
            paginar={false}
            vazio="Nenhuma importação ainda."
            colunas={[
              { id: 'quando', titulo: 'Quando', celula: h => new Date(h.created_at).toLocaleString('pt-BR'), largura: '160px' },
              { id: 'arquivo', titulo: 'Arquivo', celula: h => <span className="ui-cel-txt">{h.arquivo}</span> },
              { id: 'qtd', titulo: 'Vendas', celula: h => h.linhas_importadas, alinhar: 'dir' },
              { id: 'imp', titulo: 'Importado', celula: h => (h.relatorio?.conciliacao ? brl(h.relatorio.conciliacao.importado) : '—'), alinhar: 'dir', ocultar: 'celular' },
              { id: 'pl', titulo: 'Total planilha', celula: h => (h.relatorio?.conciliacao?.total_planilha != null ? brl(h.relatorio.conciliacao.total_planilha) : '—'), alinhar: 'dir', ocultar: 'tablet' },
              { id: 'dif', titulo: 'Diferença', celula: h => (h.relatorio?.conciliacao?.diferenca != null ? brl(h.relatorio.conciliacao.diferenca) : '—'), alinhar: 'dir' },
            ]}
          />
        </>
      )}
    </>
  )
}

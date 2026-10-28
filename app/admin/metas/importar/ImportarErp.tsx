'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Tabela from '@/app/components/Tabela'
import { brl } from '@/lib/cotacao'
import { dataBR } from '@/lib/csv'
import type { DadosCadastro } from '@/lib/metas/cadastros'
import { CFOP_SEM_VENDA, faturamentoItem, normalizarDav, type ItemErp, type LeituraErp, type PedidoErp } from '@/lib/metas/importacao/erpEdpe'
import { montarSugestor, type OrigemSugestao, type SugestaoProduto, type VendaHistorico } from '@/lib/metas/importacao/sugestoes'
import { inferirToneladas } from '@/lib/metas/importacao/toneladas'
import { normalizar } from '@/lib/metas/nomes'
import { buscarTodas, competenciaBR } from '@/lib/metas/vendas'
import { Kpi } from '../Comum'

// Importação do relatório EDPE010 do ERP. Traz o que o ERP sabe (data, DAV, cliente, produto,
// qtd, preço) e sugere consultor, grupo e D/C pelo histórico. O resto (custo, frete, datas de
// pagamento) o operador completa na tela de lançamentos.

type Escolha = { incluir: boolean; consultor_id: string | null }
type ItemPrevia = { pedido: PedidoErp; item: ItemErp; sugestao: SugestaoProduto; existe: boolean }

const ROTULO_ORIGEM: Record<Exclude<OrigemSugestao, null>, string> = {
  codigo: 'pelo código do produto', nome: 'pelo nome', marca: 'pela marca', vendedor: 'pelo vendedor', cliente: 'pelo histórico do cliente',
}

const chaveItem = (dav: string | null, quantidade: number, preco: number) => `${normalizarDav(dav)}|${Number(quantidade)}|${Number(preco)}`
const lote = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))

// Mês com mais pedidos (o relatório costuma ser de um mês só)
function mesMaisComum(pedidos: PedidoErp[]) {
  const cont = new Map<string, number>()
  for (const p of pedidos) if (p.data) cont.set(p.data.slice(0, 7), (cont.get(p.data.slice(0, 7)) ?? 0) + 1)
  return [...cont.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
}

export default function ImportarErp({ leitura, dados, onCancelar, onRecarregarCadastros }: {
  leitura: LeituraErp
  dados: DadosCadastro
  onCancelar: () => void
  onRecarregarCadastros: () => Promise<void>
}) {
  const supabase = createClient()
  const router = useRouter()
  const [historico, setHistorico] = useState<VendaHistorico[] | null>(null)
  const [existentes, setExistentes] = useState<Set<string> | null>(null)
  const [competencia, setCompetencia] = useState(() => mesMaisComum(leitura.pedidos))
  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>({})
  const [mapear, setMapear] = useState<Record<string, string>>({})
  const [erro, setErro] = useState('')
  const [gravando, setGravando] = useState(false)

  // Histórico para as sugestões e o que já está gravado nas datas do relatório
  useEffect(() => {
    const datas = leitura.pedidos.map(p => p.data).filter((d): d is string => !!d).sort()
    Promise.all([
      buscarTodas<VendaHistorico>((de, ate) => supabase.from('vendas')
        .select('data, produto, produto_codigo, grupo_id, tipo, cliente, cliente_codigo, consultor_id').order('id').range(de, ate)),
      datas.length
        ? buscarTodas<{ dav: string | null; quantidade: number; preco_unitario: number }>((de, ate) => supabase.from('vendas')
          .select('dav, quantidade, preco_unitario').gte('data', datas[0]).lte('data', datas.at(-1)!).order('id').range(de, ate))
        : Promise.resolve([]),
    ]).then(([h, e]) => {
      setHistorico(h)
      setExistentes(new Set(e.map(x => chaveItem(x.dav, x.quantidade, x.preco_unitario))))
    }).catch(() => setErro('Não foi possível consultar as vendas já lançadas.'))
  }, [leitura])

  const sugestor = useMemo(() => (historico ? montarSugestor(historico, dados.mapeamentos) : null), [historico, dados.mapeamentos])

  // Situação de cada pedido e o que vem marcado
  const pedidos = useMemo(() => {
    if (!sugestor || !existentes) return []
    return leitura.pedidos.map(p => {
      const itens: ItemPrevia[] = p.itens.map(item => ({
        pedido: p, item,
        sugestao: sugestor.produto(item.produto_codigo, item.descricao),
        existe: existentes.has(chaveItem(p.dav, item.quantidade, item.preco_unitario)),
      }))
      const novos = itens.filter(i => !i.existe)
      const motivos: string[] = []
      if (!novos.length) motivos.push('já está no sistema')
      if (CFOP_SEM_VENDA.includes(p.cfop)) motivos.push(`CFOP ${p.cfop} (remessa sem venda)`)
      if (p.situacao && p.situacao !== 'S') motivos.push(`situação "${p.situacao}" no ERP`)
      if (!p.data) motivos.push('sem data')
      return { p, itens, novos, motivos, sugConsultor: sugestor.consultor(p.vendedor, p.cliente_codigo, p.cliente) }
    })
  }, [leitura, sugestor, existentes])

  // Padrão: entra o que não tem motivo para ficar de fora, com o consultor sugerido.
  // "escolhas" guarda só o que o operador mudou.
  const chaveP = (p: PedidoErp) => p.dav + '|' + p.linha
  const padroes = useMemo(() => new Map(pedidos.map(x => [chaveP(x.p), { incluir: x.motivos.length === 0, consultor_id: x.sugConsultor.consultor_id }])), [pedidos])
  const escolha = (p: PedidoErp): Escolha => ({ ...(padroes.get(chaveP(p)) ?? { incluir: false, consultor_id: null }), ...escolhas[chaveP(p)] })
  const marcados = pedidos.filter(x => escolha(x.p).incluir && x.p.data)
  const itensGravar = marcados.flatMap(x => x.novos)
  const totalGravar = itensGravar.reduce((s, i) => s + faturamentoItem(i.item), 0)
  const somaLida = leitura.pedidos.reduce((s, p) => s + p.itens.reduce((t, i) => t + faturamentoItem(i), 0), 0)
  const classificados = itensGravar.filter(i => i.sugestao.grupo_id != null).length
  const semConsultor = marcados.filter(x => !escolha(x.p).consultor_id).length
  const nomeConsultor = (id: string | null) => dados.consultores.find(c => c.id === id)?.nome ?? ''
  const nomeGrupo = (id: number | null) => dados.grupos.find(g => g.id === id)?.nome ?? ''
  const fertilizantesId = dados.grupos.find(g => normalizar(g.nome) === 'FERTILIZANTES')?.id ?? null

  // Vendedores do ERP sem consultor mapeado
  const vendedoresSemMapa = useMemo(() => {
    const mapeados = new Set(dados.mapeamentos.filter(m => m.tipo === 'vendedor').map(m => normalizar(m.texto_original)))
    const cont = new Map<string, number>()
    for (const p of leitura.pedidos) if (p.vendedor && !mapeados.has(normalizar(p.vendedor))) cont.set(p.vendedor, (cont.get(p.vendedor) ?? 0) + 1)
    return [...cont.entries()].sort((a, b) => b[1] - a[1])
  }, [leitura, dados.mapeamentos])

  function mudar(p: PedidoErp, campos: Partial<Escolha>) {
    setEscolhas(e => ({ ...e, [chaveP(p)]: { ...escolha(p), ...campos } }))
  }

  async function salvarMapeamentos() {
    const linhas = Object.entries(mapear).filter(([, v]) => v).map(([texto_original, valor]) => ({ tipo: 'vendedor', texto_original: normalizar(texto_original), valor }))
    if (!linhas.length) return
    const { error } = await supabase.from('mapeamento_nomes').upsert(linhas, { onConflict: 'tipo,texto_original' })
    if (error) { setErro('Não foi possível salvar os mapeamentos.'); return }
    setMapear({})
    await onRecarregarCadastros()
  }

  async function gravar() {
    if (!itensGravar.length || !competencia) return
    setGravando(true); setErro('')
    const fora = pedidos.filter(x => !marcados.includes(x)).map(x => ({ dav: x.p.dav, cliente: x.p.cliente, total: x.p.total, motivos: x.motivos.length ? x.motivos : ['desmarcado'] }))
    const relatorio = {
      conciliacao: { total_planilha: leitura.total_geral, importado: totalGravar, diferenca: leitura.total_geral == null ? null : leitura.total_geral - totalGravar },
      competencia,
      soma_lida: somaLida,
      avisos: leitura.avisos,
      pedidos_fora: fora,
      itens_ja_existentes: marcados.flatMap(x => x.itens.filter(i => i.existe).map(i => ({ dav: x.p.dav, produto: i.item.descricao }))),
    }
    const { data: imp, error } = await supabase.from('importacoes').insert({
      layout: 'erp-edpe010', arquivo: leitura.arquivo, linhas_lidas: leitura.pedidos.reduce((s, p) => s + p.itens.length, 0),
      linhas_importadas: itensGravar.length, linhas_ignoradas: leitura.pedidos.reduce((s, p) => s + p.itens.length, 0) - itensGravar.length, relatorio,
    }).select('id').single()
    if (error || !imp) { setGravando(false); setErro('Não foi possível registrar a importação.'); return }

    const vendas = itensGravar.map(({ pedido: p, item, sugestao }) => {
      const produto = sugestao.nome ?? item.descricao
      return {
        data: p.data, competencia: competencia + '-01', dav: p.dav, cliente: p.cliente, cliente_codigo: p.cliente_codigo,
        produto, produto_codigo: item.produto_codigo, quantidade: item.quantidade, preco_unitario: item.preco_unitario,
        faturamento: faturamentoItem(item), grupo_id: sugestao.grupo_id, tipo: sugestao.tipo, consultor_id: escolha(p).consultor_id,
        // o ERP é o faturamento da loja: Verde Agro. Venda direta vem dos relatórios das fábricas.
        modalidade: 'VERDE_AGRO', vendedor_codigo: p.vendedor || null, custo_unitario: null,
        toneladas: sugestao.grupo_id != null && sugestao.grupo_id === fertilizantesId ? inferirToneladas(produto, item.quantidade, item.preco_unitario).toneladas : null,
        observacao: item.observacao || null, linha_origem: item.linha, importacao_id: imp.id,
        taxa_juros_mensal: dados.config.taxa_juros_mensal, aliquota_imposto: dados.config.aliquota_imposto, fator_comissao: dados.config.fator_comissao,
      }
    })
    for (const parte of lote(vendas, 500)) {
      const { error: e } = await supabase.from('vendas').insert(parte)
      if (e) {
        // tudo ou nada
        await supabase.from('vendas').delete().eq('importacao_id', imp.id)
        await supabase.from('importacoes').delete().eq('id', imp.id)
        setGravando(false)
        setErro(`Erro ao gravar as vendas; nada foi importado. (${e.message})`)
        return
      }
    }
    router.push(`/admin/metas/lancamentos?mes=${competencia}&filtro=completar`)
  }

  if (!sugestor || !existentes) return erro ? <div className="ui-alert ui-alert-erro">{erro}</div> : <div className="ui-skeleton" style={{ height: 320 }} />

  const diferenca = leitura.total_geral == null ? null : leitura.total_geral - somaLida

  return (
    <>
      {erro && <div className="ui-alert ui-alert-erro">{erro}</div>}

      <div className="ui-card ui-card-pad" style={{ marginBottom: '1.25rem' }}>
        <div className="ui-grid-2">
          <div className="ui-field">
            <label className="ui-label">Mês de referência</label>
            <input type="month" className="ui-input" value={competencia} onChange={e => setCompetencia(e.target.value)} />
            <div className="ui-hint">As vendas entram na planilha deste mês. Sugerido pelo mês da maioria dos pedidos.</div>
          </div>
          <div className="ui-field">
            <label className="ui-label">Arquivo</label>
            <div>{leitura.arquivo} · relatório do ERP (EDPE010) · {leitura.pedidos.length} pedidos</div>
            {leitura.avisos.map(a => <div key={a} className="ui-hint">{a}</div>)}
          </div>
        </div>
      </div>

      <div className="ui-kpis">
        <Kpi rotulo="A importar" valor={brl(totalGravar)} sub={`${itensGravar.length} itens de ${marcados.length} pedidos`} />
        <Kpi rotulo="Total do relatório" valor={leitura.total_geral != null ? brl(leitura.total_geral) : '—'} sub={diferenca == null ? 'total geral não encontrado' : Math.abs(diferenca) < 0.01 ? 'confere com a soma dos itens' : `difere ${brl(diferenca)} da soma dos itens`} />
        <Kpi rotulo="Grupo e D/C sugeridos" valor={`${classificados} de ${itensGravar.length}`} sub="pelo histórico; o resto fica a completar" />
        <Kpi rotulo="Sem consultor" valor={String(semConsultor)} sub="pedidos marcados" cor={semConsultor ? 'var(--laranja)' : undefined} />
      </div>

      {vendedoresSemMapa.length > 0 && (
        <div className="ui-card ui-card-pad" style={{ marginBottom: '1.25rem' }}>
          <div className="ui-card-title" style={{ marginBottom: '.5rem' }}>Vendedores do ERP sem consultor</div>
          <div className="ui-hint" style={{ marginBottom: '.75rem' }}>
            Se o código é de um consultor só, escolha e o mapeamento fica salvo. Se é usado por todos (escritório), deixe sem mapear: o consultor vem do histórico do cliente e você ajusta por pedido abaixo.
          </div>
          {vendedoresSemMapa.map(([cod, n]) => (
            <div key={cod} style={{ display: 'flex', gap: '.75rem', alignItems: 'center', marginBottom: '.5rem', flexWrap: 'wrap' }}>
              <strong style={{ minWidth: 70 }}>{cod}</strong>
              <span className="ui-cel-mudo">{n} pedido(s) →</span>
              <select className="ui-select ui-select-sm" style={{ maxWidth: 240 }} value={mapear[cod] ?? ''} onChange={e => setMapear(m => ({ ...m, [cod]: e.target.value }))}>
                <option value="">Não mapear</option>
                {dados.consultores.filter(c => c.ativo).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          ))}
          <button className="ui-btn ui-btn-primary ui-btn-sm" style={{ marginTop: '.5rem' }} disabled={!Object.values(mapear).some(Boolean)} onClick={salvarMapeamentos}>Salvar mapeamentos</button>
        </div>
      )}

      <div className="ui-section-label">Pedidos</div>
      <Tabela
        linhas={pedidos}
        chave={x => chaveP(x.p)}
        rotulo="pedidos"
        porPagina={50}
        destaque={x => x.motivos.length > 0}
        colunas={[
          { id: 'inc', titulo: '', largura: '36px', celula: x => (
            <input type="checkbox" checked={escolha(x.p).incluir} disabled={!x.p.data || !x.novos.length} onChange={e => mudar(x.p, { incluir: e.target.checked })} aria-label={`Importar DAV ${x.p.dav}`} />
          ) },
          { id: 'dav', titulo: 'DAV', celula: x => x.p.dav, largura: '96px' },
          { id: 'data', titulo: 'Data', celula: x => (x.p.data ? dataBR(x.p.data) : '—'), largura: '96px', ordenar: (a, b) => (a.p.data ?? '').localeCompare(b.p.data ?? '') },
          { id: 'cliente', titulo: 'Cliente', celula: x => <span className="ui-cel-txt">{x.p.cliente}</span>, ordenar: (a, b) => a.p.cliente.localeCompare(b.p.cliente) },
          { id: 'consultor', titulo: 'Consultor', celula: x => (
            <>
              <select className="ui-select ui-select-sm" value={escolha(x.p).consultor_id ?? ''} onChange={e => mudar(x.p, { consultor_id: e.target.value || null })}>
                <option value="">A definir</option>
                {dados.consultores.filter(c => c.ativo).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <div className="ui-cel-sub">
                vendedor {x.p.vendedor || '—'}
                {escolha(x.p).consultor_id === x.sugConsultor.consultor_id && x.sugConsultor.origem ? ` · ${ROTULO_ORIGEM[x.sugConsultor.origem]}` : ''}
              </div>
            </>
          ) },
          { id: 'itens', titulo: 'Itens', alinhar: 'dir', celula: x => (
            <>{x.novos.length}{x.novos.length !== x.itens.length && <div className="ui-cel-sub">{x.itens.length - x.novos.length} já no sistema</div>}</>
          ) },
          { id: 'total', titulo: 'Total', alinhar: 'dir', celula: x => brl(x.p.total), ordenar: (a, b) => a.p.total - b.p.total },
          { id: 'sit', titulo: 'Situação', celula: x => (x.motivos.length ? <span className="ui-cel-sub laranja">{x.motivos.join(' · ')}</span> : <span className="ui-cel-sub">{x.p.condicao}</span>) },
        ]}
      />

      <div className="ui-section-label" style={{ marginTop: '1.25rem' }}>Itens marcados e o que foi sugerido</div>
      <Tabela
        linhas={itensGravar}
        chave={i => `${i.pedido.linha}-${i.item.linha}`}
        rotulo="itens"
        porPagina={20}
        colunas={[
          { id: 'dav', titulo: 'DAV', celula: i => i.pedido.dav, largura: '96px' },
          { id: 'erp', titulo: 'Produto no ERP', celula: i => <><span className="ui-cel-txt">{i.item.descricao}</span><div className="ui-cel-sub">cód. {i.item.produto_codigo}</div></> },
          { id: 'nome', titulo: 'Nome usado', celula: i => <span className="ui-cel-txt">{i.sugestao.nome ?? i.item.descricao}</span>, ocultar: 'tablet' },
          { id: 'grupo', titulo: 'Grupo / D/C', celula: i => (i.sugestao.grupo_id != null
            ? <>{nomeGrupo(i.sugestao.grupo_id)} · {i.sugestao.tipo}<div className="ui-cel-sub">{i.sugestao.origem ? ROTULO_ORIGEM[i.sugestao.origem] : ''}</div></>
            : <span className="ui-cel-sub laranja">a completar</span>) },
          { id: 'qtd', titulo: 'Qtd', alinhar: 'dir', celula: i => i.item.quantidade.toLocaleString('pt-BR'), ocultar: 'celular' },
          { id: 'fat', titulo: 'Faturamento', alinhar: 'dir', celula: i => brl(faturamentoItem(i.item)), ordenar: (a, b) => faturamentoItem(a.item) - faturamentoItem(b.item) },
          { id: 'cons', titulo: 'Consultor', celula: i => nomeConsultor(escolha(i.pedido).consultor_id) || <span className="ui-cel-sub laranja">a definir</span>, ocultar: 'celular' },
        ]}
      />

      <div className="ui-card ui-card-pad" style={{ marginTop: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <span className="ui-hint" style={{ margin: 0 }}>
          Custo, frete e datas de pagamento não vêm do ERP: complete na planilha de {competencia ? competenciaBR(`${competencia}-01`) : 'lançamentos'} depois de importar.
        </span>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <button className="ui-btn ui-btn-ghost" onClick={onCancelar} disabled={gravando}>Cancelar</button>
          <button className="ui-btn ui-btn-primary" onClick={gravar} disabled={gravando || !itensGravar.length || !competencia}>
            {gravando ? 'Gravando...' : `Importar ${itensGravar.length} itens (${brl(totalGravar)})`}
          </button>
        </div>
      </div>
    </>
  )
}

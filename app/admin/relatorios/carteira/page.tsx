'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Tabela from '@/app/components/Tabela'
import { baixarCsv } from '@/lib/csv'
import { hojeISO } from '@/lib/dateUtils'
import { Barra, CabecalhoRelatorio, FiltrosRelatorio, Indicadores, Secao, dataBR, div, num, pctTxt, um, useFiltrosRelatorio } from '../Comum'

type Cliente = { id: string; nome: string; nome_fazenda: string | null; cidade: string | null; estado: string | null; criado_por: string | null; criador: { nome_completo: string | null } | { nome_completo: string | null }[] | null }
type Visita = { cliente_id: string; data_visita: string; status: string; funcionario_id: string }
type Faixa = 'todos' | 'em-dia' | '31-60' | '61-90' | '90+' | 'nunca'

type Linha = {
  id: string
  nome: string
  fazenda: string | null
  cidade: string
  responsavel: string
  noPeriodo: number
  ultima: string | null
  dias: number | null
  proxima: string | null
  faixa: Exclude<Faixa, 'todos'>
}

const FAIXAS: [Faixa, string][] = [['todos', 'Todos'], ['em-dia', 'Até 30 dias'], ['31-60', '31–60 dias'], ['61-90', '61–90 dias'], ['90+', '90+ dias'], ['nunca', 'Nunca visitados']]
const COR_FAIXA: Record<string, string> = { 'em-dia': 'ui-badge-realizada', '31-60': 'ui-badge-neutro', '61-90': 'ui-badge-agendada', '90+': 'ui-badge-cancelada', nunca: 'ui-badge-cancelada' }

function diasEntre(de: string, ate: string) {
  return Math.round((Date.parse(ate) - Date.parse(de)) / 86400000)
}

export default function RelatorioCarteira() {
  const { filtros, setFiltros, consultores, periodo } = useFiltrosRelatorio()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [carregando, setCarregando] = useState(true)
  const [faixa, setFaixa] = useState<Faixa>('todos')
  const hoje = hojeISO()

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('clientes').select('id, nome, nome_fazenda, cidade, estado, criado_por, criador:profiles!clientes_criado_por_fkey(nome_completo)').order('nome'),
      supabase.from('visitas').select('cliente_id, data_visita, status, funcionario_id'),
    ]).then(([cli, vis]) => {
      setClientes((cli.data ?? []) as unknown as Cliente[])
      setVisitas(vis.data ?? [])
      setCarregando(false)
    })
  }, [])

  const nomeConsultor = useMemo(() => new Map(consultores.map(c => [c.id, c.nome_completo])), [consultores])

  const linhas = useMemo<Linha[]>(() => {
    const func = filtros.funcionarioId
    const porCliente = new Map<string, Visita[]>()
    visitas.forEach(v => { const l = porCliente.get(v.cliente_id) ?? []; l.push(v); porCliente.set(v.cliente_id, l) })
    return clientes
      .filter(c => !func || c.criado_por === func || (porCliente.get(c.id) ?? []).some(v => v.funcionario_id === func))
      .map(c => {
        const vs = porCliente.get(c.id) ?? []
        const realizadas = vs.filter(v => v.status === 'realizada' && v.data_visita <= hoje).map(v => v.data_visita).sort()
        const ultima = realizadas[realizadas.length - 1] ?? null
        const proxima = vs.filter(v => v.status === 'agendada' && v.data_visita >= hoje).map(v => v.data_visita).sort()[0] ?? null
        const dias = ultima ? diasEntre(ultima, hoje) : null
        const faixa: Linha['faixa'] = dias == null ? 'nunca' : dias <= 30 ? 'em-dia' : dias <= 60 ? '31-60' : dias <= 90 ? '61-90' : '90+'
        return {
          id: c.id, nome: c.nome, fazenda: c.nome_fazenda,
          cidade: [c.cidade, c.estado].filter(Boolean).join('/') || 'Sem cidade',
          responsavel: um(c.criador)?.nome_completo ?? (c.criado_por ? nomeConsultor.get(c.criado_por) ?? '—' : '—'),
          noPeriodo: vs.filter(v => v.status === 'realizada' && v.data_visita >= filtros.dataInicio && v.data_visita <= filtros.dataFim && (!func || v.funcionario_id === func)).length,
          ultima, dias, proxima, faixa,
        }
      })
  }, [clientes, visitas, filtros, hoje, nomeConsultor])

  const contagem = useMemo(() => {
    const c: Record<string, number> = { todos: linhas.length }
    linhas.forEach(l => { c[l.faixa] = (c[l.faixa] ?? 0) + 1 })
    return c
  }, [linhas])

  const exibidas = faixa === 'todos' ? linhas : linhas.filter(l => l.faixa === faixa)
  const visitadosPeriodo = linhas.filter(l => l.noPeriodo > 0).length
  const comDias = linhas.filter(l => l.dias != null)
  const mediaDias = comDias.length ? Math.round(comDias.reduce((s, l) => s + (l.dias ?? 0), 0) / comDias.length) : null

  const cidades = useMemo(() => {
    const m = new Map<string, { cidade: string; clientes: number; visitados: number; esquecidos: number }>()
    linhas.forEach(l => {
      const c = m.get(l.cidade) ?? { cidade: l.cidade, clientes: 0, visitados: 0, esquecidos: 0 }
      c.clientes++
      if (l.noPeriodo > 0) c.visitados++
      if (l.faixa === '61-90' || l.faixa === '90+' || l.faixa === 'nunca') c.esquecidos++
      m.set(l.cidade, c)
    })
    return [...m.values()].sort((a, b) => b.clientes - a.clientes)
  }, [linhas])

  function exportar() {
    baixarCsv(`relatorio-carteira-${hoje}`, ['Cliente', 'Fazenda', 'Cidade', 'Responsável', 'Visitas realizadas no período', 'Última visita', 'Dias sem visita', 'Próxima agendada'],
      exibidas.map(l => [l.nome, l.fazenda, l.cidade, l.responsavel, l.noPeriodo, l.ultima ? dataBR(l.ultima) : 'Nunca', l.dias ?? '', l.proxima ? dataBR(l.proxima) : '']))
  }

  return (
    <>
      <CabecalhoRelatorio titulo="Cobertura da carteira" descricao="Frequência de visita por cliente; o período define a coluna “visitas no período”" periodo={periodo} onExportar={exportar} exportarDesabilitado={!exibidas.length} />
      <FiltrosRelatorio filtros={filtros} setFiltros={setFiltros} consultores={consultores} />

      <Indicadores carregando={carregando} itens={[
        { rotulo: 'Clientes na carteira', valor: num(linhas.length) },
        { rotulo: 'Visitados no período', valor: num(visitadosPeriodo), sub: `${pctTxt(div(visitadosPeriodo, linhas.length))} de cobertura` },
        { rotulo: 'Em dia (até 30 dias)', valor: num(contagem['em-dia'] ?? 0), cor: '#1a7f4b' },
        { rotulo: 'Sem visita há 60+ dias', valor: num((contagem['61-90'] ?? 0) + (contagem['90+'] ?? 0)), cor: '#c0651a' },
        { rotulo: 'Nunca visitados', valor: num(contagem.nunca ?? 0), cor: (contagem.nunca ?? 0) ? '#c0392b' : undefined, sub: mediaDias != null ? `média de ${mediaDias} dias desde a última` : undefined },
      ]} />

      <Secao titulo="Clientes" sub="Ordene pelos dias sem visita para ver quem está esquecido"
        acao={
          <div className="ui-segmented rl-no-print" role="tablist" aria-label="Faixa de dias sem visita">
            {FAIXAS.map(([k, label]) => (
              <button key={k} className={faixa === k ? 'ativo' : ''} onClick={() => setFaixa(k)}>{label} <span className="ui-count">{carregando ? '·' : contagem[k] ?? 0}</span></button>
            ))}
          </div>
        }>
        <Tabela linhas={exibidas} chave={l => l.id} carregando={carregando} rotulo="clientes" href={l => `/admin/clientes/${l.id}`}
          reiniciar={`${faixa}|${filtros.funcionarioId}`} ordemInicial={{ coluna: 'dias', direcao: 'desc' }}
          colunas={[
            { id: 'nome', titulo: 'Cliente', ordenar: (a, b) => a.nome.localeCompare(b.nome),
              celula: l => <div className="ui-cel-txt"><div className="ui-cel-titulo">{l.nome}</div>{l.fazenda && <div className="ui-cel-sub laranja">{l.fazenda}</div>}</div> },
            { id: 'cidade', titulo: 'Cidade', ocultar: 'tablet', ordenar: (a, b) => a.cidade.localeCompare(b.cidade), celula: l => l.cidade },
            { id: 'resp', titulo: 'Responsável', ocultar: 'tablet', ordenar: (a, b) => a.responsavel.localeCompare(b.responsavel), celula: l => l.responsavel },
            { id: 'periodo', titulo: 'No período', alinhar: 'dir', ocultar: 'celular', ordenar: (a, b) => a.noPeriodo - b.noPeriodo, celula: l => <span className="ui-cel-num">{l.noPeriodo}</span> },
            { id: 'ultima', titulo: 'Última visita', ocultar: 'celular', ordenar: (a, b) => (a.ultima ?? '').localeCompare(b.ultima ?? ''), celula: l => <span className="ui-cel-num">{l.ultima ? dataBR(l.ultima) : '—'}</span> },
            { id: 'dias', titulo: 'Sem visita', ordenar: (a, b) => (a.dias ?? 99999) - (b.dias ?? 99999),
              celula: l => <span className={`ui-badge ${COR_FAIXA[l.faixa]}`}>{l.dias == null ? 'Nunca' : `${l.dias} dias`}</span> },
            { id: 'prox', titulo: 'Próxima', ocultar: 'tablet', ordenar: (a, b) => (a.proxima ?? '9').localeCompare(b.proxima ?? '9'),
              celula: l => l.proxima ? <span className="ui-cel-num" style={{ color: '#E67E22', fontWeight: 600 }}>{dataBR(l.proxima)}</span>
                : <Link href={`/admin/visitas/novo?cliente=${l.id}`} className="ui-btn ui-btn-ghost ui-btn-sm rl-no-print">Agendar</Link> },
          ]} />
      </Secao>

      <Secao titulo="Por cidade" sub="Cobertura = clientes visitados no período ÷ clientes da cidade">
        <Tabela linhas={cidades} chave={c => c.cidade} carregando={carregando} porPagina={10} rotulo="cidades"
          colunas={[
            { id: 'cidade', titulo: 'Cidade', ordenar: (a, b) => a.cidade.localeCompare(b.cidade), celula: c => <span className="ui-cel-titulo">{c.cidade}</span> },
            { id: 'cli', titulo: 'Clientes', alinhar: 'dir', ordenar: (a, b) => a.clientes - b.clientes, celula: c => <span className="ui-cel-num ui-cel-forte">{c.clientes}</span> },
            { id: 'vis', titulo: 'Visitados', alinhar: 'dir', ordenar: (a, b) => a.visitados - b.visitados, celula: c => <span className="ui-cel-num">{c.visitados}</span> },
            { id: 'cob', titulo: 'Cobertura', ordenar: (a, b) => (div(a.visitados, a.clientes) ?? 0) - (div(b.visitados, b.clientes) ?? 0),
              celula: c => <Barra valor={c.visitados} max={c.clientes} texto={pctTxt(div(c.visitados, c.clientes))} /> },
            { id: 'esq', titulo: 'Sem visita 60+', alinhar: 'dir', ocultar: 'celular', ordenar: (a, b) => a.esquecidos - b.esquecidos,
              celula: c => <span className="ui-cel-num" style={{ color: c.esquecidos ? '#c0651a' : undefined, fontWeight: c.esquecidos ? 600 : 400 }}>{c.esquecidos}</span> },
          ]} />
      </Secao>
    </>
  )
}

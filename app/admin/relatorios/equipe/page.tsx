'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Tabela from '@/app/components/Tabela'
import { baixarCsv } from '@/lib/csv'
import { hojeISO } from '@/lib/dateUtils'
import { calcularTotais, itemDoBanco, parametrosDoBanco } from '@/lib/cotacao'
import { Barra, CabecalhoRelatorio, FiltrosRelatorio, Indicadores, Secao, brl, div, num, pctTxt, useFiltrosRelatorio } from '../Comum'

type Linha = {
  id: string
  nome: string
  realizadas: number
  agendadas: number
  atrasadas: number
  canceladas: number
  clientes: number
  km: number
  gasto: number
  cotacoes: number
  aprovadas: number
  perdidas: number
  vendido: number
}

export default function RelatorioEquipe() {
  const { filtros, setFiltros, consultores, consultoresProntos, periodo } = useFiltrosRelatorio()
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [carregando, setCarregando] = useState(true)
  const hoje = hojeISO()

  useEffect(() => {
    if (!consultoresProntos) return
    const supabase = createClient()
    const { dataInicio: ini, dataFim: fim } = filtros
    Promise.all([
      supabase.from('visitas').select('funcionario_id, cliente_id, status, data_visita').gte('data_visita', ini).lte('data_visita', fim),
      supabase.from('km_diario').select('funcionario_id, km_inicial, km_final').gte('data', ini).lte('data', fim),
      supabase.from('abastecimentos').select('funcionario_id, valor_total').gte('data', ini).lte('data', fim),
      supabase.from('cotacoes').select('criado_por, status, ptax, juros_mes, aliquota_icms, aliquota_ir, itens:cotacao_itens(*)').gte('created_at', ini).lte('created_at', fim + 'T23:59:59'),
    ]).then(([v, k, a, c]) => {
      const mapa = new Map<string, Linha & { cli: Set<string> }>()
      consultores.forEach(p => mapa.set(p.id, { id: p.id, nome: p.nome_completo, realizadas: 0, agendadas: 0, atrasadas: 0, canceladas: 0, clientes: 0, km: 0, gasto: 0, cotacoes: 0, aprovadas: 0, perdidas: 0, vendido: 0, cli: new Set() }))
      ;(v.data ?? []).forEach(x => {
        const m = mapa.get(x.funcionario_id); if (!m) return
        if (x.status === 'realizada') { m.realizadas++; m.cli.add(x.cliente_id) }
        else if (x.status === 'cancelada') m.canceladas++
        else if (x.data_visita < hoje) m.atrasadas++
        else m.agendadas++
      })
      ;(k.data ?? []).forEach(x => { const m = mapa.get(x.funcionario_id); if (m && x.km_inicial != null && x.km_final != null) m.km += Number(x.km_final) - Number(x.km_inicial) })
      ;(a.data ?? []).forEach(x => { const m = mapa.get(x.funcionario_id); if (m) m.gasto += Number(x.valor_total) || 0 })
      ;(c.data ?? []).forEach(x => {
        const m = mapa.get(x.criado_por); if (!m) return
        m.cotacoes++
        if (x.status === 'perdida') m.perdidas++
        if (x.status === 'aprovada') {
          m.aprovadas++
          m.vendido += calcularTotais(((x.itens ?? []) as Record<string, unknown>[]).map(itemDoBanco), parametrosDoBanco(x)).venda
        }
      })
      setLinhas([...mapa.values()].map(({ cli, ...l }) => ({ ...l, clientes: cli.size })))
      setCarregando(false)
    })
  }, [filtros.dataInicio, filtros.dataFim, consultores, consultoresProntos, hoje])

  const exibidas = filtros.funcionarioId ? linhas.filter(l => l.id === filtros.funcionarioId) : linhas
  const soma = (f: (l: Linha) => number) => exibidas.reduce((s, l) => s + f(l), 0)
  const tot = {
    realizadas: soma(l => l.realizadas), pendentes: soma(l => l.agendadas + l.atrasadas), clientes: soma(l => l.clientes),
    km: soma(l => l.km), gasto: soma(l => l.gasto), vendido: soma(l => l.vendido),
    aprovadas: soma(l => l.aprovadas), perdidas: soma(l => l.perdidas),
  }
  const conclusao = (l: Linha) => div(l.realizadas, l.realizadas + l.agendadas + l.atrasadas)
  const conversao = (l: Linha) => div(l.aprovadas, l.aprovadas + l.perdidas)
  const custoVisita = (l: Linha) => div(l.gasto, l.realizadas)
  const maxReal = Math.max(1, ...exibidas.map(l => l.realizadas))
  const maxVend = Math.max(1, ...exibidas.map(l => l.vendido))
  const destaque = useMemo(() => [...exibidas].sort((a, b) => b.realizadas - a.realizadas)[0], [exibidas])

  function exportar() {
    baixarCsv(`relatorio-equipe-${hoje}`, ['Consultor', 'Visitas realizadas', 'Agendadas', 'Atrasadas', 'Canceladas', 'Conclusão (%)', 'Clientes atendidos', 'KM', 'Combustível (R$)', 'Combustível por visita (R$)', 'Cotações', 'Aprovadas', 'Perdidas', 'Conversão (%)', 'Vendido (R$)'],
      exibidas.map(l => [l.nome, l.realizadas, l.agendadas, l.atrasadas, l.canceladas, conclusao(l) != null ? Math.round(conclusao(l)! * 100) : '', l.clientes, l.km,
        l.gasto.toFixed(2).replace('.', ','), custoVisita(l)?.toFixed(2).replace('.', ',') ?? '', l.cotacoes, l.aprovadas, l.perdidas,
        conversao(l) != null ? Math.round(conversao(l)! * 100) : '', l.vendido.toFixed(2).replace('.', ',')]))
  }

  return (
    <>
      <CabecalhoRelatorio titulo="Desempenho da equipe" descricao="Placar consolidado por consultor: campo, custo e vendas" periodo={periodo} onExportar={exportar} exportarDesabilitado={!exibidas.length} />
      <FiltrosRelatorio filtros={filtros} setFiltros={f => { setCarregando(true); setFiltros(f) }} consultores={consultores} />

      <Indicadores carregando={carregando} itens={[
        { rotulo: 'Visitas realizadas', valor: num(tot.realizadas), sub: `${tot.pendentes} ainda pendentes` },
        { rotulo: 'Clientes atendidos', valor: num(tot.clientes) },
        { rotulo: 'Combustível por visita', valor: div(tot.gasto, tot.realizadas) != null ? brl(div(tot.gasto, tot.realizadas)!, 2) : '—', sub: `${num(tot.km)} km · ${brl(tot.gasto)}` },
        { rotulo: 'Vendas aprovadas', valor: brl(tot.vendido), cor: '#1a7f4b', sub: `conversão de ${pctTxt(div(tot.aprovadas, tot.aprovadas + tot.perdidas))}` },
        { rotulo: 'Destaque em visitas', valor: destaque && destaque.realizadas ? destaque.nome.split(' ')[0] : '—', sub: destaque && destaque.realizadas ? `${destaque.realizadas} realizadas` : undefined },
      ]} />

      <Secao titulo="Placar por consultor" sub="Clique no cabeçalho para ordenar por qualquer indicador">
        <Tabela linhas={exibidas} chave={l => l.id} carregando={carregando} rotulo="consultores" href={l => `/admin/consultores/${l.id}`}
          ordemInicial={{ coluna: 'real', direcao: 'desc' }}
          colunas={[
            { id: 'nome', titulo: 'Consultor', ordenar: (a, b) => a.nome.localeCompare(b.nome),
              celula: l => <div className="ui-cel"><span className="ui-avatar ui-avatar-sm">{l.nome.charAt(0).toUpperCase()}</span><span className="ui-cel-titulo">{l.nome}</span></div> },
            { id: 'real', titulo: 'Realizadas', ordenar: (a, b) => a.realizadas - b.realizadas, celula: l => <Barra valor={l.realizadas} max={maxReal} texto={num(l.realizadas)} /> },
            { id: 'conc', titulo: 'Conclusão', alinhar: 'dir', ordenar: (a, b) => (conclusao(a) ?? -1) - (conclusao(b) ?? -1),
              celula: l => <span className="ui-cel-num" style={{ color: l.atrasadas ? '#c0651a' : undefined }} title={`${l.atrasadas} atrasada(s)`}>{pctTxt(conclusao(l))}</span> },
            { id: 'cli', titulo: 'Clientes', alinhar: 'dir', ocultar: 'celular', ordenar: (a, b) => a.clientes - b.clientes, celula: l => <span className="ui-cel-num">{l.clientes}</span> },
            { id: 'km', titulo: 'KM', alinhar: 'dir', ocultar: 'tablet', ordenar: (a, b) => a.km - b.km, celula: l => <span className="ui-cel-num">{num(l.km)}</span> },
            { id: 'cv', titulo: 'R$/visita', alinhar: 'dir', ocultar: 'tablet', ordenar: (a, b) => (custoVisita(a) ?? 0) - (custoVisita(b) ?? 0),
              celula: l => <span className="ui-cel-num">{custoVisita(l) != null ? brl(custoVisita(l)!, 2) : '—'}</span> },
            { id: 'cot', titulo: 'Cotações', alinhar: 'dir', ocultar: 'tablet', ordenar: (a, b) => a.cotacoes - b.cotacoes, celula: l => <span className="ui-cel-num">{l.cotacoes}</span> },
            { id: 'conv', titulo: 'Conversão', alinhar: 'dir', ocultar: 'celular', ordenar: (a, b) => (conversao(a) ?? -1) - (conversao(b) ?? -1), celula: l => <span className="ui-cel-num">{pctTxt(conversao(l))}</span> },
            { id: 'vend', titulo: 'Vendido', ordenar: (a, b) => a.vendido - b.vendido, celula: l => <Barra valor={l.vendido} max={maxVend} cor="#E67E22" texto={brl(l.vendido)} /> },
          ]} />
      </Secao>
    </>
  )
}

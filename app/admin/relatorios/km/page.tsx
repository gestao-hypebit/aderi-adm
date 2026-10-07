'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Tabela from '@/app/components/Tabela'
import { baixarCsv } from '@/lib/csv'
import { hojeISO } from '@/lib/dateUtils'
import LancamentosKm from '@/app/components/LancamentosKm'
import { Barra, CabecalhoRelatorio, FiltrosRelatorio, Indicadores, Secao, brl, div, num, useFiltrosRelatorio } from '../Comum'

type Km = { funcionario_id: string; data: string; km_inicial: number | null; km_final: number | null }
type Abast = { funcionario_id: string; data: string; litros: number; valor_total: number }
type Vis = { funcionario_id: string; data_visita: string }

type Agregado = { km: number; dias: number; pendentes: number; litros: number; gasto: number; visitas: number }
const vazio = (): Agregado => ({ km: 0, dias: 0, pendentes: 0, litros: 0, gasto: 0, visitas: 0 })
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const kmL = (a: Agregado) => div(a.km, a.litros)
const brl2 = (n: number | null) => (n == null ? '—' : brl(n, 2))

function RelatorioKmConteudo() {
  // ?func= vem da ficha do consultor
  const func = useSearchParams().get('func') ?? ''
  const { filtros, setFiltros, consultores, periodo } = useFiltrosRelatorio({ funcionarioId: func })
  const [versao, setVersao] = useState(0)
  const [dados, setDados] = useState<{ kms: Km[]; abasts: Abast[]; visitas: Vis[] }>({ kms: [], abasts: [], visitas: [] })
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    const f = filtros.funcionarioId ? { funcionario_id: filtros.funcionarioId } : {}
    Promise.all([
      supabase.from('km_diario').select('funcionario_id, data, km_inicial, km_final').gte('data', filtros.dataInicio).lte('data', filtros.dataFim).match(f),
      supabase.from('abastecimentos').select('funcionario_id, data, litros, valor_total').gte('data', filtros.dataInicio).lte('data', filtros.dataFim).match(f),
      supabase.from('visitas').select('funcionario_id, data_visita').eq('status', 'realizada').gte('data_visita', filtros.dataInicio).lte('data_visita', filtros.dataFim).match(f),
    ]).then(([k, a, v]) => {
      setDados({ kms: k.data ?? [], abasts: a.data ?? [], visitas: v.data ?? [] })
      setCarregando(false)
    })
  }, [filtros.dataInicio, filtros.dataFim, filtros.funcionarioId, versao])

  const nomes = useMemo(() => new Map(consultores.map(c => [c.id, c.nome_completo])), [consultores])

  const r = useMemo(() => {
    const total = vazio()
    const porCons = new Map<string, Agregado>()
    const porMes = new Map<string, Agregado>()
    const pegar = (m: Map<string, Agregado>, k: string) => { if (!m.has(k)) m.set(k, vazio()); return m.get(k)! }
    dados.kms.forEach(k => {
      const alvos = [total, pegar(porCons, k.funcionario_id), pegar(porMes, k.data.slice(0, 7))]
      if (k.km_inicial != null && k.km_final != null) alvos.forEach(a => { a.km += Number(k.km_final) - Number(k.km_inicial); a.dias++ })
      else alvos.forEach(a => a.pendentes++)
    })
    dados.abasts.forEach(x => [total, pegar(porCons, x.funcionario_id), pegar(porMes, x.data.slice(0, 7))].forEach(a => { a.litros += Number(x.litros) || 0; a.gasto += Number(x.valor_total) || 0 }))
    dados.visitas.forEach(v => [total, pegar(porCons, v.funcionario_id), pegar(porMes, v.data_visita.slice(0, 7))].forEach(a => a.visitas++))
    return {
      total,
      consultores: [...porCons.entries()].map(([id, a]) => ({ id, nome: nomes.get(id) ?? 'Consultor', ...a })).sort((a, b) => b.km - a.km),
      meses: [...porMes.entries()].map(([chave, a]) => ({ chave, mes: `${MESES[Number(chave.slice(5)) - 1]}/${chave.slice(0, 4)}`, ...a })).sort((a, b) => b.chave.localeCompare(a.chave)),
    }
  }, [dados, nomes])

  const t = r.total
  const maxKm = Math.max(1, ...r.consultores.map(c => c.km))
  const maxKmMes = Math.max(1, ...r.meses.map(m => m.km))

  function exportar() {
    baixarCsv(`relatorio-km-${hojeISO()}`, ['Consultor', 'KM rodado', 'Dias com KM', 'KM pendentes', 'Litros', 'Combustível (R$)', 'km/L', 'R$/km', 'Visitas realizadas', 'KM por visita', 'Combustível por visita (R$)'],
      r.consultores.map(c => [c.nome, c.km, c.dias, c.pendentes, c.litros.toFixed(1).replace('.', ','), c.gasto.toFixed(2).replace('.', ','),
        kmL(c)?.toFixed(1).replace('.', ',') ?? '', div(c.gasto, c.km)?.toFixed(2).replace('.', ',') ?? '', c.visitas,
        div(c.km, c.visitas)?.toFixed(0) ?? '', div(c.gasto, c.visitas)?.toFixed(2).replace('.', ',') ?? '']))
  }

  return (
    <>
      <CabecalhoRelatorio titulo="KM e combustível" descricao="Rodagem, consumo e custo da equipe em campo" periodo={periodo} onExportar={exportar} exportarDesabilitado={!r.consultores.length} />
      <FiltrosRelatorio filtros={filtros} setFiltros={f => { setCarregando(true); setFiltros(f) }} consultores={consultores} />

      <Indicadores carregando={carregando} itens={[
        { rotulo: 'KM rodado', valor: <>{num(t.km)}<small>km</small></>, sub: `${t.dias} dia${t.dias !== 1 ? 's' : ''} lançado${t.dias !== 1 ? 's' : ''}${t.pendentes ? ` · ${t.pendentes} pendente${t.pendentes > 1 ? 's' : ''}` : ''}` },
        { rotulo: 'Combustível', valor: brl(t.gasto), sub: `${num(t.litros, 1)} litros` },
        { rotulo: 'Consumo médio', valor: <>{kmL(t) != null ? num(kmL(t)!, 1) : '—'}<small>km/L</small></> },
        { rotulo: 'Custo por km', valor: brl2(div(t.gasto, t.km)) },
        { rotulo: 'Combustível por visita', valor: brl2(div(t.gasto, t.visitas)), sub: `${t.visitas} visitas realizadas · ${div(t.km, t.visitas) != null ? num(div(t.km, t.visitas)!) : '—'} km/visita` },
      ]} />

      <Secao titulo="Por consultor" sub="KM pendente = dia com KM inicial sem o final (não entra no total)">
        <Tabela linhas={r.consultores} chave={c => c.id} carregando={carregando} porPagina={10} rotulo="consultores"
          vazio={<div className="ui-empty"><div className="ui-empty-title">Nenhum lançamento de KM no período</div></div>}
          colunas={[
            { id: 'nome', titulo: 'Consultor', ordenar: (a, b) => a.nome.localeCompare(b.nome), celula: c => <span className="ui-cel-titulo">{c.nome}</span> },
            { id: 'km', titulo: 'KM rodado', ordenar: (a, b) => a.km - b.km, celula: c => <Barra valor={c.km} max={maxKm} cor="#162a1e" texto={num(c.km)} /> },
            { id: 'pend', titulo: 'Pend.', alinhar: 'dir', ocultar: 'tablet', ordenar: (a, b) => a.pendentes - b.pendentes, celula: c => <span className="ui-cel-num" style={{ color: c.pendentes ? '#c0651a' : undefined }}>{c.pendentes}</span> },
            { id: 'litros', titulo: 'Litros', alinhar: 'dir', ocultar: 'tablet', ordenar: (a, b) => a.litros - b.litros, celula: c => <span className="ui-cel-num">{num(c.litros, 1)}</span> },
            { id: 'gasto', titulo: 'Combustível', alinhar: 'dir', ordenar: (a, b) => a.gasto - b.gasto, celula: c => <span className="ui-cel-num ui-cel-forte">{brl(c.gasto)}</span> },
            { id: 'kml', titulo: 'km/L', alinhar: 'dir', ordenar: (a, b) => (kmL(a) ?? 0) - (kmL(b) ?? 0), celula: c => <span className="ui-cel-num">{kmL(c) != null ? num(kmL(c)!, 1) : '—'}</span> },
            { id: 'rkm', titulo: 'R$/km', alinhar: 'dir', ocultar: 'celular', ordenar: (a, b) => (div(a.gasto, a.km) ?? 0) - (div(b.gasto, b.km) ?? 0), celula: c => <span className="ui-cel-num">{brl2(div(c.gasto, c.km))}</span> },
            { id: 'vis', titulo: 'Visitas', alinhar: 'dir', ocultar: 'tablet', ordenar: (a, b) => a.visitas - b.visitas, celula: c => <span className="ui-cel-num">{c.visitas}</span> },
            { id: 'cv', titulo: 'R$/visita', alinhar: 'dir', ocultar: 'celular', ordenar: (a, b) => (div(a.gasto, a.visitas) ?? 0) - (div(b.gasto, b.visitas) ?? 0), celula: c => <span className="ui-cel-num">{brl2(div(c.gasto, c.visitas))}</span> },
          ]} />
      </Secao>

      <Secao titulo="Por mês" sub="Evolução de rodagem e gasto">
        <Tabela linhas={r.meses} chave={m => m.chave} carregando={carregando} porPagina={12} rotulo="meses"
          colunas={[
            { id: 'mes', titulo: 'Mês', largura: '120px', ordenar: (a, b) => a.chave.localeCompare(b.chave), celula: m => <span className="ui-cel-forte">{m.mes}</span> },
            { id: 'km', titulo: 'KM rodado', ordenar: (a, b) => a.km - b.km, celula: m => <Barra valor={m.km} max={maxKmMes} cor="#162a1e" texto={num(m.km)} /> },
            { id: 'litros', titulo: 'Litros', alinhar: 'dir', ocultar: 'celular', celula: m => <span className="ui-cel-num">{num(m.litros, 1)}</span> },
            { id: 'gasto', titulo: 'Combustível', alinhar: 'dir', ordenar: (a, b) => a.gasto - b.gasto, celula: m => <span className="ui-cel-num ui-cel-forte">{brl(m.gasto)}</span> },
            { id: 'kml', titulo: 'km/L', alinhar: 'dir', ocultar: 'celular', celula: m => <span className="ui-cel-num">{kmL(m) != null ? num(kmL(m)!, 1) : '—'}</span> },
            { id: 'cv', titulo: 'R$/visita', alinhar: 'dir', ocultar: 'tablet', celula: m => <span className="ui-cel-num">{brl2(div(m.gasto, m.visitas))}</span> },
          ]} />
      </Secao>

      <Secao titulo="Lançamentos" sub="Cada KM do dia e abastecimento lançado pela equipe; use a lixeira para excluir um lançamento errado">
        <div className="rl-no-print">
          <LancamentosKm
            inicio={filtros.dataInicio}
            fim={filtros.dataFim}
            funcionarioId={filtros.funcionarioId || undefined}
            mostrarConsultor
            onMudou={() => setVersao(v => v + 1)}
          />
        </div>
      </Secao>
    </>
  )
}

export default function RelatorioKm() {
  return (
    <Suspense fallback={null}>
      <RelatorioKmConteudo />
    </Suspense>
  )
}

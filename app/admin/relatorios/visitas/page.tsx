'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Tabela from '@/app/components/Tabela'
import { baixarCsv } from '@/lib/csv'
import { hojeISO } from '@/lib/dateUtils'
import { Barra, CabecalhoRelatorio, FiltrosRelatorio, Indicadores, Secao, dataBR, div, num, pctTxt, um, useFiltrosRelatorio } from '../Comum'

type Rel<T> = T | T[] | null
type Visita = {
  id: string
  data_visita: string
  hora_visita: string | null
  status: string
  motivo_visita: string | null
  motivo_outro: string | null
  funcionario_id: string
  cliente: Rel<{ nome: string; nome_fazenda: string | null; cidade: string | null }>
  funcionario: Rel<{ nome_completo: string | null }>
}

const STATUS_LABEL: Record<string, string> = { agendada: 'Agendada', realizada: 'Realizada', cancelada: 'Cancelada', atrasada: 'Atrasada' }
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export default function RelatorioVisitas() {
  const { filtros, setFiltros, consultores, periodo } = useFiltrosRelatorio()
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [carregando, setCarregando] = useState(true)
  const hoje = hojeISO()

  useEffect(() => {
    createClient().from('visitas')
      .select('id, data_visita, hora_visita, status, motivo_visita, motivo_outro, funcionario_id, cliente:clientes(nome, nome_fazenda, cidade), funcionario:profiles(nome_completo)')
      .gte('data_visita', filtros.dataInicio).lte('data_visita', filtros.dataFim)
      .match(filtros.funcionarioId ? { funcionario_id: filtros.funcionarioId } : {})
      .order('data_visita', { ascending: false })
      .then(({ data }) => { setVisitas((data ?? []) as unknown as Visita[]); setCarregando(false) })
  }, [filtros.dataInicio, filtros.dataFim, filtros.funcionarioId])

  const statusDe = (v: Visita) => (v.status === 'agendada' && v.data_visita < hoje ? 'atrasada' : v.status)
  const motivoDe = (v: Visita) => (v.motivo_visita === 'Outros' ? 'Outros' : v.motivo_visita || 'Não informado')

  const r = useMemo(() => {
    const cont = { realizada: 0, agendada: 0, atrasada: 0, cancelada: 0 } as Record<string, number>
    const porConsultor = new Map<string, { id: string; nome: string; realizada: number; agendada: number; atrasada: number; cancelada: number; total: number }>()
    const porMotivo = new Map<string, { motivo: string; total: number; realizadas: number }>()
    const porMes = new Map<string, { chave: string; mes: string; realizada: number; agendada: number; cancelada: number; total: number }>()
    visitas.forEach(v => {
      const st = statusDe(v)
      cont[st] = (cont[st] ?? 0) + 1
      const nome = um(v.funcionario)?.nome_completo ?? 'Sem consultor'
      const c = porConsultor.get(v.funcionario_id) ?? { id: v.funcionario_id, nome, realizada: 0, agendada: 0, atrasada: 0, cancelada: 0, total: 0 }
      c[st as 'realizada']++; c.total++
      porConsultor.set(v.funcionario_id, c)
      const m = motivoDe(v)
      const mo = porMotivo.get(m) ?? { motivo: m, total: 0, realizadas: 0 }
      mo.total++; if (v.status === 'realizada') mo.realizadas++
      porMotivo.set(m, mo)
      const chave = v.data_visita.slice(0, 7)
      const [a, mm] = chave.split('-')
      const me = porMes.get(chave) ?? { chave, mes: `${MESES[Number(mm) - 1]}/${a}`, realizada: 0, agendada: 0, cancelada: 0, total: 0 }
      if (v.status === 'realizada') me.realizada++
      else if (v.status === 'cancelada') me.cancelada++
      else me.agendada++
      me.total++
      porMes.set(chave, me)
    })
    const total = visitas.length
    const decididas = cont.realizada + cont.agendada + cont.atrasada
    return {
      total, cont,
      conclusao: div(cont.realizada, decididas),
      cancelamento: div(cont.cancelada, total),
      consultores: [...porConsultor.values()].sort((a, b) => b.realizada - a.realizada),
      motivos: [...porMotivo.values()].sort((a, b) => b.total - a.total),
      meses: [...porMes.values()].sort((a, b) => b.chave.localeCompare(a.chave)),
    }
  }, [visitas, hoje])

  const maxConsultor = Math.max(1, ...r.consultores.map(c => c.total))
  const maxMotivo = Math.max(1, ...r.motivos.map(m => m.total))
  const maxMes = Math.max(1, ...r.meses.map(m => m.total))

  function exportar() {
    baixarCsv(`relatorio-visitas-${hoje}`, ['Data', 'Hora', 'Cliente', 'Fazenda', 'Cidade', 'Consultor', 'Motivo', 'Status'],
      visitas.map(v => [dataBR(v.data_visita), v.hora_visita?.slice(0, 5), um(v.cliente)?.nome, um(v.cliente)?.nome_fazenda, um(v.cliente)?.cidade,
        um(v.funcionario)?.nome_completo, v.motivo_visita === 'Outros' ? `Outros — ${v.motivo_outro ?? ''}` : v.motivo_visita, STATUS_LABEL[statusDe(v)]]))
  }

  return (
    <>
      <CabecalhoRelatorio titulo="Visitas" descricao="Volume e resultado das visitas da equipe" periodo={periodo} onExportar={exportar} exportarDesabilitado={!visitas.length} />
      <FiltrosRelatorio filtros={filtros} setFiltros={f => { setCarregando(true); setFiltros(f) }} consultores={consultores} />

      <Indicadores carregando={carregando} itens={[
        { rotulo: 'Total de visitas', valor: num(r.total) },
        { rotulo: 'Realizadas', valor: num(r.cont.realizada), cor: '#1a7f4b', sub: `${pctTxt(r.conclusao)} de conclusão` },
        { rotulo: 'Agendadas', valor: num(r.cont.agendada), sub: 'ainda dentro do prazo' },
        { rotulo: 'Atrasadas', valor: num(r.cont.atrasada), cor: r.cont.atrasada ? '#c0392b' : undefined, sub: 'agendadas com data passada' },
        { rotulo: 'Canceladas', valor: num(r.cont.cancelada), sub: `${pctTxt(r.cancelamento)} do total` },
      ]} />

      <div className="rl-duas">
        <Secao titulo="Por consultor" sub="Ordenado por visitas realizadas">
          <Tabela linhas={r.consultores} chave={c => c.id} carregando={carregando} porPagina={10} rotulo="consultores" href={c => `/admin/consultores/${c.id}`}
            acoes={c => [{ rotulo: 'Abrir ficha', icone: 'ver', href: `/admin/consultores/${c.id}` }]}
            colunas={[
              { id: 'nome', titulo: 'Consultor', ordenar: (a, b) => a.nome.localeCompare(b.nome), celula: c => <span className="ui-cel-titulo">{c.nome}</span> },
              { id: 'total', titulo: 'Total', ordenar: (a, b) => a.total - b.total, celula: c => <Barra valor={c.total} max={maxConsultor} cor="#162a1e" texto={num(c.total)} /> },
              { id: 'real', titulo: 'Realiz.', alinhar: 'dir', ordenar: (a, b) => a.realizada - b.realizada, celula: c => <span className="ui-cel-num ui-cel-forte">{c.realizada}</span> },
              { id: 'atr', titulo: 'Atras.', alinhar: 'dir', ocultar: 'celular', ordenar: (a, b) => a.atrasada - b.atrasada, celula: c => <span className="ui-cel-num" style={{ color: c.atrasada ? '#c0392b' : undefined }}>{c.atrasada}</span> },
              { id: 'canc', titulo: 'Canc.', alinhar: 'dir', ocultar: 'celular', ordenar: (a, b) => a.cancelada - b.cancelada, celula: c => <span className="ui-cel-num">{c.cancelada}</span> },
              { id: 'conc', titulo: 'Conclusão', alinhar: 'dir', ordenar: (a, b) => (div(a.realizada, a.realizada + a.agendada + a.atrasada) ?? -1) - (div(b.realizada, b.realizada + b.agendada + b.atrasada) ?? -1),
                celula: c => <span className="ui-cel-num">{pctTxt(div(c.realizada, c.realizada + c.agendada + c.atrasada))}</span> },
            ]} />
        </Secao>

        <Secao titulo="Por motivo" sub="O que leva o consultor a campo">
          <Tabela linhas={r.motivos} chave={m => m.motivo} carregando={carregando} porPagina={10} rotulo="motivos"
            colunas={[
              { id: 'motivo', titulo: 'Motivo', ordenar: (a, b) => a.motivo.localeCompare(b.motivo), celula: m => <span className="ui-cel-titulo" style={{ fontWeight: 500 }}>{m.motivo}</span> },
              { id: 'total', titulo: 'Visitas', ordenar: (a, b) => a.total - b.total, celula: m => <Barra valor={m.total} max={maxMotivo} cor="#E67E22" texto={num(m.total)} /> },
              { id: 'pct', titulo: '% do total', alinhar: 'dir', ocultar: 'celular', celula: m => <span className="ui-cel-num">{pctTxt(div(m.total, r.total), 1)}</span> },
              { id: 'real', titulo: 'Realizadas', alinhar: 'dir', ordenar: (a, b) => a.realizadas - b.realizadas, celula: m => <span className="ui-cel-num">{m.realizadas}</span> },
            ]} />
        </Secao>
      </div>

      <div style={{ height: '1.6rem' }} />

      <Secao titulo="Por mês" sub="Evolução do volume de visitas">
        <Tabela linhas={r.meses} chave={m => m.chave} carregando={carregando} porPagina={12} rotulo="meses"
          colunas={[
            { id: 'mes', titulo: 'Mês', largura: '120px', ordenar: (a, b) => a.chave.localeCompare(b.chave), celula: m => <span className="ui-cel-forte">{m.mes}</span> },
            { id: 'total', titulo: 'Total', ordenar: (a, b) => a.total - b.total, celula: m => <Barra valor={m.total} max={maxMes} cor="#162a1e" texto={num(m.total)} /> },
            { id: 'real', titulo: 'Realizadas', alinhar: 'dir', ordenar: (a, b) => a.realizada - b.realizada, celula: m => <span className="ui-cel-num ui-cel-forte">{m.realizada}</span> },
            { id: 'agend', titulo: 'Agendadas', alinhar: 'dir', ocultar: 'celular', celula: m => <span className="ui-cel-num">{m.agendada}</span> },
            { id: 'canc', titulo: 'Canceladas', alinhar: 'dir', ocultar: 'celular', celula: m => <span className="ui-cel-num">{m.cancelada}</span> },
            { id: 'conc', titulo: 'Conclusão', alinhar: 'dir', celula: m => <span className="ui-cel-num">{pctTxt(div(m.realizada, m.realizada + m.agendada))}</span> },
          ]} />
      </Secao>

      <Secao titulo="Lista de visitas" sub="Todas as visitas do período, com os filtros aplicados">
        <Tabela linhas={visitas} chave={v => v.id} carregando={carregando} rotulo="visitas" href={v => `/admin/visitas/${v.id}`}
          acoes={v => [
            { rotulo: 'Abrir visita', icone: 'ver', href: `/admin/visitas/${v.id}` },
            { rotulo: 'Editar', icone: 'editar', href: `/admin/visitas/${v.id}/editar` },
          ]} reiniciar={`${filtros.dataInicio}|${filtros.dataFim}|${filtros.funcionarioId}`}
          destaque={v => statusDe(v) === 'atrasada'}
          colunas={[
            { id: 'data', titulo: 'Data', largura: '110px', ordenar: (a, b) => a.data_visita.localeCompare(b.data_visita), celula: v => <span className="ui-cel-num ui-cel-forte">{dataBR(v.data_visita)}</span> },
            { id: 'cliente', titulo: 'Cliente', ordenar: (a, b) => (um(a.cliente)?.nome ?? '').localeCompare(um(b.cliente)?.nome ?? ''),
              celula: v => <div className="ui-cel-txt"><div className="ui-cel-titulo">{um(v.cliente)?.nome ?? 'Cliente removido'}</div>{um(v.cliente)?.nome_fazenda && <div className="ui-cel-sub laranja">{um(v.cliente)!.nome_fazenda}</div>}</div> },
            { id: 'consultor', titulo: 'Consultor', ocultar: 'celular', celula: v => um(v.funcionario)?.nome_completo ?? '—' },
            { id: 'motivo', titulo: 'Motivo', ocultar: 'tablet', celula: v => motivoDe(v) },
            { id: 'status', titulo: 'Status', largura: '110px', ordenar: (a, b) => statusDe(a).localeCompare(statusDe(b)),
              celula: v => { const st = statusDe(v); return <span className={`ui-badge ${st === 'atrasada' ? 'ui-badge-cancelada' : `ui-badge-${st}`}`}>{STATUS_LABEL[st]}</span> } },
          ]} />
      </Secao>
    </>
  )
}

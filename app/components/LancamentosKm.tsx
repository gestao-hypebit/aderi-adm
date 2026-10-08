'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Tabela from '@/app/components/Tabela'

type LinhaKm = { id: string; data: string; funcionario_id: string; km_inicial: number | null; km_final: number | null }
type LinhaAbast = { id: string; data: string; funcionario_id: string; litros: number; valor_total: number; km: number }

export type Lancamento = {
  id: string
  tipo: 'km' | 'abastecimento'
  data: string
  consultor: string
  kmInicial: number | null
  kmFinal: number | null
  rodado: number | null
  litros: number
  valor: number
  kmAbastecimento: number | null
}

export type ResumoKm = { km: number; litros: number; gasto: number; lancamentos: number }

type Props = {
  inicio: string
  fim: string
  funcionarioId?: string       // filtra um consultor (o próprio, no app do consultor)
  mostrarConsultor?: boolean   // coluna "Consultor" (admin)
  versao?: number              // incrementar força recarregar
  onMudou?: () => void         // chamado depois de excluir
  onResumo?: (r: ResumoKm) => void
}

const dataBR = (d: string) => d.split('-').reverse().join('/')
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function IconCar() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 17h14M5 17a2 2 0 0 1-2-2v-2a2 2 0 0 1 .5-1.32L5.5 9a2 2 0 0 1 1.5-.68h10a2 2 0 0 1 1.5.68l2 2.68A2 2 0 0 1 21 13v2a2 2 0 0 1-2 2"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/></svg>
}

export default function LancamentosKm({ inicio, fim, funcionarioId, mostrarConsultor = false, versao = 0, onMudou, onResumo }: Props) {
  const supabase = createClient()
  const [linhas, setLinhas] = useState<Lancamento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [tipo, setTipo] = useState<'todos' | 'km' | 'abastecimento'>('todos')
  const [erro, setErro] = useState('')
  const [recarregar, setRecarregar] = useState(0)

  useEffect(() => {
    const filtro = funcionarioId ? { funcionario_id: funcionarioId } : {}
    // km_diario/abastecimentos referenciam auth.users (não profiles): nomes vêm de uma consulta à parte
    Promise.all([
      supabase.from('km_diario').select('id, data, funcionario_id, km_inicial, km_final').gte('data', inicio).lte('data', fim).match(filtro).order('data', { ascending: false }),
      supabase.from('abastecimentos').select('id, data, funcionario_id, litros, valor_total, km').gte('data', inicio).lte('data', fim).match(filtro).order('data', { ascending: false }),
      mostrarConsultor ? supabase.from('profiles').select('id, nome_completo') : Promise.resolve({ data: [] as { id: string; nome_completo: string | null }[] }),
    ]).then(([{ data: kms }, { data: abasts }, { data: perfis }]) => {
      const nomes = new Map((perfis ?? []).map(p => [p.id, p.nome_completo ?? '—']))
      const lista: Lancamento[] = [
        ...((kms ?? []) as unknown as LinhaKm[]).map(k => ({
          id: k.id, tipo: 'km' as const, data: k.data, consultor: nomes.get(k.funcionario_id) ?? '—',
          kmInicial: k.km_inicial, kmFinal: k.km_final,
          rodado: k.km_inicial != null && k.km_final != null ? Number(k.km_final) - Number(k.km_inicial) : null,
          litros: 0, valor: 0, kmAbastecimento: null,
        })),
        ...((abasts ?? []) as unknown as LinhaAbast[]).map(a => ({
          id: a.id, tipo: 'abastecimento' as const, data: a.data, consultor: nomes.get(a.funcionario_id) ?? '—',
          kmInicial: null, kmFinal: null, rodado: null,
          litros: Number(a.litros) || 0, valor: Number(a.valor_total) || 0, kmAbastecimento: a.km != null ? Number(a.km) : null,
        })),
      ].sort((a, b) => b.data.localeCompare(a.data) || a.tipo.localeCompare(b.tipo))
      setLinhas(lista)
      setCarregando(false)
      onResumo?.({
        km: lista.reduce((s, l) => s + (l.rodado ?? 0), 0),
        litros: lista.reduce((s, l) => s + l.litros, 0),
        gasto: lista.reduce((s, l) => s + l.valor, 0),
        lancamentos: lista.length,
      })
    })
  }, [inicio, fim, funcionarioId, mostrarConsultor, versao, recarregar])

  const exibidas = useMemo(() => (tipo === 'todos' ? linhas : linhas.filter(l => l.tipo === tipo)), [linhas, tipo])

  async function excluirLancamento(l: Lancamento) {
    setErro('')
    const tabela = l.tipo === 'km' ? 'km_diario' : 'abastecimentos'
    const { error, count } = await supabase.from(tabela).delete({ count: 'exact' }).eq('id', l.id)
    if (error || count === 0) { setErro('Não foi possível excluir o lançamento. Verifique se você tem permissão.'); return }
    setRecarregar(r => r + 1)
    onMudou?.()
  }

  const contar = (t: 'km' | 'abastecimento') => linhas.filter(l => l.tipo === t).length

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', flexWrap: 'wrap', marginBottom: '.8rem' }}>
        <div className="ui-segmented" role="tablist" aria-label="Tipo de lançamento">
          <button className={tipo === 'todos' ? 'ativo' : ''} onClick={() => setTipo('todos')}>Todos <span className="ui-count">{carregando ? '·' : linhas.length}</span></button>
          <button className={tipo === 'km' ? 'ativo' : ''} onClick={() => setTipo('km')}>KM do dia <span className="ui-count">{carregando ? '·' : contar('km')}</span></button>
          <button className={tipo === 'abastecimento' ? 'ativo' : ''} onClick={() => setTipo('abastecimento')}>Abastecimentos <span className="ui-count">{carregando ? '·' : contar('abastecimento')}</span></button>
        </div>
      </div>

      {erro && <div className="ui-alert ui-alert-erro">{erro}</div>}

      <Tabela
        linhas={exibidas}
        chave={l => `${l.tipo}-${l.id}`}
        carregando={carregando}
        reiniciar={`${tipo}|${inicio}|${fim}|${funcionarioId ?? ''}`}
        rotulo="lançamentos"
        acoes={l => [
          { rotulo: 'Excluir lançamento', icone: 'excluir', perigo: true, onClick: () => excluirLancamento(l),
            confirmar: {
              titulo: l.tipo === 'km' ? 'Excluir KM do dia?' : 'Excluir abastecimento?', botao: 'Excluir',
              texto: l.tipo === 'km'
                ? <>O KM de {dataBR(l.data)}{mostrarConsultor ? ` de ${l.consultor}` : ''} ({l.kmInicial ?? '—'} → {l.kmFinal ?? 'pendente'}) será apagado. Essa ação não pode ser desfeita.</>
                : <>O abastecimento de {dataBR(l.data)}{mostrarConsultor ? ` de ${l.consultor}` : ''} ({l.litros.toLocaleString('pt-BR')} L · {brl(l.valor)}) será apagado. Essa ação não pode ser desfeita.</>,
            } },
        ]}
        vazio={
          <div className="ui-empty">
            <div className="ui-empty-icon"><IconCar /></div>
            <div className="ui-empty-title">Nenhum lançamento no período</div>
            <div className="ui-empty-text">KM do dia e abastecimentos lançados aparecem aqui.</div>
          </div>
        }
        colunas={[
          { id: 'data', titulo: 'Data', largura: '110px', ordenar: (a, b) => a.data.localeCompare(b.data), celula: l => <span className="ui-cel-num ui-cel-forte">{dataBR(l.data)}</span> },
          ...(mostrarConsultor ? [{ id: 'consultor', titulo: 'Consultor', ordenar: (a: Lancamento, b: Lancamento) => a.consultor.localeCompare(b.consultor),
            celula: (l: Lancamento) => <div className="ui-cel"><span className="ui-avatar ui-avatar-sm">{l.consultor.charAt(0).toUpperCase()}</span><span className="ui-cel-titulo" style={{ fontWeight: 500 }}>{l.consultor}</span></div> }] : []),
          { id: 'tipo', titulo: 'Tipo', largura: '150px', ordenar: (a, b) => a.tipo.localeCompare(b.tipo),
            celula: l => l.tipo === 'km'
              ? <span className={`ui-badge ${l.rodado == null ? 'ui-badge-agendada' : 'ui-badge-neutro'}`}>{l.rodado == null ? 'KM pendente' : 'KM do dia'}</span>
              : <span className="ui-badge ui-badge-realizada">Abastecimento</span> },
          { id: 'detalhe', titulo: 'Detalhe', ocultar: 'celular',
            celula: l => l.tipo === 'km'
              ? <span className="ui-cel-num">{l.kmInicial ?? '—'} → {l.kmFinal ?? 'pendente'}</span>
              : <span className="ui-cel-num">{l.litros.toLocaleString('pt-BR')} L{l.kmAbastecimento != null ? ` · KM ${l.kmAbastecimento.toLocaleString('pt-BR')}` : ''}</span> },
          { id: 'km', titulo: 'KM rodado', alinhar: 'dir', ordenar: (a, b) => (a.rodado ?? -1) - (b.rodado ?? -1),
            celula: l => l.rodado != null ? <span className="ui-cel-num ui-cel-forte">{l.rodado.toLocaleString('pt-BR')} km</span> : <span className="ui-cel-mudo">—</span> },
          { id: 'valor', titulo: 'Valor', alinhar: 'dir', ordenar: (a, b) => a.valor - b.valor,
            celula: l => l.tipo === 'abastecimento' ? <span className="ui-cel-num ui-cel-forte">{brl(l.valor)}</span> : <span className="ui-cel-mudo">—</span> },
        ]}
      />

    </>
  )
}

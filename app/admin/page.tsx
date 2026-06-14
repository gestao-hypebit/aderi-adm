import { createClient } from '@/lib/supabase/server'

// Calcula o primeiro e último dia do mês atual (em formato YYYY-MM-DD)
function rangeMesAtual() {
  const agora = new Date()
  const primeiro = new Date(agora.getFullYear(), agora.getMonth(), 1)
  const ultimo = new Date(agora.getFullYear(), agora.getMonth() + 1, 0)
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  return { inicio: fmt(primeiro), fim: fmt(ultimo) }
}

type Metricas = {
  visitasRealizadas: number
  visitasPrevistas: number
  taxaConclusao: number
  kmRodado: number
  diasPendentesKm: number
  gastoCombustivel: number
  litros: number
  consumoMedio: number | null
}

async function calcularMetricas(supabase: any, funcionarioId: string): Promise<Metricas> {
  const { inicio, fim } = rangeMesAtual()

  // VISITAS do mês
  const { data: visitas } = await supabase
    .from('visitas')
    .select('status')
    .eq('funcionario_id', funcionarioId)
    .gte('data_visita', inicio)
    .lte('data_visita', fim)

  const realizadas = visitas?.filter((v: any) => v.status === 'realizada').length ?? 0
  // previstas = tudo que não foi cancelado
  const previstas = visitas?.filter((v: any) => v.status !== 'cancelada').length ?? 0
  const taxa = previstas > 0 ? Math.round((realizadas / previstas) * 100) : 0

  // KM do mês
  const { data: kmDias } = await supabase
    .from('km_diario')
    .select('km_inicial, km_final')
    .eq('funcionario_id', funcionarioId)
    .gte('data', inicio)
    .lte('data', fim)

  let kmRodado = 0
  let diasPendentes = 0
  kmDias?.forEach((d: any) => {
    if (d.km_inicial != null && d.km_final != null) {
      kmRodado += Number(d.km_final) - Number(d.km_inicial)
    } else if (d.km_inicial != null && d.km_final == null) {
      diasPendentes++
    }
  })

  // ABASTECIMENTO do mês
  const { data: abast } = await supabase
    .from('abastecimentos')
    .select('litros, valor_total')
    .eq('funcionario_id', funcionarioId)
    .gte('data', inicio)
    .lte('data', fim)

  let litros = 0
  let gasto = 0
  abast?.forEach((a: any) => {
    litros += Number(a.litros) || 0
    gasto += Number(a.valor_total) || 0
  })

  const consumoMedio = litros > 0 ? kmRodado / litros : null

  return {
    visitasRealizadas: realizadas,
    visitasPrevistas: previstas,
    taxaConclusao: taxa,
    kmRodado,
    diasPendentesKm: diasPendentes,
    gastoCombustivel: gasto,
    litros,
    consumoMedio,
  }
}

export default async function AdminPage() {
  const supabase = await createClient()

  // Busca os colaboradores
  const { data: colaboradores } = await supabase
    .from('profiles')
    .select('id, nome_completo')
    .eq('role', 'colaborador')
    .order('nome_completo')

  // Calcula métricas de cada um
  const dados = await Promise.all(
    (colaboradores ?? []).map(async (c) => ({
      ...c,
      metricas: await calcularMetricas(supabase, c.id),
    }))
  )

  const nomeMes = new Date().toLocaleDateString('pt-BR', { month: 'long' })

  return (
    <div style={{ padding: '2rem', fontFamily: 'Comfortaa, sans-serif', background: '#f0ede8', minHeight: '100vh' }}>
      <h1 style={{ color: '#162a1e', fontSize: '1.6rem', marginBottom: '0.3rem' }}>
        Painel do Administrador
      </h1>
      <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '2rem' }}>
        Visão geral de {nomeMes} · {dados.length} colaborador(es)
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(dados.length, 1)}, 1fr)`, gap: '1.5rem' }}>
        {dados.map((c) => (
          <ColaboradorCard key={c.id} nome={c.nome_completo} m={c.metricas} />
        ))}
      </div>

      {dados.length === 0 && (
        <p style={{ color: '#888' }}>Nenhum colaborador cadastrado ainda.</p>
      )}
    </div>
  )
}

function ColaboradorCard({ nome, m }: { nome: string | null; m: Metricas }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e1d8', borderRadius: '16px', padding: '1.5rem' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          background: '#162a1e', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: '1.2rem',
        }}>
          {nome?.charAt(0).toUpperCase() ?? '?'}
        </div>
        <div style={{ color: '#162a1e', fontWeight: 700, fontSize: '1.1rem' }}>
          {nome ?? 'Sem nome'}
        </div>
      </div>

      {/* Visitas */}
      <Bloco titulo="Visitas no mês">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#162a1e' }}>
            {m.visitasRealizadas}
          </span>
          <span style={{ color: '#888', fontSize: '0.9rem' }}>
            / {m.visitasPrevistas} previstas
          </span>
        </div>
        <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: m.taxaConclusao >= 70 ? '#162a1e' : '#E67E22' }}>
          {m.taxaConclusao}% de conclusão
        </div>
      </Bloco>

      {/* KM */}
      <Bloco titulo="KM rodado no mês">
        <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#162a1e' }}>
          {m.kmRodado.toLocaleString('pt-BR')} km
        </span>
        {m.diasPendentesKm > 0 && (
          <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: '#E67E22' }}>
            {m.diasPendentesKm} dia(s) com KM pendente
          </div>
        )}
      </Bloco>

      {/* Abastecimento */}
      <Bloco titulo="Abastecimento no mês">
        <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#162a1e' }}>
          R$ {m.gastoCombustivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
        <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: '#888' }}>
          {m.litros.toLocaleString('pt-BR')} litros
          {m.consumoMedio != null && (
            <> · {m.consumoMedio.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km/L</>
          )}
        </div>
      </Bloco>

      {/* Pendências */}
      {m.diasPendentesKm > 0 && (
        <div style={{
          marginTop: '0.5rem', padding: '0.75rem 1rem',
          background: '#fdf3e9', border: '1px solid #f5d9bd', borderRadius: '10px',
          fontSize: '0.8rem', color: '#b5651d',
        }}>
          Atenção: {m.diasPendentesKm} registro(s) de KM em aberto.
        </div>
      )}
    </div>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#aaa', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
        {titulo}
      </div>
      {children}
    </div>
  )
}
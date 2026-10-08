import AcompanhamentoCotacoes from '@/app/components/cotacoes/AcompanhamentoCotacoes'

export default function AcompanhamentoCotacoesConsultor() {
  return <AcompanhamentoCotacoes base="/dashboard/cotacoes" voltar={{ href: '/dashboard/cotacoes', rotulo: 'Cotações' }} />
}

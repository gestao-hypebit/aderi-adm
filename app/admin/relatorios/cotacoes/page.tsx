import AcompanhamentoCotacoes from '@/app/components/cotacoes/AcompanhamentoCotacoes'

export default function AcompanhamentoCotacoesAdmin() {
  return <AcompanhamentoCotacoes base="/admin/cotacoes" voltar={{ href: '/admin/relatorios', rotulo: 'Relatórios' }} />
}

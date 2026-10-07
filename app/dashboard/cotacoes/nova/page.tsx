import { Suspense } from 'react'
import CotacaoEditor from '@/app/components/cotacoes/CotacaoEditor'

export default function NovaCotacaoPage() {
  return (
    <Suspense fallback={null}>
      <CotacaoEditor base="/dashboard/cotacoes" />
    </Suspense>
  )
}

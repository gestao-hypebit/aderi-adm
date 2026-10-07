'use client'

import { useParams } from 'next/navigation'
import CotacaoEditor from '@/app/components/cotacoes/CotacaoEditor'

export default function CotacaoPage() {
  const { id } = useParams<{ id: string }>()
  return <CotacaoEditor key={id} cotacaoId={id} base="/admin/cotacoes" />
}

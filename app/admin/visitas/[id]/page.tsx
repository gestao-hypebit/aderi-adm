'use client'

import { useParams } from 'next/navigation'
import VisitaDetalhe from '@/app/components/visitas/VisitaDetalhe'

export default function VisitaDetalheAdmin() {
  const { id } = useParams<{ id: string }>()
  return <VisitaDetalhe key={id} visitaId={id} base="/admin" admin />
}

'use client'

import { Suspense } from 'react'
import { useParams } from 'next/navigation'
import VisitaForm from '../../VisitaForm'

export default function EditarVisitaAdminPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <Suspense fallback={null}>
      <VisitaForm visitaId={id} />
    </Suspense>
  )
}

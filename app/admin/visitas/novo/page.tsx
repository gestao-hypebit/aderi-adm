import { Suspense } from 'react'
import VisitaForm from '../VisitaForm'

export default function NovaVisitaAdminPage() {
  return (
    <Suspense fallback={null}>
      <VisitaForm />
    </Suspense>
  )
}

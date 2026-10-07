'use client'

import { useParams } from 'next/navigation'
import ConsultorForm from '../../ConsultorForm'

export default function AdminEditarConsultorPage() {
  const { id } = useParams<{ id: string }>()
  return <ConsultorForm consultorId={id} />
}

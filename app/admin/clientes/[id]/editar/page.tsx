'use client'

import { useParams } from 'next/navigation'
import ClienteForm from '../../ClienteForm'

export default function AdminEditarClientePage() {
  const { id } = useParams<{ id: string }>()
  return <ClienteForm clienteId={id} />
}

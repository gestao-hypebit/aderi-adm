'use client'

import { useParams } from 'next/navigation'
import ClienteForm from '@/app/components/clientes/ClienteForm'

export default function AdminEditarClientePage() {
  const { id } = useParams<{ id: string }>()
  return <ClienteForm clienteId={id} base="/admin/clientes" admin />
}

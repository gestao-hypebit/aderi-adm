'use client'

import { useParams } from 'next/navigation'
import ClienteFicha from '@/app/components/clientes/ClienteFicha'

export default function AdminClienteDetalhe() {
  const { id } = useParams<{ id: string }>()
  return <ClienteFicha key={id} clienteId={id} base="/admin/clientes" admin />
}

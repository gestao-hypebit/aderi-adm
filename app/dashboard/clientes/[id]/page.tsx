'use client'

import { useParams } from 'next/navigation'
import ClienteFicha from '@/app/components/clientes/ClienteFicha'

export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>()
  return <ClienteFicha key={id} clienteId={id} base="/dashboard/clientes" admin={false} />
}

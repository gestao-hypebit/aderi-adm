'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import FiltrosPainel, { type Filtros } from '@/app/components/FiltrosPainel'

type Props = {
  clientes: { id: string; nome: string }[]
  funcionarios: { id: string; nome_completo: string }[]
  inicio: string
  fim: string
  funcionarioId: string
}

export default function AdminFiltersBar({ clientes, funcionarios, inicio, fim, funcionarioId }: Props) {
  const router = useRouter()

  const value: Filtros = {
    dataInicio: inicio,
    dataFim: fim,
    clienteId: '',
    funcionarioId,
  }

  function handleChange(f: Filtros) {
    const params = new URLSearchParams()
    params.set('inicio', f.dataInicio)
    params.set('fim', f.dataFim)
    if (f.funcionarioId) params.set('func', f.funcionarioId)
    router.push(`/admin?${params.toString()}`)
  }

  return (
    <FiltrosPainel
      value={value}
      onChange={handleChange}
      showFuncionario
      clientes={clientes}
      funcionarios={funcionarios}
    />
  )
}

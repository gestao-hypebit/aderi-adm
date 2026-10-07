'use client'

import { Suspense } from 'react'
import Agenda from '@/app/components/agenda/Agenda'

export default function AgendamentoPage() {
  return <Suspense fallback={null}><Agenda admin={false} base="/dashboard" /></Suspense>
}

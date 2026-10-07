'use client'

import { Suspense } from 'react'
import Agenda from '@/app/components/agenda/Agenda'

export default function AdminAgendaPage() {
  return <Suspense fallback={null}><Agenda admin base="/admin" /></Suspense>
}

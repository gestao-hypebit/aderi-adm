import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = req.nextUrl
  const inicio = url.searchParams.get('inicio') ?? ''
  const fim = url.searchParams.get('fim') ?? ''
  const funcionarioId = url.searchParams.get('funcionarioId') ?? ''

  let kmQuery = supabase
    .from('km_diario')
    .select('funcionario_id, data, km_inicial, km_final')
    .gte('data', inicio)
    .lte('data', fim)
  let abastQuery = supabase
    .from('abastecimentos')
    .select('funcionario_id, data, litros, valor_total')
    .gte('data', inicio)
    .lte('data', fim)

  if (funcionarioId) {
    kmQuery = kmQuery.eq('funcionario_id', funcionarioId)
    abastQuery = abastQuery.eq('funcionario_id', funcionarioId)
  }

  const [{ data: kmData }, { data: abastData }] = await Promise.all([kmQuery, abastQuery])
  return NextResponse.json({ kmData: kmData ?? [], abastData: abastData ?? [] })
}

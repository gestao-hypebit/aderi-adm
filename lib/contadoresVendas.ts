'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Contadores do menu: o que está esperando alguém agir em cada fase.
// O consultor só enxerga as próprias cotações (RLS), o admin enxerga todas.
export type Contadores = { aprovacoes: number; orcamentos: number }

export function useContadoresVendas(atualizarQuando: unknown) {
  const [c, setC] = useState<Contadores>({ aprovacoes: 0, orcamentos: 0 })
  useEffect(() => {
    const supabase = createClient()
    async function carregar() {
      const { data: cfg } = await supabase.from('configuracoes').select('dias_followup').eq('id', 1).maybeSingle()
      const limite = new Date(Date.now() - (cfg?.dias_followup ?? 3) * 86400000).toISOString()
      const [ag, ap, env] = await Promise.all([
        supabase.from('cotacoes').select('id', { count: 'exact', head: true }).eq('status', 'rascunho').eq('aprovacao_status', 'pendente'),
        supabase.from('cotacoes').select('id', { count: 'exact', head: true }).eq('status', 'aprovada'),
        supabase.from('cotacoes').select('id', { count: 'exact', head: true }).eq('status', 'enviada').lt('enviada_em', limite),
      ])
      setC({ aprovacoes: ag.count ?? 0, orcamentos: (ap.count ?? 0) + (env.count ?? 0) })
    }
    carregar()
  }, [atualizarQuando])
  return c
}

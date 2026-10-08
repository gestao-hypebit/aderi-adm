import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import DocumentoPublico from '@/app/components/DocumentoPublico'
import RelatorioVisitaConteudo, { type VisitaPublica } from '@/app/components/visitas/RelatorioVisitaConteudo'

// Relatório da visita para o produtor — aberto pelo link enviado no WhatsApp, sem login.

export const metadata: Metadata = { title: 'Relatório de visita · Aderi Agro', robots: { index: false } }

export default async function RelatorioVisitaPublico({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const { data } = /^[0-9a-f-]{36}$/i.test(token) ? await supabase.rpc('visita_publica', { token }) : { data: null }
  const v = data as VisitaPublica | null

  if (!v) {
    return <DocumentoPublico titulo="Relatório não encontrado"><div style={{ padding: '3rem 0', textAlign: 'center', color: '#8f978f' }}>Relatório não encontrado. Confira o link recebido.</div></DocumentoPublico>
  }

  return (
    <DocumentoPublico titulo="Relatório de visita">
      <RelatorioVisitaConteudo v={v} />
    </DocumentoPublico>
  )
}

import { createClient } from '@/lib/supabase/server'
import RelatorioKmContent from '@/app/components/relatorios/RelatorioKmContent'

export default async function AdminRelatorioKmPage() {
  const supabase = await createClient()
  const { data: funcionarios } = await supabase
    .from('profiles')
    .select('id, nome_completo')
    .eq('role', 'colaborador')
    .order('nome_completo')
  return (
    <RelatorioKmContent
      isAdmin={true}
      backUrl="/admin/relatorios"
      funcionariosIniciais={funcionarios ?? []}
    />
  )
}

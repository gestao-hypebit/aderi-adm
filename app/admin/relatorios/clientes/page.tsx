import { createClient } from '@/lib/supabase/server'
import RelatorioClientesContent from '@/app/components/relatorios/RelatorioClientesContent'

export default async function AdminRelatorioClientesPage() {
  const supabase = await createClient()
  const [{ data: clientes }, { data: funcionarios }] = await Promise.all([
    supabase
      .from('clientes')
      .select('id, nome, cidade, estado, nome_fazenda, cultura_principal')
      .order('nome'),
    supabase
      .from('profiles')
      .select('id, nome_completo')
      .eq('role', 'colaborador')
      .order('nome_completo'),
  ])
  return (
    <RelatorioClientesContent
      isAdmin={true}
      backUrl="/admin/relatorios"
      clientesIniciais={clientes ?? []}
      funcionariosIniciais={funcionarios ?? []}
    />
  )
}

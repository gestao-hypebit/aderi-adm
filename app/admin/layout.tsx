import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminMenu from './AdminMenu'
import { telaInicial } from '@/lib/permissoes'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // '*' para continuar funcionando antes de a coluna permissoes existir no banco
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' || profile?.ativo === false) {
    redirect('/dashboard')
  }

  // A rota de cada tela é conferida no proxy.ts; aqui o menu recebe o que mostrar
  const permissoes: string[] | null = profile.permissoes ?? null

  return (
    <AdminMenu permissoes={permissoes}>
      {telaInicial(profile) ? children : (
        <div className="ui-card ui-card-pad" style={{ maxWidth: 520 }}>
          <div className="ui-card-title" style={{ marginBottom: '.5rem' }}>Nenhuma tela liberada</div>
          <div className="ui-hint">Seu usuário ainda não tem acesso a nenhuma tela. Fale com o administrador.</div>
        </div>
      )}
    </AdminMenu>
  )
}

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { podeRota, telaInicial } from '@/lib/permissoes'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  const rotasPublicas = ['/login', '/cadastro', '/nova-senha']

  // Não logado tentando acessar área protegida
  if (!user && (path.startsWith('/dashboard') || path.startsWith('/imprimir') || path.startsWith('/admin'))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Usuário desativado pelo admin: encerra a sessão
  if (user && path.startsWith('/dashboard')) {
    const { data: perfil } = await supabase.from('profiles').select('ativo').eq('id', user.id).single()
    if (perfil?.ativo === false) {
      await supabase.auth.signOut()
      const resposta = NextResponse.redirect(new URL('/login', request.url))
      supabaseResponse.cookies.getAll().forEach(c => resposta.cookies.set(c))
      return resposta
    }
  }

  // Acesso personalizado: só as telas liberadas no cadastro do usuário.
  // ('*' para continuar funcionando antes de a coluna permissoes existir no banco)
  if (user && path.startsWith('/admin')) {
    const { data: perfil } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (perfil?.role === 'admin' && perfil.ativo !== false && !podeRota(perfil, path)) {
      const destino = telaInicial(perfil)
      // sem nenhuma tela liberada o layout mostra o aviso
      if (destino && destino !== path) {
        const resposta = NextResponse.redirect(new URL(destino, request.url))
        supabaseResponse.cookies.getAll().forEach(c => resposta.cookies.set(c))
        return resposta
      }
    }
  }

  // Logado tentando acessar rotas públicas
  if (user && rotasPublicas.includes(path)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/dashboard/:path*', '/imprimir/:path*', '/login', '/cadastro', '/nova-senha'],
}
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
  if (!user && (path.startsWith('/dashboard') || path.startsWith('/imprimir'))) {
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

  // Logado tentando acessar rotas públicas
  if (user && rotasPublicas.includes(path)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/dashboard/:path*', '/imprimir/:path*', '/login', '/cadastro', '/nova-senha'],
}
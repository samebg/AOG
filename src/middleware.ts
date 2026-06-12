import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// The auth gate. This runs before every page request: it rebuilds the user's
// Supabase session from the request cookies and, if no one is signed in,
// redirects them to /login. It also forwards any refreshed auth cookies onto
// the response so sessions stay alive. API routes are excluded by the matcher
// below — they do their own auth check and return 401 instead of redirecting.
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !request.nextUrl.pathname.startsWith('/login') && 
      !request.nextUrl.pathname.startsWith('/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

// Which paths the middleware runs on: everything EXCEPT Next.js static files,
// images, the favicon, and /api routes (those handle auth themselves).
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
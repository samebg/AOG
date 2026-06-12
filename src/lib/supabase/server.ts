import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Creates the Supabase client for SERVER code (API routes and server
// components). It reads the user's session from the request cookies, which is
// how a route answers "who is making this request?" via auth.getUser().
// The setAll is wrapped in try/catch because server components are not allowed
// to write cookies — only route handlers and middleware can — and we don't
// want a refreshed token write to crash a page render.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
import { createBrowserClient } from '@supabase/ssr'

// Creates the Supabase client for BROWSER code ('use client' components).
// It uses the public anon key, so it can only do what Row Level Security
// allows for the signed-in user. Use this in pages; never in API routes
// (those use lib/supabase/server.ts instead).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
// The raw Supabase client (not the cookie-based one)

// Creates a Supabase client using the SERVICE ROLE key.
// This key bypasses Row Level Security and can do anything, so it must ONLY ever
// be used in server-side code (route handlers, cron jobs) and NEVER sent to the browser.
// We use it for privileged operations like award_xp that we've locked away from
// regular users. Always verify WHO the user is with the normal cookie client first,
// then use this client to perform the trusted write for that verified user.
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

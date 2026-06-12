// src/app/api/admin/route.ts
//
// What this file does, plain English:
// The home screen runs in the browser, but the admin's email lives in a
// server-only secret (ADMIN_EMAIL) that the browser must never see. So the
// browser asks this endpoint "am I the admin?" and gets back a simple yes/no.
// The page uses that to show or hide the admin-only "The Teacher" button.
//
// This is only for showing UI. The real protection still lives on /teacher and
// the /api/teacher/* routes, which each check admin status themselves.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'

// Returns { isAdmin } for the signed-in user (false if not signed in).
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return NextResponse.json({ isAdmin: isAdmin(user?.email) })
}

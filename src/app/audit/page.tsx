// src/app/audit/page.tsx
//
// What this file does, plain English:
// This is the admin-only front door for the "night-shift librarian" dashboard.
// It's a SERVER component, so the admin check runs on the server before any page
// HTML is sent — a normal user can't slip past it from the browser. The real
// enforcement also lives on /api/audit; this page is just the door. The actual
// dashboard is the AuditDashboard client component, mounted only for the admin.

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import AuditDashboard from './AuditDashboard'

// Checks who's asking, turns away non-admins, and renders the dashboard for the
// admin.
export default async function AuditPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Not signed in at all → send to login (matches the rest of the app).
  if (!user) redirect('/login')

  // Signed in, but not the admin → show a plain "not authorized" notice.
  if (!isAdmin(user.email)) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <div>
          <p className="text-5xl mb-3">🔒</p>
          <h1 className="text-lg font-medium text-stone-200">Not authorized</h1>
          <p className="mt-1 text-sm text-stone-500">
            The highlight audit is restricted to the administrator.
          </p>
        </div>
      </div>
    )
  }

  return <AuditDashboard />
}

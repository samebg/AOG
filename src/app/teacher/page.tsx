// src/app/teacher/page.tsx
//
// What this file does, plain English:
// This is the admin-only "The Teacher" page, where the admin will chat with the
// AI to add new verses to the database. This file is a SERVER component: the
// admin check runs on the server before any page HTML is sent, so a normal user
// can't bypass it by fiddling with the browser. The real enforcement still lives
// on the API routes (added in later steps) — this page is the front door.
//
// For Step 1 it only proves the gate works: non-admins are turned away, the
// admin sees a placeholder. The chat UI gets added in Step 2.

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import TeacherChat from './TeacherChat'

export default async function TeacherPage() {
  // Who is asking? Read the real session on the server.
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
            The Teacher is restricted to the administrator.
          </p>
        </div>
      </div>
    )
  }

  // The admin — placeholder for now; the chat UI arrives in Step 2.
  return (
    <div className="min-h-screen max-w-2xl mx-auto px-4 py-8 text-white">
      <h1 className="text-xl font-semibold">The Teacher</h1>
      <p className="mt-1 text-sm text-stone-400">
        Admin verse authoring. Chat to add new verses to the database.
      </p>
      <TeacherChat />
    </div>
  )
}

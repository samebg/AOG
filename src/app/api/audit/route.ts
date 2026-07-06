// src/app/api/audit/route.ts
//
// What this file does, plain English:
// This is the endpoint behind the "night-shift librarian" dashboard. It is
// ADMIN-ONLY, because it reads across every user's highlights (a maintenance
// tool, not a per-user feature).
//   - GET  runs the read-only scan and returns the report. It writes nothing.
//   - POST applies ONLY the mechanical formatting fixes and returns how many it
//     changed plus a fresh report.
// All the actual logic lives in src/lib/audit.ts.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdmin } from '@/lib/admin'
import {
  auditHighlights,
  applyFormatFixes,
  applyTextFixes,
  removeDuplicates,
} from '@/lib/audit'

// A scan can touch a lot of rows, so give it a little extra time budget.
export const maxDuration = 60

// Shared gate: only the signed-in admin may run the audit. Returns the service
// client to use, or an error response to return immediately.
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!isAdmin(user.email)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { service: createServiceClient() }
}

// GET /api/audit — scan and report (read-only).
export async function GET() {
  try {
    const gate = await requireAdmin()
    if (gate.error) return gate.error
    const report = await auditHighlights(gate.service)
    return NextResponse.json(report)
  } catch (err) {
    console.error('Audit scan failed:', err)
    return NextResponse.json({ error: 'Audit scan failed' }, { status: 500 })
  }
}

// POST /api/audit — apply one fix action, then return how many rows changed and
// a fresh report. The action is required so each fix is a deliberate request:
//   'format'     → clean old-format references
//   'text'       → overwrite mismatched text with the verified verse text
//   'duplicates' → delete the later copies, keeping the earliest save
export async function POST(request: NextRequest) {
  try {
    const gate = await requireAdmin()
    if (gate.error) return gate.error

    const { action } = await request.json().catch(() => ({ action: undefined }))

    let changed = 0
    if (action === 'format') changed = await applyFormatFixes(gate.service)
    else if (action === 'text') changed = await applyTextFixes(gate.service)
    else if (action === 'duplicates') changed = await removeDuplicates(gate.service)
    else return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

    const report = await auditHighlights(gate.service)
    return NextResponse.json({ action, changed, report })
  } catch (err) {
    console.error('Audit fix failed:', err)
    return NextResponse.json({ error: 'Audit fix failed' }, { status: 500 })
  }
}

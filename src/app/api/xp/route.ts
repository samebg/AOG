import { NextRequest, NextResponse } from 'next/server'
// Tools to handle incoming requests and send responses

import { createClient } from '@/lib/supabase/server'
// Cookie-based client — used to find out WHO is making the request

import { createServiceClient } from '@/lib/supabase/service'
// Service-role client — the only thing allowed to run award_xp

// The amount of XP for each action is decided HERE on the server, never trusted
// from the request body. The client only tells us WHICH action happened (the reason);
// we look up how much that's worth. This stops anyone sending { amount: 999999 }.
const XP_BY_REASON: Record<string, number> = {
  chat_session: 25,
  highlight_verse: 15,
}

// POST /api/xp — awards XP to the logged-in user for a known action
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { reason } = await request.json()
    const amount = XP_BY_REASON[reason]

    // Reject anything that isn't a known, server-approved action
    if (!amount) {
      return NextResponse.json({ error: 'Unknown reason' }, { status: 400 })
    }

    // award_xp is locked so only the service role can run it
    const service = createServiceClient()
    const { data, error } = await service.rpc('award_xp', {
      p_user_id: user.id,
      p_amount: amount,
      p_reason: reason,
    })
    if (error) throw error

    return NextResponse.json({ newXP: data.xp, level: data.level })
  } catch {
    return NextResponse.json({ error: 'Failed to award XP' }, { status: 500 })
  }
}

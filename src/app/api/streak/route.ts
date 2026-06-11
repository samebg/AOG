import { NextResponse } from 'next/server'
// Tool to send HTTP responses

import { createClient } from '@/lib/supabase/server'
// Creates a Supabase connection on the server (uses cookies for auth)

import { createServiceClient } from '@/lib/supabase/service'
// Service-role client — the only thing allowed to run award_xp

// POST /api/streak — called once on each app open
// Awards 50 XP for the first open of each new day, and increments the streak counter
// Uses award_xp so the level is always recalculated correctly (fixing the old bug
// where streak XP was added but the level was never updated)
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('last_open_date, streak_count')
      .eq('id', user.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 404 })

    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    // Already opened today — nothing to do
    if (profile.last_open_date === today) {
      return NextResponse.json({ awarded: false, streak: profile.streak_count })
    }

    const newStreak = profile.last_open_date === yesterday
      ? profile.streak_count + 1
      : 1

    // Update streak + last open date
    await supabase
      .from('profiles')
      .update({ last_open_date: today, streak_count: newStreak })
      .eq('id', user.id)

    // Award XP via the centralized function — this also updates current_level.
    // award_xp is locked to the service role, so we call it with the service client.
    const service = createServiceClient()
    const { data } = await service.rpc('award_xp', {
      p_user_id: user.id,
      p_amount: 50,
      p_reason: 'daily_login',
    })

    return NextResponse.json({
      awarded: true,
      streak: newStreak,
      xpAwarded: 50,
      newXP: data?.xp,
    })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

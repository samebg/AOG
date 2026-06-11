import { NextRequest, NextResponse } from 'next/server'
// Tools to handle incoming HTTP requests and send responses

import { createClient } from '@/lib/supabase/server'
// Creates a Supabase connection on the server side (uses cookies for auth)

import { createServiceClient } from '@/lib/supabase/service'
// Service-role client — the only thing allowed to run award_xp

import { EMOTION_IDS } from '@/lib/emotions'
// The list of valid emotion ids — we reject anything not in this list

// POST /api/mood — saves the user's emotion for today
// The UNIQUE(user_id, date) constraint in the DB prevents double XP:
// if they already checked in today, we return alreadyCheckedIn: true without awarding XP
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { emotion } = await request.json()

    // Only allow a known emotion id — never trust the client to send a valid value
    if (!EMOTION_IDS.includes(emotion)) {
      return NextResponse.json({ error: 'Invalid emotion' }, { status: 400 })
    }

    const today = new Date().toISOString().split('T')[0]

    const { error } = await supabase
      .from('mood_checkins')
      .insert({ user_id: user.id, date: today, emotion })

    // Postgres error 23505 = unique constraint violation = already checked in today
    if (error?.code === '23505') {
      return NextResponse.json({ alreadyCheckedIn: true })
    }

    if (error) throw error

    // First check-in today — award XP via the centralized DB function.
    // award_xp is locked to the service role, so we call it with the service client.
    const service = createServiceClient()
    await service.rpc('award_xp', {
      p_user_id: user.id,
      p_amount: 10,
      p_reason: 'emotion_checkin',
    })

    return NextResponse.json({ alreadyCheckedIn: false, xpAwarded: 10 })
  } catch {
    return NextResponse.json({ error: 'Failed to save mood' }, { status: 500 })
  }
}

// GET /api/mood — returns the user's emotion for today (or null if not checked in yet)
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const today = new Date().toISOString().split('T')[0]

    const { data } = await supabase
      .from('mood_checkins')
      .select('emotion')
      .eq('user_id', user.id)
      .eq('date', today)
      .single()

    return NextResponse.json({ emotion: data?.emotion ?? null })
  } catch {
    return NextResponse.json({ error: 'Failed to get mood' }, { status: 500 })
  }
}

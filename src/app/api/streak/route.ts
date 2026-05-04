import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('last_open_date, streak_count, total_xp, current_level')
      .eq('id', user.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 404 })

    const today = new Date().toISOString().split('T')[0]
    const last = profile.last_open_date
    const isNewDay = last !== today
    const isConsecutive = last === new Date(
      Date.now() - 86400000).toISOString().split('T')[0]

    if (!isNewDay) {
      return NextResponse.json({ 
        awarded: false, 
        streak: profile.streak_count,
        xp: profile.total_xp 
      })
    }

    const newStreak = isConsecutive ? profile.streak_count + 1 : 1
    const xpGain = 50
    const newXP = profile.total_xp + xpGain

    await supabase.from('profiles').update({
      last_open_date: today,
      streak_count: newStreak,
      total_xp: newXP,
    }).eq('id', user.id)

    await supabase.from('xp_log').insert({
      user_id: user.id,
      amount: xpGain,
      reason: 'daily_login'
    })

    return NextResponse.json({ 
      awarded: true, streak: newStreak, xpGain, newXP 
    })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
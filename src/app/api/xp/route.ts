import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getLevelFromXP } from '@/lib/xp'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { amount, reason } = await request.json()

    await supabase.from('xp_log').insert({ 
      user_id: user.id, amount, reason 
    })

    const { data: profile } = await supabase
      .from('profiles')
      .select('total_xp')
      .eq('id', user.id)
      .single()

    const newXP = (profile?.total_xp || 0) + amount
    const { current } = getLevelFromXP(newXP)

    await supabase
      .from('profiles')
      .update({ total_xp: newXP, current_level: current.level })
      .eq('id', user.id)

    return NextResponse.json({ newXP, level: current.level })
  } catch {
    return NextResponse.json({ error: 'Failed to award XP' }, { status: 500 })
  }
}
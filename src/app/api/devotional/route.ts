// src/app/api/devotional/route.ts
//
// What this file does, plain English:
// 1. User hits this endpoint
// 2. We look up their saved highlights from Supabase
// 3. We check if they already have a devotional generated TODAY
//    - If yes: return it immediately (no wasted API calls)
//    - If no: send highlights to Claude, get a devotional back, save it
// 4. Return the devotional to the frontend

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic()

export async function GET() {
    try {
        // Step 1: Figure out who is asking
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Step 2: Check if we already made a devotional today
        // This is important — we don't want to call Claude every time the tab loads
        // "today" = whatever date it is in ISO format, e.g. "2025-05-05"
        const today = new Date().toISOString().split('T')[0]

        const { data: existing } = await supabase
            .from('devotionals')           // we'll create this table below
            .select('*')
            .eq('user_id', user.id)
            .eq('date', today)
            .single()

        // If one already exists for today, just return it — no Claude call needed
        if (existing) {
            return NextResponse.json({ devotional: existing })
        }

        // Step 3: Load their highlights from Supabase
        // We grab the 10 most recent ones — enough for Claude to see a pattern
        // but not so many that we blow up our token count
        const { data: highlights } = await supabase
            .from('highlights')
            .select('verse_reference, verse_text, color, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10)

        // If they have no highlights yet, return a gentle default message
        if (!highlights || highlights.length === 0) {
            return NextResponse.json({
                devotional: {
                    theme: 'Welcome',
                    reflection: 'Start highlighting verses that speak to you. As you save more, this page will generate a personalized devotional based on what God is putting on your heart.',
                    prayer: 'Lord, guide me to the words I need today.',
                    verse_focus: null,
                    generated: false
                }
            })
        }

        // Step 4: Format the highlights into a readable list for Claude
        // We're turning the database rows into plain text Claude can understand
        const highlightSummary = highlights.map((h, i) =>
            `${i + 1}. ${h.verse_reference}: "${h.verse_text}"`
        ).join('\n')

        // Step 5: Call Claude — this is the agentic part
        // We give Claude the highlights and ask it to:
        //   - Find the emotional/spiritual theme
        //   - Write a short reflection
        //   - Write a closing prayer
        //   - Tell us which verse to focus on
        // We ask for JSON so the frontend can display each piece separately
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 600,
            messages: [
                {
                    role: 'user',
                    content: `You are a thoughtful Christian devotional writer.

A user has saved these Bible verses recently. Study the pattern — what themes, emotions, or spiritual needs keep showing up?

${highlightSummary}

Based on these highlights, write a personalized daily devotional. Return ONLY valid JSON, no markdown, no extra text. Use this exact shape:

{
  "theme": "2-4 word theme title (e.g. Finding Rest, Trusting God's Plan)",
  "reflection": "A warm, personal 3-4 sentence reflection based on the pattern you see in their verses. Speak directly to them using 'you'. Keep it under 80 words.",
  "prayer": "A short closing prayer (2-3 sentences) that captures the heart of what they've been seeking. Under 40 words.",
  "verse_focus": "The single verse reference that best captures today's theme (e.g. Philippians 4:6)"
}`
                }
            ]
        })

        // Step 6: Parse Claude's response
        // Claude was told to return JSON — we extract and parse it
        const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'

        let parsed
        try {
            parsed = JSON.parse(raw)
        } catch {
            // If Claude's JSON is malformed for some reason, return a fallback
            return NextResponse.json({
                devotional: {
                    theme: 'Daily Reflection',
                    reflection: 'God is speaking through the verses you have been drawn to. Return tomorrow for a fresh word.',
                    prayer: 'Lord, open my eyes to what you are showing me. Amen.',
                    verse_focus: null,
                    generated: false
                }
            })
        }

        // Step 7
        const { data: saved, error: insertError } = await supabase
            .from('devotionals')
            .insert({
                user_id: user.id,
                date: today,
                theme: parsed.theme,
                reflection: parsed.reflection,
                prayer: parsed.prayer,
                verse_focus: parsed.verse_focus,
                highlight_count: highlights.length,
            })
            .select()
            .single()

        // NOW you can see exactly what's going wrong
        console.log('Insert error:', insertError)
        console.log('Saved:', saved)
        console.log('Claude returned:', raw)

        if (insertError) {
            // Table doesn't exist, RLS blocking it, or unique constraint hit
            // Still return the devotional so the user sees something
            return NextResponse.json({
                devotional: { ...parsed, highlight_count: highlights.length },
                xpAwarded: 20
            })
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('total_xp')
            .eq('id', user.id)
            .single()

        const newXP = (profile?.total_xp || 0) + 20

        await supabase
            .from('profiles')
            .update({ total_xp: newXP })
            .eq('id', user.id)

        await supabase.from('xp_log').insert({
            user_id: user.id,
            amount: 20,
            reason: 'devotional_read'
        })

        return NextResponse.json({ devotional: saved, xpAwarded: 20 })

        console.log('Claude returned:', raw)

    } catch (error) {
        console.error('Devotional generation error:', error)
        return NextResponse.json(
            { error: 'Failed to generate devotional' },
            { status: 500 }
        )
    }
}
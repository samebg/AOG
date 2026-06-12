// src/app/api/chat/route.ts
//
// What this file does, plain English:
// This is the live chat endpoint — the RAG pipeline in production. Each
// message goes through five steps: (1) crisis keyword check before any AI,
// (2) retrieve the 3 closest real verses from our database by meaning,
// (3) build a system prompt that includes those verses, (4) ask Claude to
// respond building on them, (5) verify the verses the answer cites actually
// exist in our verified table. The pipeline functions themselves live in
// src/lib/rag.ts so the eval can measure this exact same code.

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { detectCrisis } from '@/lib/xp'
import { createServiceClient } from '@/lib/supabase/service'
import {
  retrieveVerses,
  buildGroundedSystem,
  checkGrounding,
  type RetrievedVerse,
} from '@/lib/rag'
import { stripMarkdown } from '@/lib/text'

const anthropic = new Anthropic()
const openai = new OpenAI()

// The fixed response for crisis messages. Hardcoded on purpose — when someone
// may be in danger, the only right answer is real human help lines, not an
// AI-generated reply.
const CRISIS_RESPONSE = `I hear that you're going through something really heavy right now. You don't have to carry this alone.

Please reach out to someone who can help:
**988 Suicide & Crisis Lifeline** — call or text 988 (US)
**Crisis Text Line** — text HOME to 741741

You matter. God has not forgotten you.`

// POST /api/chat — takes the conversation so far, runs the 5-step pipeline
// described above, and returns the reply plus everything the UI needs to show
// its work: crisis flag, grounded flag, matched verses, and retrieved verses.
export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json()
    const lastMessage = messages[messages.length - 1]?.content || ''

    // 1. Safety first — a crisis never reaches the model.
    if (detectCrisis(lastMessage)) {
      return NextResponse.json({
        response: CRISIS_RESPONSE,
        crisis: true,
        grounded: false,
        matched_verses: [],
        retrieved: [],
      })
    }

    // One service client, shared by retrieval and the grounding check.
    const supabase = createServiceClient()

    // 2. Retrieve real verses related to what the user said.
    //    If retrieval fails, we fall back to no context rather than break the chat.
    let retrieved: RetrievedVerse[] = []
    try {
      retrieved = await retrieveVerses(supabase, openai, lastMessage)
    } catch (err) {
      console.error('Verse retrieval failed:', err)
    }

    console.log(
      'Retrieved verses:',
      retrieved.map(v => `${v.reference} (${v.similarity.toFixed(3)})`)
    )

    // 3. Call Claude with the grounded system prompt (base instructions + verses).
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: buildGroundedSystem(retrieved),
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : ''

    // 4. Strip markdown for clean display.
    const text = stripMarkdown(raw)

    // 5. Grounding check — did the reply cite verses that exist in our DB?
    //    Wrapped so a failure here never breaks the chat response.
    let grounded = false
    let matched_verses: string[] = []
    try {
      const result = await checkGrounding(supabase, text)
      grounded = result.grounded
      matched_verses = result.matched
      console.log('Grounding check:', result)
    } catch (err) {
      console.error('Grounding check failed:', err)
    }

    return NextResponse.json({ response: text, crisis: false, grounded, matched_verses, retrieved })
  } catch {
    return NextResponse.json({ error: 'Failed to get response' }, { status: 500 })
  }
}

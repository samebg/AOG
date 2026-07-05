// src/app/api/chat/route.ts
//
// What this file does, plain English:
// This is the live chat endpoint — the RAG pipeline in production. Each message
// goes through: (1) a crisis keyword check before any AI, (2) retrieve the 3
// closest real verses from our database by meaning, (3) build a system prompt
// that includes those verses, (4) ask Claude to respond building on them, and
// (5) verify the verses the answer cites actually exist in our verified table.
//
// Claude also has ONE tool here: save_verse. When the user clearly asks to save
// a verse (e.g. "save that one for me"), Claude calls it, and the SERVER looks up
// the real text, files it into the user's highlights, and awards XP — the same
// reward a normal highlight gives. Because a tool call needs a follow-up, this
// runs a small BOUNDED loop: ask Claude → run any tool it asks for → feed the
// result back → repeat, up to a few rounds. The pipeline functions themselves
// live in src/lib/rag.ts so the eval can measure this exact same code.

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { detectCrisis, XP_REWARDS, HIGHLIGHT_COLORS } from '@/lib/xp'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  retrieveVerses,
  buildGroundedSystem,
  checkGrounding,
  type RetrievedVerse,
} from '@/lib/rag'
import { stripMarkdown } from '@/lib/text'
import { fetchVerseText } from '@/lib/bible'
import { parseReference, formatReference } from '@/lib/books'
import type { SupabaseClient } from '@supabase/supabase-js'

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

// Extra instructions appended to the grounded system prompt: how and WHEN Claude
// may use the save tool. The guardrail — only on an explicit request — lives here.
const SAVE_INSTRUCTION = `You can save a Bible verse to the user's personal highlights using the save_verse tool.
- Only call save_verse when the user clearly asks to save, keep, or bookmark a verse. Never save one unprompted.
- Pass a full reference like "Philippians 4:6".
- After it is saved, briefly confirm to the user which verse you saved.`

// The one tool Claude has in chat: save a verse the user asked to keep.
const SAVE_VERSE_TOOL: Anthropic.Tool = {
  name: 'save_verse',
  description:
    "Save a Bible verse to the signed-in user's highlights. Only use when the user explicitly asks to save/keep/bookmark a verse.",
  input_schema: {
    type: 'object',
    properties: {
      reference: {
        type: 'string',
        description: 'The scripture reference to save, e.g. "Philippians 4:6".',
      },
    },
    required: ['reference'],
  },
}

const MAX_ROUNDS = 3 // safety cap so the tool loop can never run forever

// Does the actual save for one save_verse tool call: look up the real text,
// skip if the user already has it, insert the highlight, and award XP. Returns a
// short sentence describing what happened, which we hand back to Claude as the
// tool result so it can confirm to the user.
async function saveVerse(
  supabase: SupabaseClient,
  userId: string,
  reference: string
): Promise<{ message: string; savedRef: string | null }> {
  // Turn the reference into a clean full-name form and a navigable location.
  const cleanRef = formatReference(reference)
  const loc = parseReference(cleanRef)
  if (!loc) {
    return { message: `Couldn't recognize the reference "${reference}".`, savedRef: null }
  }

  // Fetch the real verse text (server-side, same helper The Teacher uses).
  const text = await fetchVerseText(cleanRef)
  if (!text) {
    return { message: `Couldn't find the text for "${cleanRef}".`, savedRef: null }
  }

  // Don't save the same verse twice for this user.
  const { data: existing } = await supabase
    .from('highlights')
    .select('id')
    .eq('user_id', userId)
    .eq('verse_reference', cleanRef)
    .maybeSingle()
  if (existing) {
    return { message: `${cleanRef} is already in the user's highlights.`, savedRef: null }
  }

  // Insert the highlight, using Gold (the always-unlocked color) as the default.
  const { error } = await supabase.from('highlights').insert({
    user_id: userId,
    verse_id: `${loc.bookId}.${loc.chapter}.${loc.verse}`,
    verse_reference: cleanRef,
    verse_text: text,
    color: HIGHLIGHT_COLORS[0].hex,
  })
  if (error) {
    console.error('save_verse insert failed:', error)
    return { message: `Something went wrong saving "${cleanRef}".`, savedRef: null }
  }

  // Award XP the same way every other highlight does (service-role RPC).
  await supabase.rpc('award_xp', {
    p_user_id: userId,
    p_amount: XP_REWARDS.HIGHLIGHT_VERSE,
    p_reason: 'highlight_verse',
  })

  return { message: `Saved ${cleanRef} to the user's highlights.`, savedRef: cleanRef }
}

// POST /api/chat — takes the conversation so far, runs the pipeline described
// above, and returns the reply plus everything the UI needs to show its work:
// crisis flag, grounded flag, matched verses, retrieved verses, and any verses
// saved this turn.
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
        saved: [],
      })
    }

    // Who is asking? Needed so a saved verse lands in the right user's highlights.
    const cookieClient = await createClient()
    const { data: { user } } = await cookieClient.auth.getUser()

    // One service client, shared by retrieval, grounding, and any saves.
    const supabase = createServiceClient()

    // 2. Retrieve real verses related to what the user said.
    //    If retrieval fails, we fall back to no context rather than break the chat.
    let retrieved: RetrievedVerse[] = []
    try {
      retrieved = await retrieveVerses(supabase, openai, lastMessage)
    } catch (err) {
      console.error('Verse retrieval failed:', err)
    }

    // 3. Build the grounded system prompt (base instructions + verses + save rule).
    const system = `${buildGroundedSystem(retrieved)}\n\n${SAVE_INSTRUCTION}`

    // The working transcript Claude sees, seeded from the client's plain messages.
    const working: Anthropic.MessageParam[] = messages.map(
      (m: { role: string; content: string }) => ({ role: m.role, content: m.content })
    )

    // References saved during this turn, so the UI can flash a confirmation.
    const saved: string[] = []

    // 4. The bounded tool loop: ask Claude, answer any save_verse calls, repeat
    //    until Claude produces its final plain-text reply.
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        system,
        tools: [SAVE_VERSE_TOOL],
        messages: working,
      })

      const toolUses = response.content.filter(b => b.type === 'tool_use')

      // No tool requested → this is Claude's reply. Finish the pipeline.
      if (toolUses.length === 0) {
        const textBlock = response.content.find(b => b.type === 'text')
        const raw = textBlock && textBlock.type === 'text' ? textBlock.text : ''
        const text = stripMarkdown(raw)

        // 5. Grounding check — did the reply cite verses that exist in our DB?
        let grounded = false
        let matched_verses: string[] = []
        try {
          const result = await checkGrounding(supabase, text)
          grounded = result.grounded
          matched_verses = result.matched
        } catch (err) {
          console.error('Grounding check failed:', err)
        }

        return NextResponse.json({
          response: text,
          crisis: false,
          grounded,
          matched_verses,
          retrieved,
          saved,
        })
      }

      // Record Claude's turn, then answer every tool it called.
      working.push({ role: 'assistant', content: response.content })

      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const tu of toolUses) {
        if (tu.type !== 'tool_use' || tu.name !== 'save_verse') continue
        const reference = (tu.input as { reference: string }).reference

        // Only a signed-in user can have highlights saved.
        const result = user
          ? await saveVerse(supabase, user.id, reference)
          : { message: 'The user is not signed in, so nothing was saved.', savedRef: null }

        if (result.savedRef) saved.push(result.savedRef)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: result.message,
        })
      }

      working.push({ role: 'user', content: toolResults })
      // Loop again so Claude can confirm the save to the user.
    }

    // Safety fallback if we somehow hit the round cap without a final reply.
    return NextResponse.json({
      response: saved.length
        ? `Saved ${saved.join(', ')} to your highlights.`
        : "Sorry, I couldn't finish that. Please try again.",
      crisis: false,
      grounded: false,
      matched_verses: [],
      retrieved,
      saved,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to get response' }, { status: 500 })
  }
}

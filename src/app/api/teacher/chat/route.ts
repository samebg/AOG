// src/app/api/teacher/chat/route.ts
//
// What this file does, plain English:
// This is the admin-only chat brain for "The Teacher". The admin usually just
// names a verse (e.g. "2 Timothy 4:18"). Claude has two tools:
//   - lookup_verse: the SERVER fetches that verse's NKJV text from API.Bible, so
//     the admin never has to type scripture.
//   - propose_verse: once Claude has the reference, the (confirmed) text, and a
//     category, it hands them back as a structured proposal for the admin to
//     review and save.
//
// Because Claude may need several tool steps (look up, then propose), this runs a
// small BOUNDED loop: call Claude → run any tool it asks for → feed the result
// back → repeat, up to a few rounds. This route never writes to the database; it
// only talks, looks up text, and extracts. It is admin-gated.

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import { stripMarkdown } from '@/lib/text'
import { fetchVerseText } from '@/lib/bible'

const anthropic = new Anthropic()

// The structured proposal Claude extracts. All three fields are required.
interface VerseProposal {
  reference: string
  text: string
  category: string
}

// Instructions for the verse-authoring assistant. The Bible is NKJV, the admin
// is the authority, and scripture must never be paraphrased.
const TEACHER_SYSTEM = `You are a verse-authoring assistant for the admin of a scripture app. The app uses the NKJV translation.

The admin usually just names a reference, like "2 Timothy 4:18".
- When they name a reference, call lookup_verse to fetch the exact NKJV text. Never ask them to type the verse out, and never quote it from memory.
- Show the fetched text back to them and ask them to double-check it looks right (mention it's NKJV).
- Also collect a short category (e.g. "hope", "perseverance", "forgiveness"). Ask for it if they haven't given one.
- When you call propose_verse, use the EXACT text returned by lookup_verse. Never paraphrase or "correct" scripture.
- If lookup_verse can't find the verse, tell the admin and ask them to fix the reference or paste the text themselves.
- Only call propose_verse once you have the reference, the confirmed text, and a category.

Keep replies short and friendly.`

// Tool 1 — the server fetches the verse's NKJV text from API.Bible.
const LOOKUP_VERSE_TOOL: Anthropic.Tool = {
  name: 'lookup_verse',
  description:
    'Fetch the exact NKJV text for a Bible reference from the verse database. Use this whenever the admin names a reference instead of typing the text.',
  input_schema: {
    type: 'object',
    properties: {
      reference: { type: 'string', description: 'Scripture reference, e.g. "2 Timothy 4:18".' },
    },
    required: ['reference'],
  },
}

// Tool 2 — capture the finalized verse for the admin to confirm (no side effects).
const PROPOSE_VERSE_TOOL: Anthropic.Tool = {
  name: 'propose_verse',
  description:
    'Capture a finalized verse for the admin to confirm. Only call once you have the reference, the exact (looked-up) text, and a category.',
  input_schema: {
    type: 'object',
    properties: {
      reference: { type: 'string', description: 'Scripture reference, e.g. "John 3:16".' },
      text: { type: 'string', description: 'The exact NKJV verse text from lookup_verse.' },
      category: { type: 'string', description: 'A short topical category, e.g. "hope".' },
    },
    required: ['reference', 'text', 'category'],
  },
}

const TOOLS = [LOOKUP_VERSE_TOOL, PROPOSE_VERSE_TOOL]
const MAX_ROUNDS = 5 // safety cap so the tool loop can never run forever

// POST /api/teacher/chat — runs the admin's conversation through Claude with
// the two tools, answering tool calls until Claude produces a plain reply.
// Returns { reply, proposal } — proposal is null until one is ready.
export async function POST(request: NextRequest) {
  try {
    // 1. Gate: only the admin may use The Teacher.
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdmin(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // 2. The client sends plain text only; we build the working transcript from it.
    const { messages } = await request.json()
    const working: Anthropic.MessageParam[] = messages.map(
      (m: { role: string; content: string }) => ({ role: m.role, content: m.content })
    )

    // 3. The bounded tool loop.
    let proposal: VerseProposal | null = null

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const resp = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        system: TEACHER_SYSTEM,
        tools: TOOLS,
        messages: working,
      })

      const toolUses = resp.content.filter(b => b.type === 'tool_use')

      // No tools requested → this is Claude's reply to the admin. We're done.
      if (toolUses.length === 0) {
        const textBlock = resp.content.find(b => b.type === 'text')
        return NextResponse.json({
          reply: textBlock && textBlock.type === 'text' ? stripMarkdown(textBlock.text) : '',
          proposal,
        })
      }

      // Record Claude's turn, then answer every tool it called.
      working.push({ role: 'assistant', content: resp.content })

      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const tu of toolUses) {
        if (tu.type !== 'tool_use') continue

        if (tu.name === 'lookup_verse') {
          const ref = (tu.input as { reference: string }).reference
          const text = await fetchVerseText(ref)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: text
              ? `NKJV text for ${ref}: "${text}"`
              : `Could not find "${ref}". Ask the admin to fix the reference or paste the text.`,
          })
        } else if (tu.name === 'propose_verse') {
          proposal = tu.input as VerseProposal
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: 'Proposal shown to the admin for review and confirmation.',
          })
        }
      }

      working.push({ role: 'user', content: toolResults })
      // Loop again so Claude can react to the tool results (ask a question or
      // produce a closing line after proposing).
    }

    // Safety fallback if we somehow hit the round cap.
    return NextResponse.json({
      reply: "Here's what I have so far — review and confirm below.",
      proposal,
    })
  } catch (err) {
    console.error('Teacher chat failed:', err)
    return NextResponse.json({ error: 'Teacher chat failed' }, { status: 500 })
  }
}

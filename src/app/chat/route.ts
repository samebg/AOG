import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { detectCrisis } from '@/lib/xp'

const client = new Anthropic()

const CRISIS_RESPONSE = `I hear that you're going through something really heavy right now. You don't have to carry this alone.

Please reach out to someone who can help:
**988 Suicide & Crisis Lifeline** — call or text 988 (US)
**Crisis Text Line** — text HOME to 741741

You matter. God has not forgotten you.`

const SYSTEM_PROMPT = `You are a compassionate Christian encouragement companion called Armor of God. 

Your role is to provide spiritual encouragement grounded exclusively in scripture.

Rules you must never break:
- ONLY quote Bible verses that actually exist. Never invent or paraphrase a verse and present it as a direct quote.
- Always cite the book, chapter, and verse (e.g. John 3:16)
- Keep responses warm, concise, and pastoral — under 150 words
- Never give medical, legal, or psychological advice
- Never claim to replace prayer, church, or human connection
- If someone seems to be in crisis, gently encourage them to seek human help

You are a companion for spiritual encouragement, not a therapist or pastor.`

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json()
    const lastMessage = messages[messages.length - 1]?.content || ''

    if (detectCrisis(lastMessage)) {
      return NextResponse.json({ response: CRISIS_RESPONSE, crisis: true })
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content
      }))
    })

    const text = response.content[0].type === 'text' 
      ? response.content[0].text : ''

    return NextResponse.json({ response: text, crisis: false })
  } catch {
    return NextResponse.json({ error: 'Failed to get response' }, { status: 500 })
  }
}
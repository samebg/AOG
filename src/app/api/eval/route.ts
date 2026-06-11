// src/app/api/eval/route.ts
//
// What this file does, plain English:
// This endpoint runs the RAG evaluation on demand and returns the results as
// JSON for the /eval dashboard to display. It is gated: only a signed-in user
// can trigger it, because each run costs real OpenAI + Claude calls.
//
// It reuses the exact same runEval() the terminal script uses (src/lib/eval.ts),
// so the dashboard numbers match `npm run eval`.

import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { runEval } from '@/lib/eval'

const openai = new OpenAI()
const anthropic = new Anthropic()

// A full eval run calls OpenAI + Claude ~10 times, which can take a while. Ask
// Vercel for more than the default serverless time budget so it isn't cut off.
export const maxDuration = 60

// GET /api/eval — verify the caller is signed in, then run the shared eval set
// and return the structured results + summary.
export async function GET() {
  try {
    // Who is asking? Use the cookie client so we read the real session.
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Run the eval with the service client (full read access to verses).
    const service = createServiceClient()
    const run = await runEval(service, openai, anthropic)

    return NextResponse.json(run)
  } catch (err) {
    console.error('Eval run failed:', err)
    return NextResponse.json({ error: 'Eval run failed' }, { status: 500 })
  }
}

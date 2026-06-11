import { NextResponse } from 'next/server'
// This is a one-time admin endpoint — hit it once after running the SQL migration
// to fetch the actual verse text from API.Bible and fill the verses table.
// It is protected by a secret header so only you can run it.

import { createServiceClient } from '@/lib/supabase/service'

const BIBLE_API_BASE = 'https://rest.api.bible/v1/bibles'

// Fetches text for a single verse (e.g. "ISA.41.10")
async function fetchSingleVerse(passageId: string): Promise<string> {
  const res = await fetch(
    `${BIBLE_API_BASE}/${process.env.BIBLE_ID}/verses/${passageId}?content-type=text&include-verse-numbers=false`,
    { headers: { 'api-key': process.env.BIBLE_API_KEY! } }
  )
  const json = await res.json()
  return (json.data?.content ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

// Fetches text for a verse range (e.g. "PSA.56.3-PSA.56.4")
async function fetchPassage(passageId: string): Promise<string> {
  const res = await fetch(
    `${BIBLE_API_BASE}/${process.env.BIBLE_ID}/passages/${passageId}?content-type=text&include-verse-numbers=false`,
    { headers: { 'api-key': process.env.BIBLE_API_KEY! } }
  )
  const json = await res.json()
  return (json.data?.content ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

// Waits a given number of milliseconds — used to avoid hitting API.Bible rate limits
function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function GET(request: Request) {
  // Protect this endpoint — only requests with the right secret header can run it
  const secret = request.headers.get('x-seed-secret')
  if (secret !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Use the service client so this admin job can read/write verses regardless of RLS
  const supabase = createServiceClient()

  // Get all verses that don't have text yet
  const { data: verses, error } = await supabase
    .from('verses')
    .select('id, passage_id, reference')
    .is('text', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!verses || verses.length === 0) {
    return NextResponse.json({ message: 'All verses already have text.' })
  }

  const results: { reference: string; ok: boolean; error?: string }[] = []

  for (const verse of verses) {
    try {
      // A hyphen in the passage_id means it's a multi-verse range
      const isRange = verse.passage_id.includes('-')
      const text = isRange
        ? await fetchPassage(verse.passage_id)
        : await fetchSingleVerse(verse.passage_id)

      if (!text) throw new Error('Empty response from API.Bible')

      await supabase
        .from('verses')
        .update({ text })
        .eq('id', verse.id)

      results.push({ reference: verse.reference, ok: true })
    } catch (err) {
      results.push({ reference: verse.reference, ok: false, error: String(err) })
    }

    // 300ms pause between calls to stay within API.Bible rate limits
    await wait(300)
  }

  const failed = results.filter(r => !r.ok)
  return NextResponse.json({
    total: verses.length,
    success: results.filter(r => r.ok).length,
    failed: failed.length,
    failures: failed,
  })
}

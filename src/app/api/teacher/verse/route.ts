// src/app/api/teacher/verse/route.ts
//
// What this file does, plain English:
// This is the ONLY place The Teacher writes to the database. The admin has
// reviewed a proposed verse (reference, text, category) and pressed Confirm.
// This route checks the admin is who they say, makes sure nothing is empty,
// figures out the verse's API.Bible id (passage_id) from its reference, refuses
// duplicates, turns the text into an embedding, and saves the new verse — at
// which point the live RAG chat can immediately retrieve it.
//
// It is admin-gated: a non-admin gets 403 even if they POST here directly.

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdmin } from '@/lib/admin'
import { parseReference } from '@/lib/books'

const openai = new OpenAI()

// POST /api/teacher/verse — validates the confirmed proposal, refuses
// duplicates, embeds the text, and inserts the new verse into the database.
export async function POST(request: NextRequest) {
  try {
    // 1. Gate: only the admin may add verses.
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdmin(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // 2. Read and trim the three fields.
    const body = await request.json()
    const reference = (body.reference ?? '').trim()
    const text = (body.text ?? '').trim()
    const category = (body.category ?? '').trim()

    // 3. None of the three may be empty.
    if (!reference || !text || !category) {
      return NextResponse.json(
        { error: 'reference, text, and category are all required and cannot be empty.' },
        { status: 400 }
      )
    }

    // 4. Turn the reference into a passage_id (e.g. "Galatians 6:9" → "GAL.6.9").
    //    If we can't recognize the book, refuse rather than save a broken verse —
    //    the home screen uses passage_id when a user highlights a verse.
    const loc = parseReference(reference)
    if (!loc) {
      return NextResponse.json(
        { error: `Couldn't recognize the reference "${reference}". Please use a form like "John 3:16".` },
        { status: 400 }
      )
    }
    const passageId = `${loc.bookId}.${loc.chapter}.${loc.verse}`

    // 5. Refuse duplicates — one row per passage_id.
    const service = createServiceClient()
    const { data: existing } = await service
      .from('verses')
      .select('id')
      .eq('passage_id', passageId)
      .maybeSingle()
    if (existing) {
      return NextResponse.json(
        { error: `${reference} is already in the database.`, duplicate: true },
        { status: 409 }
      )
    }

    // 6. Embed the verse text so RAG can find it by meaning. We store the text
    //    form "[0.1, ...]" (via JSON.stringify), exactly like the backfill script.
    const embeddingRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    })
    const embedding = JSON.stringify(embeddingRes.data[0].embedding)

    // 7. Insert the finished verse.
    const { error: insertError } = await service.from('verses').insert({
      passage_id: passageId,
      reference,
      text,
      category,
      embedding,
    })
    if (insertError) {
      console.error('Verse insert failed:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, reference, passage_id: passageId })
  } catch (err) {
    console.error('Teacher verse save failed:', err)
    return NextResponse.json({ error: 'Failed to save verse' }, { status: 500 })
  }
}

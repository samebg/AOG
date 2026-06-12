// src/app/api/transcribe/route.ts
//
// What this file does, plain English:
// The Teacher's microphone sends a short audio recording here. We pass it to
// OpenAI's Whisper speech-to-text model and return the transcribed words, which
// the chat box then fills in. This lets the admin add verses by speaking instead
// of typing. It is admin-gated like the rest of The Teacher.

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'

const openai = new OpenAI()

// POST /api/transcribe — accepts an audio file (form data), checks the caller
// is the admin, and returns Whisper's transcription as { text }.
export async function POST(request: NextRequest) {
  try {
    // 1. Gate: only the admin may transcribe.
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdmin(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // 2. Pull the uploaded audio clip out of the form data.
    const form = await request.formData()
    const audio = form.get('audio')
    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'No audio file provided.' }, { status: 400 })
    }

    // 3. Hand the clip to Whisper and return the text it heard.
    const transcription = await openai.audio.transcriptions.create({
      file: audio,
      model: 'whisper-1',
    })

    return NextResponse.json({ text: transcription.text })
  } catch (err) {
    console.error('Transcription failed:', err)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }
}

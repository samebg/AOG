// src/app/api/bible/verse/route.ts
//
// What this file does, plain English:
// A small pass-through to API.Bible for ONE verse. The browser can't call
// API.Bible directly because that would expose our API key — so the client
// asks this route instead, and the key stays on the server.

import { NextRequest, NextResponse } from 'next/server'

// GET /api/bible/verse?verseId=PHP.4.6 — fetches that verse from API.Bible
// and returns its JSON unchanged.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const verseId = searchParams.get('verseId')

  if (!verseId) {
    return NextResponse.json({ error: 'verseId required' }, { status: 400 })
  }

  try {
    const response = await fetch(
      `https://rest.api.bible/v1/bibles/${process.env.BIBLE_ID}/verses/${verseId}?content-type=text&include-verse-numbers=false`,
      {
        headers: { 'api-key': process.env.BIBLE_API_KEY! },
      }
    )

    if (!response.ok) {
      throw new Error(`API.Bible error: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Bible API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch verse' },
      { status: 500 }
    )
  }
}
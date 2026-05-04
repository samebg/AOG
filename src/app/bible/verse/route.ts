import { NextRequest, NextResponse } from 'next/server'

const BIBLE_API_BASE = 'https://api.scripture.api.bible/v1'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const verseId = searchParams.get('verseId')

  if (!verseId) {
    return NextResponse.json({ error: 'verseId required' }, { status: 400 })
  }

  try {
    const response = await fetch(
      `${BIBLE_API_BASE}/bibles/${process.env.BIBLE_ID}/verses/${verseId}?content-type=text&include-verse-numbers=false`,
      {
        headers: {
          'api-key': process.env.BIBLE_API_KEY!,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`API.Bible error: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch verse' },
      { status: 500 }
    )
  }
}
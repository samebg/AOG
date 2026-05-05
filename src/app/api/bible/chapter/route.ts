import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const bookId = searchParams.get('bookId')
  const chapter = searchParams.get('chapter')

  if (!bookId || !chapter) {
    return NextResponse.json({ error: 'bookId and chapter required' }, { status: 400 })
  }

  try {
    const chapterId = `${bookId}.${chapter}`

    const response = await fetch(
      `https://rest.api.bible/v1/bibles/${process.env.BIBLE_ID}/chapters/${chapterId}/verses?content-type=text&include-verse-numbers=false`,
      {
        headers: { 'api-key': process.env.BIBLE_API_KEY! },
      }
    )

    if (!response.ok) {
      throw new Error(`API.Bible error: ${response.status}`)
    }

    const data = await response.json()

    const verses = await Promise.all(
      data.data.map(async (v: { id: string; reference: string }) => {
        const verseRes = await fetch(
          `https://rest.api.bible/v1/bibles/${process.env.BIBLE_ID}/verses/${v.id}?content-type=text&include-verse-numbers=false`,
          {
            headers: { 'api-key': process.env.BIBLE_API_KEY! },
          }
        )
        const verseData = await verseRes.json()
        return {
          id: v.id,
          reference: v.reference,
          content: verseData.data?.content
            ?.replace(/<[^>]*>/g, '')
            .trim() || '',
        }
      })
    )

    return NextResponse.json({ verses })
  } catch (error) {
    console.error('Chapter fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chapter' },
      { status: 500 }
    )
  }
}
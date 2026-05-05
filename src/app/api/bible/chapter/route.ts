import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const bookId = searchParams.get('bookId')
  const chapter = searchParams.get('chapter')

  if (!bookId || !chapter) {
    return NextResponse.json(
      { error: 'bookId and chapter required' },
      { status: 400 }
    )
  }

  try {
    const chapterId = `${bookId}.${chapter}`
    console.log('Fetching chapter:', chapterId)

    const response = await fetch(
      `https://rest.api.bible/v1/bibles/${process.env.BIBLE_ID}/chapters/${chapterId}?content-type=text&include-verse-numbers=true&include-titles=false`,
      {
        headers: { 'api-key': process.env.BIBLE_API_KEY! },
      }
    )

    console.log('Chapter API status:', response.status)

    if (!response.ok) {
      throw new Error(`API.Bible error: ${response.status}`)
    }

    const data = await response.json()
    console.log('Chapter data keys:', Object.keys(data?.data || {}))

    const rawContent = data.data?.content || ''

    const cleaned = rawContent
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    const versePattern = /\[(\d+)\]\s*([\s\S]*?)(?=\[\d+\]|$)/g
    const verses = []
    let match

    while ((match = versePattern.exec(cleaned)) !== null) {
      const verseNum = match[1]
      const verseText = match[2].trim()
      if (verseText) {
        verses.push({
          id: `${chapterId}.${verseNum}`,
          reference: `${bookId} ${chapter}:${verseNum}`,
          content: verseText,
        })
      }
    }

    console.log('Parsed verses count:', verses.length)

    return NextResponse.json({ verses })
  } catch (error) {
    console.error('Chapter fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chapter' },
      { status: 500 }
    )
  }
}
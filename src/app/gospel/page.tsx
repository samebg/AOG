'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getUnlockedColors } from '@/lib/xp'

const BOOKS = [
  { id: 'GEN', name: 'Genesis', testament: 'OT', chapters: 50 },
  { id: 'EXO', name: 'Exodus', testament: 'OT', chapters: 40 },
  { id: 'LEV', name: 'Leviticus', testament: 'OT', chapters: 27 },
  { id: 'NUM', name: 'Numbers', testament: 'OT', chapters: 36 },
  { id: 'DEU', name: 'Deuteronomy', testament: 'OT', chapters: 34 },
  { id: 'JOS', name: 'Joshua', testament: 'OT', chapters: 24 },
  { id: 'JDG', name: 'Judges', testament: 'OT', chapters: 21 },
  { id: 'RUT', name: 'Ruth', testament: 'OT', chapters: 4 },
  { id: '1SA', name: '1 Samuel', testament: 'OT', chapters: 31 },
  { id: '2SA', name: '2 Samuel', testament: 'OT', chapters: 24 },
  { id: '1KI', name: '1 Kings', testament: 'OT', chapters: 22 },
  { id: '2KI', name: '2 Kings', testament: 'OT', chapters: 25 },
  { id: '1CH', name: '1 Chronicles', testament: 'OT', chapters: 29 },
  { id: '2CH', name: '2 Chronicles', testament: 'OT', chapters: 36 },
  { id: 'EZR', name: 'Ezra', testament: 'OT', chapters: 10 },
  { id: 'NEH', name: 'Nehemiah', testament: 'OT', chapters: 13 },
  { id: 'EST', name: 'Esther', testament: 'OT', chapters: 10 },
  { id: 'JOB', name: 'Job', testament: 'OT', chapters: 42 },
  { id: 'PSA', name: 'Psalms', testament: 'OT', chapters: 150 },
  { id: 'PRO', name: 'Proverbs', testament: 'OT', chapters: 31 },
  { id: 'ECC', name: 'Ecclesiastes', testament: 'OT', chapters: 12 },
  { id: 'SNG', name: 'Song of Songs', testament: 'OT', chapters: 8 },
  { id: 'ISA', name: 'Isaiah', testament: 'OT', chapters: 66 },
  { id: 'JER', name: 'Jeremiah', testament: 'OT', chapters: 52 },
  { id: 'LAM', name: 'Lamentations', testament: 'OT', chapters: 5 },
  { id: 'EZK', name: 'Ezekiel', testament: 'OT', chapters: 48 },
  { id: 'DAN', name: 'Daniel', testament: 'OT', chapters: 12 },
  { id: 'HOS', name: 'Hosea', testament: 'OT', chapters: 14 },
  { id: 'JOL', name: 'Joel', testament: 'OT', chapters: 3 },
  { id: 'AMO', name: 'Amos', testament: 'OT', chapters: 9 },
  { id: 'OBA', name: 'Obadiah', testament: 'OT', chapters: 1 },
  { id: 'JON', name: 'Jonah', testament: 'OT', chapters: 4 },
  { id: 'MIC', name: 'Micah', testament: 'OT', chapters: 7 },
  { id: 'NAM', name: 'Nahum', testament: 'OT', chapters: 3 },
  { id: 'HAB', name: 'Habakkuk', testament: 'OT', chapters: 3 },
  { id: 'ZEP', name: 'Zephaniah', testament: 'OT', chapters: 3 },
  { id: 'HAG', name: 'Haggai', testament: 'OT', chapters: 2 },
  { id: 'ZEC', name: 'Zechariah', testament: 'OT', chapters: 14 },
  { id: 'MAL', name: 'Malachi', testament: 'OT', chapters: 4 },
  { id: 'MAT', name: 'Matthew', testament: 'NT', chapters: 28 },
  { id: 'MRK', name: 'Mark', testament: 'NT', chapters: 16 },
  { id: 'LUK', name: 'Luke', testament: 'NT', chapters: 24 },
  { id: 'JHN', name: 'John', testament: 'NT', chapters: 21 },
  { id: 'ACT', name: 'Acts', testament: 'NT', chapters: 28 },
  { id: 'ROM', name: 'Romans', testament: 'NT', chapters: 16 },
  { id: '1CO', name: '1 Corinthians', testament: 'NT', chapters: 16 },
  { id: '2CO', name: '2 Corinthians', testament: 'NT', chapters: 13 },
  { id: 'GAL', name: 'Galatians', testament: 'NT', chapters: 6 },
  { id: 'EPH', name: 'Ephesians', testament: 'NT', chapters: 6 },
  { id: 'PHP', name: 'Philippians', testament: 'NT', chapters: 4 },
  { id: 'COL', name: 'Colossians', testament: 'NT', chapters: 4 },
  { id: '1TH', name: '1 Thessalonians', testament: 'NT', chapters: 5 },
  { id: '2TH', name: '2 Thessalonians', testament: 'NT', chapters: 3 },
  { id: '1TI', name: '1 Timothy', testament: 'NT', chapters: 6 },
  { id: '2TI', name: '2 Timothy', testament: 'NT', chapters: 4 },
  { id: 'TIT', name: 'Titus', testament: 'NT', chapters: 3 },
  { id: 'PHM', name: 'Philemon', testament: 'NT', chapters: 1 },
  { id: 'HEB', name: 'Hebrews', testament: 'NT', chapters: 13 },
  { id: 'JAS', name: 'James', testament: 'NT', chapters: 5 },
  { id: '1PE', name: '1 Peter', testament: 'NT', chapters: 5 },
  { id: '2PE', name: '2 Peter', testament: 'NT', chapters: 3 },
  { id: '1JN', name: '1 John', testament: 'NT', chapters: 5 },
  { id: '2JN', name: '2 John', testament: 'NT', chapters: 1 },
  { id: '3JN', name: '3 John', testament: 'NT', chapters: 1 },
  { id: 'JUD', name: 'Jude', testament: 'NT', chapters: 1 },
  { id: 'REV', name: 'Revelation', testament: 'NT', chapters: 22 },
]

interface Verse {
  id: string
  reference: string
  content: string
}

export default function GospelPage() {
  const [selectedBook, setSelectedBook] = useState<typeof BOOKS[0] | null>(null)
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null)
  const [verses, setVerses] = useState<Verse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [highlightedVerses, setHighlightedVerses] = useState<Set<string>>(new Set())
  const [userLevel, setUserLevel] = useState(1)
  const [selectedVerse, setSelectedVerse] = useState<Verse | null>(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [highlightColor, setHighlightColor] = useState('#FBBF24')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadLevel() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('current_level')
        .eq('id', user.id)
        .single()
      if (data) setUserLevel(data.current_level)
    }
    loadLevel()
  }, [])

  const chapterCache: Record<string, { id: string; reference: string; content: string }[]> = {}

  // THEN replace loadChapter with this inside the component where it already lives:
  async function loadChapter(bookId: string, chapter: number) {
    const key = `${bookId}.${chapter}`

    if (chapterCache[key]) {
      setVerses(chapterCache[key])
      return
    }

    setLoading(true)
    setError('')
    setVerses([])
    try {
      const res = await fetch(
        `/api/bible/chapter?bookId=${bookId}&chapter=${chapter}`
      )
      const data = await res.json()
      if (data.error) {
        setError('Could not load chapter. Please try again.')
        return
      }
      chapterCache[key] = data.verses || []
      setVerses(data.verses || [])
    } catch {
      setError('Could not load chapter. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveHighlight(color: string) {
    if (!selectedVerse) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('highlights').insert({
      user_id: user.id,
      verse_id: selectedVerse.id,
      verse_reference: selectedVerse.reference,
      verse_text: selectedVerse.content,
      color,
    })

    await fetch('/api/xp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 15, reason: 'highlight_verse' })
    })

    toggleHighlight(selectedVerse.id)
    setShowColorPicker(false)
    setSelectedVerse(null)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2000)
  }

  function handleBookSelect(book: typeof BOOKS[0]) {
    setSelectedBook(book)
    setSelectedChapter(null)
    setVerses([])
  }

  function handleChapterSelect(chapter: number) {
    setSelectedChapter(chapter)
    if (selectedBook) loadChapter(selectedBook.id, chapter)
  }

  function handleNextChapter() {
    if (!selectedBook || !selectedChapter) return
    if (selectedChapter < selectedBook.chapters) {
      const next = selectedChapter + 1
      setSelectedChapter(next)
      loadChapter(selectedBook.id, next)
      window.scrollTo(0, 0)
    }
  }

  function handlePrevChapter() {
    if (!selectedBook || !selectedChapter) return
    if (selectedChapter > 1) {
      const prev = selectedChapter - 1
      setSelectedChapter(prev)
      loadChapter(selectedBook.id, prev)
      window.scrollTo(0, 0)
    }
  }

  function toggleHighlight(verseId: string) {
    setHighlightedVerses(prev => {
      const next = new Set(prev)
      if (next.has(verseId)) next.delete(verseId)
      else next.add(verseId)
      return next
    })
  }

  function handleBack() {
    if (verses.length > 0) {
      setVerses([])
      setSelectedChapter(null)
    } else if (selectedBook) {
      setSelectedBook(null)
    } else {
      router.push('/')
    }
  }

  const otBooks = BOOKS.filter(b => b.testament === 'OT')
  const ntBooks = BOOKS.filter(b => b.testament === 'NT')
  const unlockedColors = getUnlockedColors(userLevel)

  return (
    <div className="min-h-screen bg-stone-950 text-white max-w-lg mx-auto">

      {/* Success toast */}
      {saveSuccess && (
        <div className="fixed top-6 left-0 right-0 flex justify-center z-50">
          <div className="bg-emerald-900 border border-emerald-700
                          text-emerald-300 text-sm px-4 py-2 rounded-full">
            Saved! +15 XP
          </div>
        </div>
      )}

      {/* Color picker modal */}
      {showColorPicker && selectedVerse && (
        <div className="fixed inset-0 bg-black bg-opacity-70
                        flex items-end justify-center z-40 pb-8 px-5">
          <div className="bg-stone-900 border border-stone-800
                          rounded-2xl p-5 w-full max-w-sm">
            <p className="text-xs text-stone-500 mb-1">
              {selectedVerse.reference}
            </p>
            <p className="text-sm text-stone-300 italic leading-relaxed mb-4">
              "{selectedVerse.content.slice(0, 100)}
              {selectedVerse.content.length > 100 ? '...' : ''}"
            </p>
            <p className="text-xs text-stone-500 mb-3">
              Choose a highlight color
            </p>
            <div className="flex gap-3 mb-5">
              {unlockedColors.map(c => (
                <button
                  key={c.hex}
                  onClick={() => setHighlightColor(c.hex)}
                  className={`w-8 h-8 rounded-full border-2 transition-all
                    ${highlightColor === c.hex
                      ? 'border-white scale-110'
                      : 'border-transparent'}`}
                  style={{ background: c.hex }}
                  title={c.name}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowColorPicker(false)
                  setSelectedVerse(null)
                }}
                className="flex-1 bg-stone-800 text-stone-400 rounded-xl
                           py-3 text-sm hover:bg-stone-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveHighlight(highlightColor)}
                className="flex-1 bg-violet-600 hover:bg-violet-500
                           text-white rounded-xl py-3 text-sm transition-colors"
              >
                Save highlight
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4
                      border-b border-stone-800 sticky top-0 bg-stone-950 z-10">
        <button
          onClick={handleBack}
          className="text-stone-400 hover:text-white transition-colors text-sm"
        >
          ← Back
        </button>
        <h1 className="text-base font-medium flex-1">
          {verses.length > 0 && selectedBook && selectedChapter
            ? `${selectedBook.name} ${selectedChapter}`
            : selectedBook
              ? selectedBook.name
              : 'Bible'}
        </h1>
        {verses.length > 0 && selectedBook && selectedChapter && (
          <span className="text-stone-600 text-xs">
            Ch {selectedChapter} of {selectedBook.chapters}
          </span>
        )}
      </div>

      <div className="px-5 pb-32 pt-4">

        {/* Book selection */}
        {!selectedBook && (
          <>
            <p className="text-stone-500 text-xs uppercase tracking-wider mb-3">
              Old Testament
            </p>
            <div className="grid grid-cols-2 gap-2 mb-6">
              {otBooks.map(book => (
                <button
                  key={book.id}
                  onClick={() => handleBookSelect(book)}
                  className="bg-stone-900 border border-stone-800 rounded-xl
                             px-4 py-3 text-sm text-left text-stone-200
                             hover:border-violet-500 hover:text-white
                             transition-all"
                >
                  {book.name}
                </button>
              ))}
            </div>
            <p className="text-stone-500 text-xs uppercase tracking-wider mb-3">
              New Testament
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ntBooks.map(book => (
                <button
                  key={book.id}
                  onClick={() => handleBookSelect(book)}
                  className="bg-stone-900 border border-stone-800 rounded-xl
                             px-4 py-3 text-sm text-left text-stone-200
                             hover:border-violet-500 hover:text-white
                             transition-all"
                >
                  {book.name}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Chapter selection */}
        {selectedBook && !selectedChapter && (
          <>
            <p className="text-stone-500 text-xs mb-4">
              Select a chapter from {selectedBook.name}
            </p>
            <div className="grid grid-cols-5 gap-2">
              {Array.from(
                { length: selectedBook.chapters },
                (_, i) => i + 1
              ).map(ch => (
                <button
                  key={ch}
                  onClick={() => handleChapterSelect(ch)}
                  className="bg-stone-900 border border-stone-800 rounded-xl
                             py-3 text-sm text-stone-200
                             hover:border-violet-500 hover:text-white
                             transition-all"
                >
                  {ch}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Verse display */}
        {selectedChapter && (
          <>
            {loading && (
              <div className="space-y-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-3 bg-stone-800 rounded w-full mb-1.5" />
                    <div className="h-3 bg-stone-800 rounded w-4/5" />
                  </div>
                ))}
              </div>
            )}

            {error && (
              <p className="text-red-400 text-sm text-center py-8">{error}</p>
            )}

            {!loading && !error && verses.length > 0 && (
              <>
                <div className="space-y-1 mb-8">
                  {verses.map((verse) => {
                    const verseNum = verse.id.split('.').pop()
                    const isHighlighted = highlightedVerses.has(verse.id)

                    return (
                      <div
                        key={verse.id}
                        onClick={() => {
                          setSelectedVerse(verse)
                          setShowColorPicker(true)
                        }}
                        className={`flex gap-3 px-3 py-2 rounded-xl
                                    cursor-pointer transition-all
                          ${isHighlighted
                            ? 'bg-violet-950 border border-violet-700'
                            : 'hover:bg-stone-900'}`}
                      >
                        <span className="text-stone-600 text-xs pt-0.5
                                         w-5 flex-shrink-0 text-right">
                          {verseNum}
                        </span>
                        <p className={`text-sm leading-relaxed
                          ${isHighlighted
                            ? 'text-violet-200'
                            : 'text-stone-300'}`}
                        >
                          {verse.content}
                        </p>
                      </div>
                    )
                  })}
                </div>

                {/* Next / Prev navigation */}
                <div className="flex gap-3">
                  <button
                    onClick={handlePrevChapter}
                    disabled={selectedChapter <= 1}
                    className="flex-1 bg-stone-900 border border-stone-800
                               text-stone-300 rounded-xl py-3 text-sm
                               hover:border-stone-600 transition-all
                               disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={handleNextChapter}
                    disabled={selectedChapter >= (selectedBook?.chapters || 1)}
                    className="flex-1 bg-violet-600 hover:bg-violet-500
                               text-white rounded-xl py-3 text-sm
                               transition-all
                               disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Next →
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
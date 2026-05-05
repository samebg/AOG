'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const BOOKS = [
  { id: 'GEN', name: 'Genesis', testament: 'OT', chapters: 50 },
  { id: 'EXO', name: 'Exodus', testament: 'OT', chapters: 40 },
  { id: 'PSA', name: 'Psalms', testament: 'OT', chapters: 150 },
  { id: 'PRO', name: 'Proverbs', testament: 'OT', chapters: 31 },
  { id: 'ISA', name: 'Isaiah', testament: 'OT', chapters: 66 },
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
  { id: 'HEB', name: 'Hebrews', testament: 'NT', chapters: 13 },
  { id: 'JAS', name: 'James', testament: 'NT', chapters: 5 },
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
  const router = useRouter()

  async function loadChapter(bookId: string, chapter: number) {
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

      setVerses(data.verses || [])
    } catch {
      setError('Could not load chapter. Please try again.')
    } finally {
      setLoading(false)
    }
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

  return (
    <div className="min-h-screen bg-stone-950 text-white max-w-lg mx-auto">

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
                        onClick={() => toggleHighlight(verse.id)}
                        className={`flex gap-3 px-3 py-2 rounded-xl cursor-pointer
                                    transition-all
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
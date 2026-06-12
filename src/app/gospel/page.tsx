'use client'
// src/app/gospel/page.tsx
//
// What this file does, plain English:
// The full Bible reader. It walks the user down three levels — pick a book,
// pick a chapter, read the verses — and lets them tap any verse to highlight
// it in a color (+15 XP). It also supports DEEP LINKS: when chat sends the
// user here with ?book=&chapter=&verse= in the URL, the page jumps straight
// to that chapter, scrolls to the verse, and flashes a ring around it.

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getUnlockedColors } from '@/lib/xp'
import { BOOKS } from '@/lib/books'

// One verse as returned by our /api/bible/chapter route.
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
  const [targetVerse, setTargetVerse] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Loads the user's level so the color picker only offers unlocked colors.
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

  // On load, if the page was opened with ?book=&chapter=&verse= (for example
  // from a tapped verse reference in chat), jump straight to that chapter and
  // remember which verse to highlight once the text has loaded.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const bookId = params.get('book')
    const chapterParam = params.get('chapter')
    const verseParam = params.get('verse')
    if (!bookId || !chapterParam) return

    const book = BOOKS.find(b => b.id === bookId)
    if (!book) return

    const chapterNum = parseInt(chapterParam, 10)
    setSelectedBook(book)
    setSelectedChapter(chapterNum)
    loadChapter(book.id, chapterNum)
    if (verseParam) setTargetVerse(`${book.id}.${chapterNum}.${verseParam}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Once the target chapter's verses are on screen, scroll to the verse and
  // flash it for a moment so the user can see exactly where they landed.
  useEffect(() => {
    if (!targetVerse || verses.length === 0) return
    const el = document.getElementById(`v-${targetVerse}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const timer = setTimeout(() => setTargetVerse(null), 2500)
    return () => clearTimeout(timer)
  }, [verses, targetVerse])

  // A small in-memory store of chapters we've already fetched, so re-visiting
  // one doesn't call API.Bible again. (Note: declared inside the component, so
  // it currently resets on every re-render — see "known issues".)
  const chapterCache: Record<string, { id: string; reference: string; content: string }[]> = {}

  // Fetches a chapter's verses from our /api/bible/chapter route and puts them
  // on screen, with loading and error states the UI can show.
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

  // Saves the tapped verse as a highlight in the chosen color, asks the server
  // for the 15 XP reward, marks it highlighted on screen, and shows the toast.
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

  // User picked a book — clear any old chapter/verses and show its chapter grid.
  function handleBookSelect(book: typeof BOOKS[0]) {
    setSelectedBook(book)
    setSelectedChapter(null)
    setVerses([])
  }

  // User picked a chapter number — load its verses.
  function handleChapterSelect(chapter: number) {
    setSelectedChapter(chapter)
    if (selectedBook) loadChapter(selectedBook.id, chapter)
  }

  // Moves to the next chapter (if there is one) and scrolls back to the top.
  function handleNextChapter() {
    if (!selectedBook || !selectedChapter) return
    if (selectedChapter < selectedBook.chapters) {
      const next = selectedChapter + 1
      setSelectedChapter(next)
      loadChapter(selectedBook.id, next)
      window.scrollTo(0, 0)
    }
  }

  // Moves to the previous chapter (if there is one) and scrolls back to the top.
  function handlePrevChapter() {
    if (!selectedBook || !selectedChapter) return
    if (selectedChapter > 1) {
      const prev = selectedChapter - 1
      setSelectedChapter(prev)
      loadChapter(selectedBook.id, prev)
      window.scrollTo(0, 0)
    }
  }

  // Flips a verse's on-screen highlighted state (the saved row in the DB is
  // separate — this just controls the visual styling in this session).
  function toggleHighlight(verseId: string) {
    setHighlightedVerses(prev => {
      const next = new Set(prev)
      if (next.has(verseId)) next.delete(verseId)
      else next.add(verseId)
      return next
    })
  }

  // The back button walks UP one level at a time: verses → chapter grid →
  // book list → home. That matches how the user drilled down.
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
                        id={`v-${verse.id}`}
                        onClick={() => {
                          setSelectedVerse(verse)
                          setShowColorPicker(true)
                        }}
                        className={`flex gap-3 px-3 py-2 rounded-xl
                                    cursor-pointer transition-all
                          ${verse.id === targetVerse
                            ? 'bg-violet-900/40 ring-2 ring-violet-400'
                            : isHighlighted
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
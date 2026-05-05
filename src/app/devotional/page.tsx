'use client'
// src/app/devotional/page.tsx
//
// What this page does, plain English:
// - When it loads, it calls our /api/devotional endpoint
// - That endpoint either returns today's saved devotional OR generates a new one
// - We display the theme, reflection, and prayer in a calm reading UI
// - If this is the first time today, we show a "+20 XP" reward toast

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// This is the shape of data we expect back from the API
interface Devotional {
  theme: string
  reflection: string
  prayer: string
  verse_focus: string | null
  highlight_count?: number
  generated?: boolean   // false = default/fallback, true = Claude-generated
  date?: string
}

export default function DevotionalPage() {
  const router = useRouter()

  // State: what we're showing
  const [devotional, setDevotional] = useState<Devotional | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [xpAwarded, setXpAwarded] = useState(false)   // controls the toast

  // When the page first loads, fetch the devotional
  useEffect(() => {
    async function fetchDevotional() {
      try {
        const res = await fetch('/api/devotional')
        const data = await res.json()

        if (data.error) {
          setError('Could not load your devotional. Try again later.')
          return
        }

        setDevotional(data.devotional)

        // If Claude just generated a fresh one (not cached), show the XP toast
        if (data.xpAwarded) {
          setXpAwarded(true)
          setTimeout(() => setXpAwarded(false), 3000)  // hide after 3 seconds
        }
      } catch {
        setError('Something went wrong. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchDevotional()
  }, [])   // empty array = only runs once when the page loads

  // Format today's date nicely, e.g. "Tuesday, May 5"
  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })

  return (
    <div className="min-h-screen bg-stone-950 text-white max-w-lg mx-auto">

      {/* XP Toast — slides in from top when a new devotional is generated */}
      {xpAwarded && (
        <div className="fixed top-6 left-0 right-0 flex justify-center z-50
                        animate-fade-in">
          <div className="bg-violet-900 border border-violet-600
                          text-violet-200 text-sm px-5 py-2 rounded-full
                          shadow-lg">
            ✦ +20 XP — Daily devotional
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4
                      border-b border-stone-800 sticky top-0 bg-stone-950 z-10">
        <button
          onClick={() => router.push('/')}
          className="text-stone-400 hover:text-white transition-colors text-sm"
        >
          ← Back
        </button>
        <div className="flex-1">
          <h1 className="text-base font-medium">Your devotional</h1>
          <p className="text-stone-600 text-xs">{todayLabel}</p>
        </div>
      </div>

      <div className="px-5 pt-6 pb-24">

        {/* Loading state — skeleton cards while we wait for Claude */}
        {loading && (
          <div className="space-y-4 animate-pulse">
            {/* Theme skeleton */}
            <div className="h-8 bg-stone-800 rounded-lg w-48" />
            {/* Reflection skeleton */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5
                            space-y-2">
              <div className="h-3 bg-stone-800 rounded w-full" />
              <div className="h-3 bg-stone-800 rounded w-5/6" />
              <div className="h-3 bg-stone-800 rounded w-4/6" />
              <div className="h-3 bg-stone-800 rounded w-full mt-2" />
              <div className="h-3 bg-stone-800 rounded w-3/5" />
            </div>
            {/* Prayer skeleton */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5
                            space-y-2">
              <div className="h-3 bg-stone-800 rounded w-2/5" />
              <div className="h-3 bg-stone-800 rounded w-full" />
              <div className="h-3 bg-stone-800 rounded w-4/5" />
            </div>
            {/* Generating label */}
            <p className="text-stone-600 text-xs text-center pt-2">
              Reading your highlights...
            </p>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="text-center py-16">
            <div className="text-3xl mb-3">🕊️</div>
            <p className="text-stone-400 text-sm mb-2">{error}</p>
            <button
              onClick={() => { setError(''); setLoading(true); }}
              className="text-violet-400 text-sm hover:text-violet-300 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* The actual devotional content */}
        {devotional && !loading && !error && (
          <div className="space-y-5">

            {/* Theme title — big and calm */}
            <div>
              <p className="text-stone-500 text-xs uppercase tracking-widest mb-2">
                Today's theme
              </p>
              <h2 className="text-2xl font-medium text-white leading-tight">
                {devotional.theme}
              </h2>
              {/* Show which verse Claude chose as today's focus */}
              {devotional.verse_focus && (
                <p className="text-violet-400 text-sm mt-1">
                  {devotional.verse_focus}
                </p>
              )}
            </div>

            {/* Divider */}
            <div className="h-px bg-stone-800" />

            {/* Reflection — the main body of the devotional */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
              <p className="text-stone-400 text-xs uppercase tracking-wider mb-3">
                Reflection
              </p>
              {/* We split on ". " to put each sentence on its own line
                  This makes it easier to read slowly, like a devotional should be */}
              <p className="text-stone-200 text-sm leading-loose">
                {devotional.reflection}
              </p>
            </div>

            {/* Prayer */}
            <div className="bg-stone-900 border border-violet-900/40
                            rounded-2xl p-5 relative overflow-hidden">
              {/* Subtle decorative element — a faint cross shape in the corner */}
              <div className="absolute top-4 right-4 text-violet-900 text-2xl
                              select-none pointer-events-none opacity-40">
                ✦
              </div>
              <p className="text-stone-400 text-xs uppercase tracking-wider mb-3">
                Prayer
              </p>
              <p className="text-stone-300 text-sm leading-loose italic">
                {devotional.prayer}
              </p>
            </div>

            {/* Footer — shows how many highlights this was based on */}
            {devotional.highlight_count && devotional.highlight_count > 0 && (
              <p className="text-stone-600 text-xs text-center pt-2">
                Based on {devotional.highlight_count} verse
                {devotional.highlight_count !== 1 ? 's' : ''} you've highlighted
              </p>
            )}

            {/* If this is the default (no highlights yet), prompt them to go highlight */}
            {devotional.generated === false && (
              <div className="text-center pt-2">
                <button
                  onClick={() => router.push('/gospel')}
                  className="bg-stone-900 border border-stone-700 text-stone-300
                             rounded-xl px-5 py-3 text-sm hover:border-violet-500
                             hover:text-white transition-all"
                >
                  Go highlight some verses →
                </button>
              </div>
            )}

            {/* Refresh note — tells user it refreshes tomorrow */}
            <p className="text-stone-700 text-xs text-center pb-4">
              Your devotional refreshes each day based on what you highlight
            </p>

          </div>
        )}

      </div>
    </div>
  )
}
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Highlight {
  id: string
  verse_reference: string
  verse_text: string
  color: string
  note: string | null
  created_at: string
}

export default function HighlightsPage() {
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function loadHighlights() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('highlights')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (data) setHighlights(data)
      setLoading(false)
    }
    loadHighlights()
  }, [])

  async function deleteHighlight(id: string) {
    await supabase.from('highlights').delete().eq('id', id)
    setHighlights(prev => prev.filter(h => h.id !== id))
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="min-h-screen bg-stone-950 text-white max-w-lg mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4
                      border-b border-stone-800 sticky top-0 bg-stone-950 z-10">
        <button
          onClick={() => router.push('/')}
          className="text-stone-400 hover:text-white transition-colors text-sm"
        >
          ← Back
        </button>
        <h1 className="text-base font-medium flex-1">My highlights</h1>
        <span className="text-stone-600 text-xs">
          {highlights.length} saved
        </span>
      </div>

      <div className="px-5 pt-4 pb-24">

        {loading && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse bg-stone-900 
                                      rounded-2xl h-24 border border-stone-800" />
            ))}
          </div>
        )}

        {!loading && highlights.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">📖</div>
            <p className="text-stone-400 text-sm font-medium mb-2">
              No highlights yet
            </p>
            <p className="text-stone-600 text-xs mb-6">
              Go to the home screen, select how you're feeling,
              and tap Highlight on any verse.
            </p>
            <button
              onClick={() => router.push('/')}
              className="bg-violet-600 hover:bg-violet-500 text-white
                         rounded-xl px-6 py-3 text-sm transition-colors"
            >
              Find a verse
            </button>
          </div>
        )}

        {!loading && highlights.length > 0 && (
          <div className="space-y-3">
            {highlights.map(h => (
              <div
                key={h.id}
                className="bg-stone-900 border border-stone-800 
                           rounded-2xl p-4 relative"
              >
                {/* Color bar on left */}
                <div
                  className="absolute left-0 top-4 bottom-4 w-1 rounded-full"
                  style={{ background: h.color }}
                />

                <div className="pl-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-medium"
                          style={{ color: h.color }}>
                      {h.verse_reference}
                    </span>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-stone-600 text-xs">
                        {formatDate(h.created_at)}
                      </span>
                      <button
                        onClick={() => deleteHighlight(h.id)}
                        className="text-stone-700 hover:text-red-400 
                                   transition-colors text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <p className="text-stone-300 text-sm leading-relaxed italic">
                    "{h.verse_text}"
                  </p>

                  {h.note && (
                    <p className="text-stone-500 text-xs mt-2 
                                  border-t border-stone-800 pt-2">
                      {h.note}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
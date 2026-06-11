'use client'
// src/components/RetrievedContext.tsx
//
// What this file does, plain English:
// This is the "show your work" panel for the chat. For each AI reply, it shows
// the actual verses our RAG pipeline pulled from the database and fed to the
// model. It's collapsed by default so the chat stays tidy, and expands when the
// user clicks it. It only displays data — it never fetches or changes anything.

import type { RetrievedVerse } from '@/lib/rag'

// Shortens a verse to a preview so a long passage doesn't blow up the chat
// bubble. Adds an ellipsis only when we actually cut something off.
function snippet(text: string, max = 100): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

// Picks the color for the match-percentage label. A stronger match (40%+) is
// shown in green so retrieval quality is readable at a glance; weaker matches
// are muted. Cosine similarity on short verse text rarely runs high, so 40% is
// already a meaningful match here.
function matchColor(similarity: number): string {
  return similarity >= 0.4 ? 'text-green-400' : 'text-stone-400'
}

// The "Retrieved context" panel for one AI message. Given the list of verses
// that were retrieved for that reply, it shows a small label that expands on
// hover (pure CSS via Tailwind's `group`) into one row per verse: reference,
// snippet, and match percentage. No click or state needed.
export default function RetrievedContext({ retrieved }: { retrieved: RetrievedVerse[] }) {
  // Nothing was retrieved (e.g. a crisis message) — render nothing at all.
  if (!retrieved || retrieved.length === 0) return null

  return (
    <div className="group mt-1 text-xs">
      <div className="text-stone-400 group-hover:text-stone-200 transition-colors cursor-default select-none">
        <span className="inline-block transition-transform group-hover:rotate-90">▸</span>{' '}
        Retrieved context ({retrieved.length})
      </div>

      <div className="hidden group-hover:flex mt-1 flex-col gap-2 border-l-2 border-stone-700 pl-3">
        {retrieved.map(v => (
            <div key={v.id}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-violet-300">{v.reference}</span>
                <span className={matchColor(v.similarity)}>
                  {Math.round(v.similarity * 100)}% match
                </span>
              </div>
              <p className="text-stone-400">{snippet(v.text)}</p>
            </div>
          ))}
      </div>
    </div>
  )
}

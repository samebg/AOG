'use client'
// src/app/teacher/TeacherChat.tsx
//
// What this file does, plain English:
// This is the admin's chat interface for The Teacher. The admin types about a
// verse they want to add; the AI (via /api/teacher/chat) either asks a follow-up
// question or returns a structured "proposal" (reference, text, category). When a
// proposal arrives we show an EDITABLE confirm card so the admin can fix anything
// before saving. (Saving itself is wired up in Step 3 — for now Confirm just
// tells you that.)

import { useState } from 'react'

// One chat line shown in the transcript.
interface Message {
  role: 'user' | 'assistant'
  content: string
}

// The three fields the AI extracts; also the editable card's state.
interface VerseProposal {
  reference: string
  text: string
  category: string
}

export default function TeacherChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  // The current editable proposal, or null when there's nothing to confirm.
  const [proposal, setProposal] = useState<VerseProposal | null>(null)
  // True while a save is in flight; a status line to report the result.
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  // Sends the typed message to the teacher chat API and folds the reply (and any
  // proposal) back into the UI.
  async function send() {
    if (!input.trim() || loading) return
    const next = [...messages, { role: 'user' as const, content: input }]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/teacher/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      const data = await res.json()
      setMessages([...next, { role: 'assistant', content: data.reply || data.error || '...' }])
      // A proposal means all three fields are ready — open the confirm card.
      if (data.proposal) setProposal(data.proposal)
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Something went wrong.' }])
    } finally {
      setLoading(false)
    }
  }

  // Updates one field of the editable proposal card.
  function editField(field: keyof VerseProposal, value: string) {
    setProposal(p => (p ? { ...p, [field]: value } : p))
  }

  // Saves the (possibly edited) proposal to the database via /api/teacher/verse.
  // On success the card closes and we show a confirmation; on a known problem
  // (empty field, bad reference, duplicate) we show the server's message.
  async function save() {
    if (!proposal || saving) return
    setSaving(true)
    setStatus(null)
    try {
      const res = await fetch('/api/teacher/verse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proposal),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus(data.error || 'Could not save the verse.')
        return
      }
      setStatus(`Saved ${data.reference} ✓ — it's now live in the database.`)
      setProposal(null)
    } catch {
      setStatus('Something went wrong while saving.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-6">
      {/* Transcript */}
      <div className="flex flex-col gap-3">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            <span
              className={`inline-block rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-violet-600 text-white'
                  : 'bg-stone-900 border border-stone-800 text-stone-200'
              }`}
            >
              {m.content}
            </span>
          </div>
        ))}
        {loading && <p className="text-sm text-stone-500">Thinking…</p>}
      </div>

      {/* Editable confirm card — appears when the AI proposes a verse */}
      {proposal && (
        <div className="mt-4 rounded-2xl border border-violet-700 bg-stone-900/70 p-4">
          <p className="mb-3 text-xs uppercase tracking-wider text-violet-300">
            Proposed verse — review &amp; edit
          </p>
          <label className="block text-xs text-stone-500">Reference</label>
          <input
            value={proposal.reference}
            onChange={e => editField('reference', e.target.value)}
            className="mb-2 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm"
          />
          <label className="block text-xs text-stone-500">Text</label>
          <textarea
            value={proposal.text}
            onChange={e => editField('text', e.target.value)}
            rows={3}
            className="mb-2 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm"
          />
          <label className="block text-xs text-stone-500">Category</label>
          <input
            value={proposal.category}
            onChange={e => editField('category', e.target.value)}
            className="mb-3 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium hover:bg-violet-500 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Confirm & save'}
            </button>
            <button
              onClick={() => setProposal(null)}
              className="rounded-lg border border-stone-700 px-4 py-2 text-sm text-stone-300 hover:border-stone-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Save result (success, duplicate, validation error) */}
      {status && <p className="mt-3 text-sm text-stone-300">{status}</p>}

      {/* Composer */}
      <div className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Name a verse, e.g. 2 Timothy 4:18…"
          className="flex-1 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm"
        />
        <button
          onClick={send}
          disabled={loading}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium hover:bg-violet-500 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  )
}

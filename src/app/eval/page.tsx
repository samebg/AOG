'use client'
// src/app/eval/page.tsx
//
// What this file does, plain English:
// This is the evaluation dashboard. It lets a signed-in user press a button to
// run the RAG test set (via GET /api/eval) and then shows the results: summary
// cards at the top (grounding rate, average similarity) and a table of every
// test query underneath. We run on a button press, not automatically, because
// each run costs real OpenAI + Claude calls.

import { useState } from 'react'
import Link from 'next/link'
import type { EvalRun } from '@/lib/eval'

// One labelled number at the top of the dashboard.
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-4">
      <div className="text-2xl font-semibold text-violet-300">{value}</div>
      <div className="mt-1 text-xs text-stone-400">{label}</div>
    </div>
  )
}

// The dashboard page: button + loading/error states + cards + results table.
export default function EvalPage() {
  const [run, setRun] = useState<EvalRun | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calls the eval API and stores the result (or an error message).
  async function runEvaluation() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/eval')
      // Read the body as text first. If the function timed out, Vercel sends a
      // plain-text error page (not JSON), and parsing it directly would throw a
      // confusing "Unexpected token" error. Try to parse, fall back to a clear
      // message.
      const body = await res.text()
      let data: EvalRun & { error?: string }
      try {
        data = JSON.parse(body)
      } catch {
        throw new Error(
          res.ok ? 'Got an unexpected response.' : 'The run took too long and timed out.'
        )
      }
      if (!res.ok) throw new Error(data.error || 'Eval failed')
      setRun(data as EvalRun)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-4 py-8 text-white">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">RAG Evaluation</h1>
          <p className="mt-1 text-sm text-stone-400">
            Run the test set through the live retrieval + grounding pipeline.
          </p>
        </div>
        <Link href="/" className="text-sm text-stone-400 hover:text-stone-200">
          ← Back
        </Link>
      </div>

      <button
        onClick={runEvaluation}
        disabled={loading}
        className="mt-6 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium
                   hover:bg-violet-500 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Running…' : run ? 'Run again' : 'Run evaluation'}
      </button>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {run && (
        <>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <StatCard
              label="Grounding rate"
              value={`${Math.round(run.summary.groundingRate * 100)}%`}
            />
            <StatCard
              label="Avg top-1 similarity"
              value={run.summary.avgTopSimilarity.toFixed(3)}
            />
            <StatCard
              label="Avg verses cited"
              value={run.summary.avgCited.toFixed(2)}
            />
          </div>

          <p className="mt-3 text-xs text-stone-500">
            Ran {new Date(run.ranAt).toLocaleString()} · {run.summary.total} queries
          </p>

          <table className="mt-4 w-full text-left text-sm">
            <thead className="text-xs text-stone-500">
              <tr className="border-b border-stone-800">
                <th className="py-2 pr-2 font-medium">Query</th>
                <th className="py-2 px-2 font-medium">Top verse</th>
                <th className="py-2 px-2 font-medium text-right">Sim</th>
                <th className="py-2 pl-2 font-medium text-right">Grounded</th>
              </tr>
            </thead>
            <tbody>
              {run.results.map((r, i) => (
                <tr key={i} className="border-b border-stone-900 align-top">
                  <td className="py-2 pr-2">
                    {r.query}
                    {r.offTopic && (
                      <span className="ml-2 rounded bg-stone-800 px-1.5 py-0.5 text-[10px] text-stone-400">
                        off-topic
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-violet-300">{r.topVerse}</td>
                  <td className="py-2 px-2 text-right text-stone-400">
                    {r.topSimilarity.toFixed(3)}
                  </td>
                  <td className="py-2 pl-2 text-right">
                    {r.grounded ? (
                      <span className="text-emerald-400">✓</span>
                    ) : (
                      <span className="text-stone-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

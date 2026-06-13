// src/lib/eval.ts
//
// What this file does, plain English:
// This is the shared "run the evaluation" logic. It takes the test queries from
// eval-queries.ts and runs each one through the SAME retrieval + grounding code
// the live chat uses (from rag.ts), then returns structured numbers. Both the
// terminal script (scripts/eval-rag.ts) and the web API (/api/eval) call this,
// so the dashboard and the command line can never disagree.

import type { SupabaseClient } from '@supabase/supabase-js'
import type OpenAI from 'openai'
import type Anthropic from '@anthropic-ai/sdk'
import { retrieveVerses, buildGroundedSystem, checkGrounding } from './rag'
import { EVAL_QUERIES, type EvalQuery } from './eval-queries'

// The numbers we record for a single test query.
export interface EvalResult {
  query: string
  offTopic: boolean
  topVerse: string
  topSimilarity: number
  retrievedCount: number
  grounded: boolean
  cited: string[]
}

// The roll-up across all queries.
export interface EvalSummary {
  total: number
  groundedCount: number
  groundingRate: number // 0..1
  avgTopSimilarity: number
  avgCited: number
}

// One full evaluation run: every per-query result, the summary, and when it ran.
export interface EvalRun {
  results: EvalResult[]
  summary: EvalSummary
  ranAt: string // ISO timestamp
}

// Runs ONE query through the full pipeline (retrieve → generate → grounding
// check) and returns the numbers we care about for it.
export async function evaluateQuery(
  supabase: SupabaseClient,
  openai: OpenAI,
  anthropic: Anthropic,
  q: EvalQuery
): Promise<EvalResult> {
  const retrieved = await retrieveVerses(supabase, openai, q.text)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: buildGroundedSystem(retrieved),
    messages: [{ role: 'user', content: q.text }],
  })
  const answer = response.content[0].type === 'text' ? response.content[0].text : ''

  const grounding = await checkGrounding(supabase, answer)

  return {
    query: q.text,
    offTopic: q.offTopic,
    topVerse: retrieved[0]?.reference ?? '(none)',
    topSimilarity: retrieved[0]?.similarity ?? 0,
    retrievedCount: retrieved.length,
    grounded: grounding.grounded,
    cited: grounding.matched,
  }
}

// Turns a list of per-query results into the summary rates and averages.
export function summarize(results: EvalResult[]): EvalSummary {
  const total = results.length || 1 // guard against divide-by-zero
  const groundedCount = results.filter(r => r.grounded).length
  const avgTopSimilarity = results.reduce((s, r) => s + r.topSimilarity, 0) / total
  const avgCited = results.reduce((s, r) => s + r.cited.length, 0) / total
  return {
    total: results.length,
    groundedCount,
    groundingRate: groundedCount / total,
    avgTopSimilarity,
    avgCited,
  }
}

// Runs the whole shared query set and returns the full structured run. The
// optional onResult callback lets the terminal script print progress live.
//
// We fire all the queries AT ONCE (Promise.all) instead of one-after-another.
// Each query makes slow AI calls, so running them sequentially could take 90+
// seconds — long enough for Vercel to kill the request at its 60s limit. Run in
// parallel and the whole thing finishes in about the time of the slowest single
// query. Promise.all keeps `results` in the original query order regardless of
// which call happens to finish first.
export async function runEval(
  supabase: SupabaseClient,
  openai: OpenAI,
  anthropic: Anthropic,
  onResult?: (r: EvalResult, index: number) => void
): Promise<EvalRun> {
  const results = await Promise.all(
    EVAL_QUERIES.map((q, i) =>
      evaluateQuery(supabase, openai, anthropic, q).then(r => {
        onResult?.(r, i)
        return r
      })
    )
  )
  return { results, summary: summarize(results), ranAt: new Date().toISOString() }
}

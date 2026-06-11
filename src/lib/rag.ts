// src/lib/rag.ts
//
// What this file does, plain English:
// This is the heart of the RAG (retrieval-augmented generation) pipeline,
// pulled out of the chat route so it can be REUSED and TESTED. Both the live
// chat endpoint and the offline eval script import these same functions, which
// means our evaluation measures the exact code that runs in production.
//
// The functions take the OpenAI and Supabase clients as arguments instead of
// creating their own, so a server route and a local script can each pass in
// the client they already have.

import type { SupabaseClient } from '@supabase/supabase-js'
import type OpenAI from 'openai'

// The shape of one verse returned by the match_verses SQL function.
export interface RetrievedVerse {
  id: string
  reference: string
  text: string
  category: string
  similarity: number
}

// The base instructions for the chat companion. The retrieved verses get
// appended to this at request time by buildGroundedSystem().
export const SYSTEM_PROMPT = `You are a compassionate Christian encouragement companion called Armor of God.

Your role is to provide spiritual encouragement grounded exclusively in scripture.

Rules you must never break:
- ONLY quote Bible verses that actually exist. Never invent or paraphrase a verse and present it as a direct quote.
- Always cite the book, chapter, and verse (e.g. John 3:16)
- Keep responses warm, concise, and pastoral — under 150 words
- Never give medical, legal, or psychological advice
- Never claim to replace prayer, church, or human connection
- If someone seems to be in crisis, gently encourage them to seek human help

You are a companion for spiritual encouragement, not a therapist or pastor.`

// Turns the user's message into an embedding, then asks Postgres (via the
// match_verses function) for the 3 verses whose meaning is closest to it.
// This is the "retrieval" step of RAG.
export async function retrieveVerses(
  supabase: SupabaseClient,
  openai: OpenAI,
  query: string
): Promise<RetrievedVerse[]> {
  const embeddingRes = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  })
  const queryEmbedding = embeddingRes.data[0].embedding

  const { data, error } = await supabase.rpc('match_verses', {
    // pgvector wants the "[0.1, 0.2, ...]" text form, which JSON.stringify gives us.
    query_embedding: JSON.stringify(queryEmbedding),
    match_count: 3,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as RetrievedVerse[]
}

// Builds the system prompt for a request: the base instructions, plus the
// retrieved verses framed as verified context the model must build on.
export function buildGroundedSystem(retrieved: RetrievedVerse[]): string {
  if (retrieved.length === 0) return SYSTEM_PROMPT

  const context = retrieved.map(v => `${v.reference}: "${v.text}"`).join('\n')
  return `${SYSTEM_PROMPT}

The following verses have been retrieved from our verified scripture database. Base your response on these specific passages:

${context}`
}

// Pulls every "Book Chapter:Verse" reference out of a block of text.
// Handles numbered books (1 Corinthians) and ranges (4:6-7).
export function extractReferences(text: string): string[] {
  const pattern = /(?:[1-3]\s)?[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\s\d+:\d+(?:-\d+)?/g
  const matches = text.match(pattern) ?? []
  return [...new Set(matches.map(m => m.trim()))]
}

// Lowercases, collapses spaces, and drops the trailing "-7" of a range so that
// "Philippians 4:6-7" and "philippians 4:6" compare as the same base reference.
export function normalizeRef(ref: string): string {
  return ref.toLowerCase().replace(/\s+/g, ' ').replace(/-\d+$/, '').trim()
}

// The result of checking a model response against our verified verse table.
export interface GroundingResult {
  cited: string[]
  matched: string[]
  unmatched: string[]
  grounded: boolean
}

// The grounding check: of the verses cited in a response, which ones actually
// exist in our verified `verses` table? Returns what matched, what didn't, and
// a simple grounded flag (true if at least one real verse was cited).
export async function checkGrounding(
  supabase: SupabaseClient,
  responseText: string
): Promise<GroundingResult> {
  const cited = extractReferences(responseText)
  if (cited.length === 0) {
    return { cited, matched: [], unmatched: [], grounded: false }
  }

  const { data } = await supabase.from('verses').select('reference')
  const storedBases = new Set(
    (data ?? []).map((r: { reference: string }) => normalizeRef(r.reference))
  )

  const matched = cited.filter(ref => storedBases.has(normalizeRef(ref)))
  const unmatched = cited.filter(ref => !storedBases.has(normalizeRef(ref)))
  return { cited, matched, unmatched, grounded: matched.length > 0 }
}

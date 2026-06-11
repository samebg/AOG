// scripts/eval-rag.ts
//
// What this file does, plain English:
// This is an OFFLINE evaluation of the RAG pipeline. It runs a fixed set of
// test queries through the exact same retrieval + grounding code the live chat
// uses (imported from src/lib/rag.ts), then prints how well it did:
//   - did each answer cite a verse that really exists in our database? (grounded)
//   - how confident was retrieval? (top-1 similarity)
//
// Why this matters: it turns "I think the chatbot is good" into a NUMBER you can
// track and defend. Run it after any change to prompts, retrieval, or data.
//
// Run it with:  npm run eval

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '../src/lib/supabase/service'
import { retrieveVerses, buildGroundedSystem, checkGrounding } from '../src/lib/rag'

// The test set: a spread of real emotional queries, plus two off-topic ones at
// the end that we EXPECT to retrieve weakly — that contrast proves the metric
// is meaningful rather than always green.
const QUERIES = [
  'I feel anxious about my future',
  "I'm scared and can't stop worrying",
  'I feel so grateful today',
  'I feel lost and without direction',
  "I'm exhausted and burned out",
  'I feel angry at someone who wronged me',
  "I'm grieving and heartbroken",
  'I want to feel hopeful again',
  'How do I forgive someone who hurt me?',
  'Tell me a joke about cats',
]

// Runs one query through the full pipeline and returns the numbers we care about.
async function evaluateQuery(
  supabase: ReturnType<typeof createServiceClient>,
  openai: OpenAI,
  anthropic: Anthropic,
  query: string
) {
  const retrieved = await retrieveVerses(supabase, openai, query)
  const topSimilarity = retrieved[0]?.similarity ?? 0

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: buildGroundedSystem(retrieved),
    messages: [{ role: 'user', content: query }],
  })
  const answer = response.content[0].type === 'text' ? response.content[0].text : ''

  const grounding = await checkGrounding(supabase, answer)

  return {
    query,
    topVerse: retrieved[0]?.reference ?? '(none)',
    topSimilarity,
    retrievedCount: retrieved.length,
    grounded: grounding.grounded,
    cited: grounding.matched,
  }
}

// Runs the whole test set and prints a per-query line plus a summary.
async function main() {
  const openai = new OpenAI()
  const anthropic = new Anthropic()
  const supabase = createServiceClient()

  console.log(`RAG evaluation — ${QUERIES.length} queries\n`)

  const results = []
  for (let i = 0; i < QUERIES.length; i++) {
    const r = await evaluateQuery(supabase, openai, anthropic, QUERIES[i])
    results.push(r)
    console.log(
      `${i + 1}. "${r.query}"\n` +
        `   top: ${r.topVerse} (${r.topSimilarity.toFixed(3)}) | ` +
        `retrieved ${r.retrievedCount} | ` +
        `grounded ${r.grounded ? 'YES' : 'no '} | ` +
        `cited: ${r.cited.join(', ') || '(none)'}\n`
    )
  }

  const groundedCount = results.filter(r => r.grounded).length
  const avgTopSim =
    results.reduce((sum, r) => sum + r.topSimilarity, 0) / results.length
  const avgCited =
    results.reduce((sum, r) => sum + r.cited.length, 0) / results.length

  console.log('Summary')
  console.log(
    `  Grounding rate:        ${groundedCount}/${results.length} ` +
      `(${Math.round((groundedCount / results.length) * 100)}%)`
  )
  console.log(`  Avg top-1 similarity:  ${avgTopSim.toFixed(3)}`)
  console.log(`  Avg verses cited/ans:  ${avgCited.toFixed(2)}`)
}

main()

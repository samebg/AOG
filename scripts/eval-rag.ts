// scripts/eval-rag.ts
//
// What this file does, plain English:
// This is an OFFLINE evaluation of the RAG pipeline. It runs a fixed set of
// test queries through the exact same retrieval + grounding code the live chat
// uses, then prints how well it did:
//   - did each answer cite a verse that really exists in our database? (grounded)
//   - how confident was retrieval? (top-1 similarity)
//
// The actual evaluation logic now lives in src/lib/eval.ts, which the web
// dashboard (/api/eval) also calls — so the terminal and the page can never
// disagree. This script just wires up the clients and prints the results.
//
// Run it with:  npm run eval

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '../src/lib/supabase/service'
import { runEval } from '../src/lib/eval'

// Wires up the clients, runs the shared eval, and prints each line as it lands
// plus a final summary.
async function main() {
  const openai = new OpenAI()
  const anthropic = new Anthropic()
  const supabase = createServiceClient()

  const { results, summary } = await runEval(supabase, openai, anthropic, (r, i) => {
    console.log(
      `${i + 1}. "${r.query}"${r.offTopic ? ' [off-topic]' : ''}\n` +
        `   top: ${r.topVerse} (${r.topSimilarity.toFixed(3)}) | ` +
        `retrieved ${r.retrievedCount} | ` +
        `grounded ${r.grounded ? 'YES' : 'no '} | ` +
        `cited: ${r.cited.join(', ') || '(none)'}\n`
    )
  })

  console.log('Summary')
  console.log(
    `  Grounding rate:        ${summary.groundedCount}/${results.length} ` +
      `(${Math.round(summary.groundingRate * 100)}%)`
  )
  console.log(`  Avg top-1 similarity:  ${summary.avgTopSimilarity.toFixed(3)}`)
  console.log(`  Avg verses cited/ans:  ${summary.avgCited.toFixed(2)}`)
}

main()

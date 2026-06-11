// scripts/embed-verses.ts
//
// What this file does, plain English:
// This is a ONE-TIME backfill script you run by hand from the terminal.
// It finds every verse in the database that has no embedding yet, asks OpenAI
// to turn the verse text into an embedding (1536 numbers that capture its meaning),
// and saves that embedding back into the verse row. After it finishes, your verses
// can be searched by meaning — which is what the RAG chat needs.
//
// It is safe to re-run: it only touches rows where `embedding` is still null,
// so if it stops halfway it will pick up exactly where it left off next time.
//
// Run it with:  npm run embed

// Load .env.local the same way Next.js does, so this standalone script has the
// same OPENAI_API_KEY / Supabase keys as the app. (@next/env ships inside Next,
// so there is nothing extra to install for this line.)
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import OpenAI from 'openai'
import { createServiceClient } from '../src/lib/supabase/service'

// Turns a single piece of text into its embedding (an array of 1536 numbers).
// We pull out data[0].embedding because the API can embed many texts at once,
// but we send it one at a time so the progress logs are easy to follow.
async function embedText(openai: OpenAI, text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return res.data[0].embedding
}

// Pauses for a given number of milliseconds — a small gap between calls so we
// stay gentle on OpenAI's rate limits.
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// The main routine: load un-embedded verses, embed each one, save it back,
// and report what happened.
async function main() {
  const openai = new OpenAI() // reads OPENAI_API_KEY from process.env automatically
  const supabase = createServiceClient()

  // Grab every verse that still has no embedding.
  const { data: verses, error } = await supabase
    .from('verses')
    .select('id, reference, text')
    .is('embedding', null)

  if (error) {
    console.error('Could not load verses:', error.message)
    process.exit(1)
  }
  if (!verses || verses.length === 0) {
    console.log('All verses already have embeddings. Nothing to do.')
    return
  }

  console.log(`Found ${verses.length} verses to embed.\n`)

  let success = 0
  const failures: { reference: string; error: string }[] = []

  for (let i = 0; i < verses.length; i++) {
    const verse = verses[i]
    const progress = `[${i + 1}/${verses.length}]`

    try {
      process.stdout.write(`${progress} Embedding ${verse.reference}... `)

      const embedding = await embedText(openai, verse.text)

      // pgvector expects its input as the text form "[0.1, 0.2, ...]".
      // JSON.stringify on the array produces exactly that shape, so the write
      // lands in the vector column correctly.
      const { error: updateError } = await supabase
        .from('verses')
        .update({ embedding: JSON.stringify(embedding) })
        .eq('id', verse.id)

      if (updateError) throw new Error(updateError.message)

      success++
      console.log('done')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      failures.push({ reference: verse.reference, error: message })
      console.log('FAILED')
    }

    // Small pause between calls to be kind to rate limits.
    await wait(200)
  }

  // Final summary so you can see at a glance whether everything worked.
  console.log(`\nDone. ${success} embedded, ${failures.length} failed.`)
  if (failures.length > 0) {
    console.log('Failures:')
    for (const f of failures) {
      console.log(`  - ${f.reference}: ${f.error}`)
    }
  }
}

main()

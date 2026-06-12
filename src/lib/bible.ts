// src/lib/bible.ts
//
// What this file does, plain English:
// Given a human reference like "2 Timothy 4:18" (or a range like "Philippians
// 4:6-7"), this fetches the actual verse text from API.Bible — which is set to
// the NKJV translation. The Teacher uses this so the admin can just name a verse
// instead of typing it out. Returns clean text, or null if the verse can't be
// found or the reference can't be understood.

import { parseReference } from './books'

const BASE = 'https://rest.api.bible/v1/bibles'

// API.Bible returns content wrapped in HTML; strip the tags and tidy whitespace.
function clean(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

// Fetches the NKJV text for a reference. Single verses use the /verses endpoint;
// a range like "4:6-7" uses the /passages endpoint. Returns null on any miss so
// the caller can ask the admin to fix the reference.
export async function fetchVerseText(reference: string): Promise<string | null> {
  const loc = parseReference(reference)
  if (!loc) return null

  // Is this a range, e.g. "...4:6-7"? Grab the end verse if so.
  const range = reference.match(/\d+:(\d+)\s*-\s*(\d+)/)

  let path: string
  if (range) {
    const endVerse = parseInt(range[2], 10)
    const id = `${loc.bookId}.${loc.chapter}.${loc.verse}-${loc.bookId}.${loc.chapter}.${endVerse}`
    path = `passages/${id}`
  } else {
    path = `verses/${loc.bookId}.${loc.chapter}.${loc.verse}`
  }

  const res = await fetch(
    `${BASE}/${process.env.BIBLE_ID}/${path}?content-type=text&include-verse-numbers=false`,
    { headers: { 'api-key': process.env.BIBLE_API_KEY! } }
  )
  if (!res.ok) return null

  const json = await res.json()
  const text = clean(json.data?.content ?? '')
  return text || null
}

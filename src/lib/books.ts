// src/lib/books.ts
//
// What this file does, plain English:
// This is the single source of truth for the 66 books of the Bible (their
// API.Bible ids, display names, testament, and chapter counts). It used to live
// inside the Gospel page, but now both the Gospel reader AND the chat need it —
// so it lives here and both import it. Keeping it in one place means the two
// screens can never disagree about, say, how many chapters Genesis has.
//
// It also provides parseReference(), which turns a human reference like
// "Philippians 4:6" into a location the app can navigate to:
// { bookId: 'PHP', chapter: 4, verse: 6 }.

// The shape of one Bible book.
export interface BibleBook {
  id: string
  name: string
  testament: 'OT' | 'NT'
  chapters: number
}

export const BOOKS: BibleBook[] = [
  { id: 'GEN', name: 'Genesis', testament: 'OT', chapters: 50 },
  { id: 'EXO', name: 'Exodus', testament: 'OT', chapters: 40 },
  { id: 'LEV', name: 'Leviticus', testament: 'OT', chapters: 27 },
  { id: 'NUM', name: 'Numbers', testament: 'OT', chapters: 36 },
  { id: 'DEU', name: 'Deuteronomy', testament: 'OT', chapters: 34 },
  { id: 'JOS', name: 'Joshua', testament: 'OT', chapters: 24 },
  { id: 'JDG', name: 'Judges', testament: 'OT', chapters: 21 },
  { id: 'RUT', name: 'Ruth', testament: 'OT', chapters: 4 },
  { id: '1SA', name: '1 Samuel', testament: 'OT', chapters: 31 },
  { id: '2SA', name: '2 Samuel', testament: 'OT', chapters: 24 },
  { id: '1KI', name: '1 Kings', testament: 'OT', chapters: 22 },
  { id: '2KI', name: '2 Kings', testament: 'OT', chapters: 25 },
  { id: '1CH', name: '1 Chronicles', testament: 'OT', chapters: 29 },
  { id: '2CH', name: '2 Chronicles', testament: 'OT', chapters: 36 },
  { id: 'EZR', name: 'Ezra', testament: 'OT', chapters: 10 },
  { id: 'NEH', name: 'Nehemiah', testament: 'OT', chapters: 13 },
  { id: 'EST', name: 'Esther', testament: 'OT', chapters: 10 },
  { id: 'JOB', name: 'Job', testament: 'OT', chapters: 42 },
  { id: 'PSA', name: 'Psalms', testament: 'OT', chapters: 150 },
  { id: 'PRO', name: 'Proverbs', testament: 'OT', chapters: 31 },
  { id: 'ECC', name: 'Ecclesiastes', testament: 'OT', chapters: 12 },
  { id: 'SNG', name: 'Song of Songs', testament: 'OT', chapters: 8 },
  { id: 'ISA', name: 'Isaiah', testament: 'OT', chapters: 66 },
  { id: 'JER', name: 'Jeremiah', testament: 'OT', chapters: 52 },
  { id: 'LAM', name: 'Lamentations', testament: 'OT', chapters: 5 },
  { id: 'EZK', name: 'Ezekiel', testament: 'OT', chapters: 48 },
  { id: 'DAN', name: 'Daniel', testament: 'OT', chapters: 12 },
  { id: 'HOS', name: 'Hosea', testament: 'OT', chapters: 14 },
  { id: 'JOL', name: 'Joel', testament: 'OT', chapters: 3 },
  { id: 'AMO', name: 'Amos', testament: 'OT', chapters: 9 },
  { id: 'OBA', name: 'Obadiah', testament: 'OT', chapters: 1 },
  { id: 'JON', name: 'Jonah', testament: 'OT', chapters: 4 },
  { id: 'MIC', name: 'Micah', testament: 'OT', chapters: 7 },
  { id: 'NAM', name: 'Nahum', testament: 'OT', chapters: 3 },
  { id: 'HAB', name: 'Habakkuk', testament: 'OT', chapters: 3 },
  { id: 'ZEP', name: 'Zephaniah', testament: 'OT', chapters: 3 },
  { id: 'HAG', name: 'Haggai', testament: 'OT', chapters: 2 },
  { id: 'ZEC', name: 'Zechariah', testament: 'OT', chapters: 14 },
  { id: 'MAL', name: 'Malachi', testament: 'OT', chapters: 4 },
  { id: 'MAT', name: 'Matthew', testament: 'NT', chapters: 28 },
  { id: 'MRK', name: 'Mark', testament: 'NT', chapters: 16 },
  { id: 'LUK', name: 'Luke', testament: 'NT', chapters: 24 },
  { id: 'JHN', name: 'John', testament: 'NT', chapters: 21 },
  { id: 'ACT', name: 'Acts', testament: 'NT', chapters: 28 },
  { id: 'ROM', name: 'Romans', testament: 'NT', chapters: 16 },
  { id: '1CO', name: '1 Corinthians', testament: 'NT', chapters: 16 },
  { id: '2CO', name: '2 Corinthians', testament: 'NT', chapters: 13 },
  { id: 'GAL', name: 'Galatians', testament: 'NT', chapters: 6 },
  { id: 'EPH', name: 'Ephesians', testament: 'NT', chapters: 6 },
  { id: 'PHP', name: 'Philippians', testament: 'NT', chapters: 4 },
  { id: 'COL', name: 'Colossians', testament: 'NT', chapters: 4 },
  { id: '1TH', name: '1 Thessalonians', testament: 'NT', chapters: 5 },
  { id: '2TH', name: '2 Thessalonians', testament: 'NT', chapters: 3 },
  { id: '1TI', name: '1 Timothy', testament: 'NT', chapters: 6 },
  { id: '2TI', name: '2 Timothy', testament: 'NT', chapters: 4 },
  { id: 'TIT', name: 'Titus', testament: 'NT', chapters: 3 },
  { id: 'PHM', name: 'Philemon', testament: 'NT', chapters: 1 },
  { id: 'HEB', name: 'Hebrews', testament: 'NT', chapters: 13 },
  { id: 'JAS', name: 'James', testament: 'NT', chapters: 5 },
  { id: '1PE', name: '1 Peter', testament: 'NT', chapters: 5 },
  { id: '2PE', name: '2 Peter', testament: 'NT', chapters: 3 },
  { id: '1JN', name: '1 John', testament: 'NT', chapters: 5 },
  { id: '2JN', name: '2 John', testament: 'NT', chapters: 1 },
  { id: '3JN', name: '3 John', testament: 'NT', chapters: 1 },
  { id: 'JUD', name: 'Jude', testament: 'NT', chapters: 1 },
  { id: 'REV', name: 'Revelation', testament: 'NT', chapters: 22 },
]

// A navigable location inside the Bible.
export interface VerseLocation {
  bookId: string
  bookName: string
  chapter: number
  verse: number
}

// Lowercases and collapses whitespace so book names compare reliably.
function normalizeName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

// Finds a book by its display name. Falls back to a "starts with" match so that
// small differences like "Psalm" vs "Psalms" still resolve. Returns null if we
// can't confidently identify the book.
export function findBookByName(name: string): BibleBook | null {
  const n = normalizeName(name)
  const exact = BOOKS.find(b => normalizeName(b.name) === n)
  if (exact) return exact
  const loose = BOOKS.find(
    b => normalizeName(b.name).startsWith(n) || n.startsWith(normalizeName(b.name))
  )
  return loose ?? null
}

// Turns a reference string like "Philippians 4:6" or "1 Corinthians 13:4-7"
// into a navigable location. Returns null if it isn't a reference we recognize.
export function parseReference(ref: string): VerseLocation | null {
  const match = ref.match(/^((?:[1-3]\s)?[A-Za-z][A-Za-z ]*?)\s(\d+):(\d+)/)
  if (!match) return null

  const book = findBookByName(match[1])
  if (!book) return null

  return {
    bookId: book.id,
    bookName: book.name,
    chapter: parseInt(match[2], 10),
    verse: parseInt(match[3], 10),
  }
}

// Finds a book by its short API.Bible id (e.g. "1JN", "MRK"), case-insensitively.
// Returns null if no book uses that id.
function findBookById(id: string): BibleBook | null {
  const wanted = id.toLowerCase()
  return BOOKS.find(b => b.id.toLowerCase() === wanted) ?? null
}

// Turns ANY reference — short code like "1JN 3:18" OR full name like "Mark 8:16"
// — into one consistent full-name form like "1 John 3:18". This exists because
// verses get saved from several screens that each write the reference a bit
// differently; running them all through this one function keeps the Highlights
// list looking uniform. If we can't confidently identify the book, we return the
// original string unchanged so a save is never lost or mangled.
export function formatReference(ref: string): string {
  const trimmed = ref.trim()

  // Split into the book part and the trailing "chapter:verse" (keeping ranges
  // like "3:4-7"). The lazy book group expands only as far as needed so multi-
  // word books like "Song of Songs" and "1 John" stay intact.
  const match = trimmed.match(/^(.+?)\s+(\d+:\d+(?:\s*-\s*\d+)?)\s*$/)
  if (!match) return trimmed

  const bookPart = match[1]
  const numbers = match[2]

  // Try the short code first, then fall back to the full-name lookup.
  const book = findBookById(bookPart) ?? findBookByName(bookPart)
  if (!book) return trimmed

  return `${book.name} ${numbers}`
}

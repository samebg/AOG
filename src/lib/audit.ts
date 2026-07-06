// src/lib/audit.ts
//
// What this file does, plain English:
// This is the "night-shift librarian" — the brain that inspects the saved
// highlights table and reports what's messy or wrong, the way a librarian spots
// books shelved in the wrong place. Task 1 (formatReference) fixed how NEW
// highlights are saved; this cleans up the OLD rows already sitting in the table.
//
// It runs five checks per row:
//   1. format        — reference isn't in the clean full-name form (fixable)
//   2. unrecognized  — the book in the reference isn't one we know
//   3. empty         — the reference or the verse text is blank
//   4. text-mismatch — the saved text disagrees with our verified verses table
//   5. duplicate     — the same user saved the same verse more than once
//
// SAFETY: the scan (auditHighlights) writes NOTHING. There are three separate
// fixers, each an explicit, opt-in action:
//   - applyFormatFixes  — rewrites only old-format references (mechanical)
//   - applyTextFixes    — overwrites mismatched text with our VERIFIED verse text
//   - removeDuplicates  — deletes the later copies, keeping the earliest save
// Text is always verified against our own `verses` table, never an LLM, because
// asking a model to recall scripture would reintroduce the hallucination the
// app's grounding is designed to prevent.

import type { SupabaseClient } from '@supabase/supabase-js'
import { parseReference, formatReference } from './books'

// The kinds of problem a highlight row can have.
export type AuditIssue =
  | 'format'
  | 'unrecognized'
  | 'empty'
  | 'text-mismatch'
  | 'duplicate'

// One problem found on one highlight row. `suggested` holds the corrected value
// for the fixable kinds: the clean reference (format) or the verified text
// (text-mismatch).
export interface AuditFinding {
  id: string
  userId: string
  reference: string
  issue: AuditIssue
  detail: string
  suggested?: string
}

// The whole scan result: what we looked at, everything we found, a per-issue
// tally, and how many rows each fixer would change.
export interface AuditReport {
  scanned: number
  findings: AuditFinding[]
  counts: Record<AuditIssue, number>
  fixable: { format: number; text: number; duplicates: number }
  ranAt: string
}

// The highlight columns the audit needs. created_at lets us keep the ORIGINAL
// when removing duplicates.
interface HighlightRow {
  id: string
  user_id: string
  verse_reference: string | null
  verse_text: string | null
  created_at: string | null
}

// Strips everything but letters and numbers so two versions of the same verse
// text (or reference) compare as equal despite punctuation, quotes, or spacing.
function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

// Loads every highlight row the audit works over.
async function loadHighlights(supabase: SupabaseClient): Promise<HighlightRow[]> {
  const { data } = await supabase
    .from('highlights')
    .select('id, user_id, verse_reference, verse_text, created_at')
  return (data ?? []) as HighlightRow[]
}

// Builds a lookup of verified verse text, keyed by normalized clean reference,
// so a row's text can be checked against ground truth.
async function loadVersesByRef(supabase: SupabaseClient): Promise<Map<string, string>> {
  const { data } = await supabase.from('verses').select('reference, text')
  const map = new Map<string, string>()
  for (const v of data ?? []) {
    if (v.reference && v.text) map.set(normalizeText(formatReference(v.reference)), v.text)
  }
  return map
}

// Runs the per-row checks (everything except duplicates, which need the whole
// set). Returns zero or more findings for this single row.
function checkRow(row: HighlightRow, versesByRef: Map<string, string>): AuditFinding[] {
  const findings: AuditFinding[] = []
  const ref = (row.verse_reference ?? '').trim()
  const text = (row.verse_text ?? '').trim()
  const base = { id: row.id, userId: row.user_id, reference: ref }

  // 3. Blank reference or text — nothing else is meaningful on an empty row.
  if (!ref || !text) {
    findings.push({ ...base, issue: 'empty', detail: 'Reference or verse text is blank.' })
    return findings
  }

  const clean = formatReference(ref)
  const loc = parseReference(clean)

  if (!loc) {
    // 2. We can't identify the book, so we can't safely clean or verify it.
    findings.push({ ...base, issue: 'unrecognized', detail: `Book not recognized in "${ref}".` })
  } else if (clean !== ref) {
    // 1. Recognized, but stored in an old/short format — safe to auto-fix.
    findings.push({ ...base, issue: 'format', detail: `Should be "${clean}".`, suggested: clean })
  }

  // 4. If we have a verified verse for this reference, the text should match it.
  const truth = versesByRef.get(normalizeText(clean))
  if (truth && normalizeText(text) !== normalizeText(truth)) {
    findings.push({
      ...base,
      issue: 'text-mismatch',
      detail: 'Saved text differs from the verified verse.',
      suggested: truth,
    })
  }

  return findings
}

// Finds users who saved the same verse (by clean reference) more than once,
// flags every row in each group, and counts how many rows a cleanup would
// DELETE (every copy past the first).
function findDuplicates(rows: HighlightRow[]): { findings: AuditFinding[]; removable: number } {
  const groups = groupDuplicates(rows)
  const findings: AuditFinding[] = []
  let removable = 0

  for (const list of groups.values()) {
    if (list.length < 2) continue
    removable += list.length - 1
    for (const row of list) {
      findings.push({
        id: row.id,
        userId: row.user_id,
        reference: (row.verse_reference ?? '').trim(),
        issue: 'duplicate',
        detail: `Saved ${list.length} times.`,
      })
    }
  }
  return { findings, removable }
}

// Groups rows by (user + normalized clean reference). Shared by the finder and
// the remover so they always agree on what "a duplicate" is.
function groupDuplicates(rows: HighlightRow[]): Map<string, HighlightRow[]> {
  const groups = new Map<string, HighlightRow[]>()
  for (const row of rows) {
    const ref = (row.verse_reference ?? '').trim()
    if (!ref) continue
    const key = `${row.user_id}::${normalizeText(formatReference(ref))}`
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }
  return groups
}

// Loads everything, runs all five checks, and returns the full report. Writes
// nothing.
export async function auditHighlights(supabase: SupabaseClient): Promise<AuditReport> {
  const rows = await loadHighlights(supabase)
  const versesByRef = await loadVersesByRef(supabase)

  const findings: AuditFinding[] = []
  for (const row of rows) findings.push(...checkRow(row, versesByRef))
  const dupes = findDuplicates(rows)
  findings.push(...dupes.findings)

  const counts: Record<AuditIssue, number> = {
    format: 0, unrecognized: 0, empty: 0, 'text-mismatch': 0, duplicate: 0,
  }
  for (const f of findings) counts[f.issue]++

  return {
    scanned: rows.length,
    findings,
    counts,
    fixable: { format: counts.format, text: counts['text-mismatch'], duplicates: dupes.removable },
    ranAt: new Date().toISOString(),
  }
}

// FIXER 1 — rewrites only rows with a 'format' finding to their clean reference.
// Re-scans first so we act on the current state, not a stale report.
export async function applyFormatFixes(supabase: SupabaseClient): Promise<number> {
  const report = await auditHighlights(supabase)
  const fixes = report.findings.filter(f => f.issue === 'format' && f.suggested)

  let fixed = 0
  for (const f of fixes) {
    const { error } = await supabase
      .from('highlights')
      .update({ verse_reference: f.suggested })
      .eq('id', f.id)
    if (!error) fixed++
  }
  return fixed
}

// FIXER 2 — overwrites mismatched verse text with the VERIFIED text from our
// verses table (never an LLM). Re-scans first for the same honesty reason.
export async function applyTextFixes(supabase: SupabaseClient): Promise<number> {
  const report = await auditHighlights(supabase)
  const fixes = report.findings.filter(f => f.issue === 'text-mismatch' && f.suggested)

  let fixed = 0
  for (const f of fixes) {
    const { error } = await supabase
      .from('highlights')
      .update({ verse_text: f.suggested })
      .eq('id', f.id)
    if (!error) fixed++
  }
  return fixed
}

// FIXER 3 — for each duplicate group, keeps the EARLIEST save and deletes the
// rest. Deletion is destructive, so this is its own explicit action.
export async function removeDuplicates(supabase: SupabaseClient): Promise<number> {
  const rows = await loadHighlights(supabase)
  const groups = groupDuplicates(rows)

  let removed = 0
  for (const list of groups.values()) {
    if (list.length < 2) continue
    // Oldest first; keep list[0], delete the rest.
    const sorted = [...list].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
    for (const row of sorted.slice(1)) {
      const { error } = await supabase.from('highlights').delete().eq('id', row.id)
      if (!error) removed++
    }
  }
  return removed
}

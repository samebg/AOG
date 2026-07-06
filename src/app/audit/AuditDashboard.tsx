'use client'
// src/app/audit/AuditDashboard.tsx
//
// What this file does, plain English:
// This is the "night-shift librarian" dashboard UI. The admin presses "Run audit"
// to scan every saved highlight (via GET /api/audit) and sees what's messy:
// counts at the top and a table of each finding. Fix buttons appear only for
// issues that exist; each one confirms before it writes, and the destructive
// ones (text overwrite, duplicate delete) are separate, deliberate actions.
// The admin gate is enforced in the parent server component (page.tsx) and again
// in the API route — this component only renders once the admin is let through.

import { useState } from 'react'
import Link from 'next/link'
import type { AuditReport, AuditIssue } from '@/lib/audit'

// A short human label + color for each issue type, so the table reads at a glance.
const ISSUE_META: Record<AuditIssue, { label: string; className: string }> = {
  format:         { label: 'Old format',    className: 'bg-amber-900/60 text-amber-300' },
  unrecognized:   { label: 'Unknown book',  className: 'bg-rose-900/60 text-rose-300' },
  empty:          { label: 'Empty',         className: 'bg-rose-900/60 text-rose-300' },
  'text-mismatch':{ label: 'Text mismatch', className: 'bg-orange-900/60 text-orange-300' },
  duplicate:      { label: 'Duplicate',     className: 'bg-stone-800 text-stone-300' },
}

// One labelled number at the top of the dashboard.
function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-4">
      <div className="text-2xl font-semibold text-violet-300">{value}</div>
      <div className="mt-1 text-xs text-stone-400">{label}</div>
    </div>
  )
}

export default function AuditDashboard() {
  const [report, setReport] = useState<AuditReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [fixing, setFixing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Reads a fetch response, turning a timeout/non-JSON page into a clear message
  // instead of a confusing parse error.
  async function readJson(res: Response) {
    const body = await res.text()
    try {
      return JSON.parse(body)
    } catch {
      throw new Error(res.ok ? 'Unexpected response.' : 'The request timed out.')
    }
  }

  // Runs the read-only scan.
  async function runAudit() {
    setLoading(true); setError(null); setNotice(null)
    try {
      const res = await fetch('/api/audit')
      const data = await readJson(res)
      if (!res.ok) throw new Error(data.error || 'Audit failed')
      setReport(data as AuditReport)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // Runs one fix action (after a confirmation), then shows the fresh report the
  // server returns. Each action is separate so a destructive one is deliberate.
  async function runFix(action: 'format' | 'text' | 'duplicates', confirmMsg: string) {
    if (!report) return
    if (!confirm(confirmMsg)) return
    setFixing(true); setError(null); setNotice(null)
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await readJson(res)
      if (!res.ok) throw new Error(data.error || 'Fix failed')
      setReport(data.report as AuditReport)
      setNotice(`${data.changed} row(s) updated.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setFixing(false)
    }
  }

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-4 py-8 text-white">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Highlight Audit</h1>
          <p className="mt-1 text-sm text-stone-400">
            Scan saved highlights for inconsistencies. The scan changes nothing;
            each fix is a separate, confirmed action.
          </p>
        </div>
        <Link href="/" className="text-sm text-stone-400 hover:text-stone-200">
          ← Back
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={runAudit}
          disabled={loading || fixing}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium
                     hover:bg-violet-500 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Scanning…' : report ? 'Re-run audit' : 'Run audit'}
        </button>

        {report && report.fixable.format > 0 && (
          <button
            onClick={() => runFix('format', `Clean ${report.fixable.format} old-format reference(s)? This only rewrites references, never verse text.`)}
            disabled={loading || fixing}
            className="rounded-lg border border-amber-700 px-4 py-2 text-sm font-medium
                       text-amber-300 hover:border-amber-500 disabled:opacity-50 transition-colors"
          >
            Fix {report.fixable.format} format
          </button>
        )}

        {report && report.fixable.text > 0 && (
          <button
            onClick={() => runFix('text', `Overwrite ${report.fixable.text} mismatched verse(s) with the verified text from our verses table? This replaces the saved text.`)}
            disabled={loading || fixing}
            className="rounded-lg border border-orange-700 px-4 py-2 text-sm font-medium
                       text-orange-300 hover:border-orange-500 disabled:opacity-50 transition-colors"
          >
            Fix {report.fixable.text} text
          </button>
        )}

        {report && report.fixable.duplicates > 0 && (
          <button
            onClick={() => runFix('duplicates', `Delete ${report.fixable.duplicates} duplicate row(s), keeping the earliest save of each? This permanently removes the extra copies.`)}
            disabled={loading || fixing}
            className="rounded-lg border border-rose-700 px-4 py-2 text-sm font-medium
                       text-rose-300 hover:border-rose-500 disabled:opacity-50 transition-colors"
          >
            Remove {report.fixable.duplicates} duplicate{report.fixable.duplicates === 1 ? '' : 's'}
          </button>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {notice && <p className="mt-4 text-sm text-emerald-400">{notice}</p>}

      {report && (
        <>
          <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
            <StatCard label="Scanned" value={report.scanned} />
            <StatCard label="Old format" value={report.counts.format} />
            <StatCard label="Unknown book" value={report.counts.unrecognized} />
            <StatCard label="Empty" value={report.counts.empty} />
            <StatCard label="Text mismatch" value={report.counts['text-mismatch']} />
            <StatCard label="Duplicate" value={report.counts.duplicate} />
          </div>

          <p className="mt-3 text-xs text-stone-500">
            Ran {new Date(report.ranAt).toLocaleString()} · {report.findings.length} finding
            {report.findings.length === 1 ? '' : 's'}
          </p>

          {report.findings.length === 0 ? (
            <p className="mt-6 text-sm text-emerald-400">Everything looks clean. ✓</p>
          ) : (
            <table className="mt-4 w-full text-left text-sm">
              <thead className="text-xs text-stone-500">
                <tr className="border-b border-stone-800">
                  <th className="py-2 pr-2 font-medium">Reference</th>
                  <th className="py-2 px-2 font-medium">Issue</th>
                  <th className="py-2 pl-2 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {report.findings.map((f, i) => (
                  <tr key={`${f.id}-${f.issue}-${i}`} className="border-b border-stone-900 align-top">
                    <td className="py-2 pr-2 text-violet-300">{f.reference || '(blank)'}</td>
                    <td className="py-2 px-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] ${ISSUE_META[f.issue].className}`}>
                        {ISSUE_META[f.issue].label}
                      </span>
                    </td>
                    <td className="py-2 pl-2 text-stone-400">{f.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}

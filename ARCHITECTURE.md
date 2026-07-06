# Armor of God — Architecture

A Christian encouragement app: a Bible reader, mood-based verse personalization, a
gamified XP system, AI devotionals, and an AI chat companion whose answers are
**retrieval-augmented and grounded in a verified scripture database**.

---

## Tech stack

| Layer        | Choice                                                        |
| ------------ | ------------------------------------------------------------ |
| Framework    | Next.js 16 (App Router) + TypeScript                         |
| Styling      | Tailwind CSS v4                                              |
| Database     | Supabase (Postgres) + **pgvector** for embeddings           |
| Auth         | Supabase Auth (`@supabase/ssr`, cookie-based)               |
| Chat / text  | Anthropic Claude (`claude-sonnet-4-6`)                       |
| Embeddings   | OpenAI `text-embedding-3-small` (1536 dims)                 |
| Speech-to-text | OpenAI Whisper (`whisper-1`) — The Teacher's voice input   |
| Bible text   | API.Bible (NKJV)                                             |

---

## The RAG chat pipeline (the core feature)

When a user sends a chat message, it flows through `POST /api/chat`:

```
 user message
     │
     ▼
 ┌─────────────────────┐
 │ 1. Crisis check     │  detectCrisis() — keyword scan.
 │    (pre-LLM guard)  │  If triggered, return the 988 response
 └─────────────────────┘  WITHOUT calling any model. Safety first.
     │ (not a crisis)
     ▼
 ┌─────────────────────┐
 │ 2. Retrieve         │  OpenAI embeds the message → pgvector
 │    (RAG)            │  match_verses() returns the top-3 nearest
 └─────────────────────┘  verses by cosine distance.
     │
     ▼
 ┌─────────────────────┐
 │ 3. Ground the prompt│  buildGroundedSystem(): base instructions
 │                     │  + the retrieved real verses as context.
 └─────────────────────┘
     │
     ▼
 ┌─────────────────────┐
 │ 4. Generate         │  Claude answers, instructed to build on the
 │                     │  supplied verses. Markdown is stripped.
 └─────────────────────┘
     │
     ▼
 ┌─────────────────────┐
 │ 5. Grounding check  │  checkGrounding(): parse references out of
 │    (evaluation)     │  the answer, verify each exists in `verses`.
 └─────────────────────┘  Returns grounded + matched_verses.
     │
     ▼
 { response, crisis, grounded, matched_verses, retrieved }
```

**Why grounding instead of just prompting "don't hallucinate":** the model is *given*
real verses to build on, and the response is then *checked* against the verified
table. The UI shows a "✓ Grounded in N verified verses" badge from this result.

**Retrieval visualization.** The response also returns `retrieved` — the verses fed
to the model, each with its cosine `similarity`. The chat UI renders these in a
hover-expandable "Retrieved context" panel (`src/components/RetrievedContext.tsx`),
so a user can see *why* the AI answered as it did. Note the distinction:
`retrieved` = what we gave the model; `matched_verses` = what the model cited that
actually exists in the DB. They answer different questions and are kept separate.

The whole pipeline lives in **`src/lib/rag.ts`** (retrieval, prompt building, and
grounding) so it is reused identically by:
- the live route `src/app/api/chat/route.ts`,
- the offline evaluation `scripts/eval-rag.ts`, and
- the web eval API `src/app/api/eval/route.ts`.

That shared module is what makes the eval trustworthy — it measures production code.

---

## Evaluation

Evaluation runs a fixed set of queries (emotional + deliberately off-topic)
through the real pipeline and reports:
- **Grounding rate** — fraction of answers citing a verse in the DB.
- **Avg top-1 similarity** — retrieval confidence (low on off-topic = working as intended).
- **Avg verses cited** — how many verified verses each answer grounds in.

The eval logic is itself shared so the terminal and the web never disagree:
- **`src/lib/eval-queries.ts`** — the single test set, each query tagged `offTopic`.
- **`src/lib/eval.ts`** — `runEval()` / `evaluateQuery()` / `summarize()`, built on
  `rag.ts`. Returns structured results + summary + timestamp.

Two front ends consume it:
- **`npm run eval`** (`scripts/eval-rag.ts`) — prints results in the terminal.
- **`/eval` dashboard** (`src/app/eval/page.tsx` + `GET /api/eval`) — a signed-in
  user presses "Run evaluation" and sees summary stat cards plus a per-query table
  (off-topic rows flagged). It runs on demand, not on load, because each run costs
  ~10 OpenAI + Claude calls; the route sets `maxDuration = 60` for headroom.

---

## The Teacher (admin verse authoring)

`/teacher` is an admin-only conversational tool for growing the verse library
without touching SQL. The admin names a reference ("2 Timothy 4:18"), and Claude
runs with two **tools** in a bounded loop (`/api/teacher/chat`, max 5 rounds):

- **`lookup_verse`** — the *server* fetches the exact NKJV text from API.Bible
  (`src/lib/bible.ts`), so scripture is never typed or quoted from model memory.
- **`propose_verse`** — once reference + confirmed text + category are gathered,
  Claude hands back a structured proposal.

The UI (`src/app/teacher/TeacherChat.tsx`) shows the proposal in an **editable
confirm card**; only on the admin's explicit Confirm does `POST /api/teacher/verse`
write anything: it validates the fields, derives the `passage_id` via
`parseReference()`, refuses duplicates (409), embeds the text with OpenAI, and
inserts the row — at which point the live RAG chat can retrieve it immediately.

**Voice input:** a mic button records audio (`MediaRecorder`) and sends it to
`POST /api/transcribe`, which runs OpenAI Whisper and returns text into the input
box for review before sending.

**Admin gating, three layers, one definition:** `isAdmin()` (`src/lib/admin.ts`)
compares the signed-in email to the server-only `ADMIN_EMAIL` env var. The
`/teacher` page checks it server-side before rendering; every `/api/teacher/*`
route (and `/api/transcribe`) re-checks it (403); and the home screen asks
`GET /api/admin` only to decide whether to *show* the Teacher button — UI
convenience, not security.

---

## Highlight audit (the "night-shift librarian")

Highlights are saved from several screens, so older rows drifted in format (short
codes like `1JN 3:18` vs full names like `1 John 3:18`). `formatReference()`
(`src/lib/books.ts`) normalizes every **new** save; this admin tool cleans up the
**old** rows.

The logic lives in **`src/lib/audit.ts`**, run five checks per row: `format`
(fixable), `unrecognized`, `empty`, `text-mismatch` (saved text vs the verified
`verses` table), and `duplicate`. It is **deterministic on purpose** — verse text
is verified against our own data, never an LLM, since asking a model to recall
scripture would reintroduce the hallucination grounding is meant to prevent.

**Safety posture:** the scan (`auditHighlights`) writes nothing. Fixing is split
into three separate, opt-in actions so each write is deliberate:
`applyFormatFixes()` rewrites only old-format references; `applyTextFixes()`
overwrites mismatched text with the **verified** text from the `verses` table
(safe precisely because the source is our data, not a model); and
`removeDuplicates()` deletes the later copies, keeping the earliest save.
`GET /api/audit` scans; `POST /api/audit` takes an `action`
(`format` / `text` / `duplicates`); both are admin-gated (they read across all
users). The `/audit` dashboard (`src/app/audit/page.tsx`) shows counts + a
findings table, and each fix button appears only when that issue exists — each
with its own confirmation before it writes.

---

## Data model (Supabase)

| Table           | Purpose                                                              |
| --------------- | ------------------------------------------------------------------- |
| `profiles`      | XP, level, streak, display name, last open date                     |
| `verses`        | Topical verse library + `embedding vector(1536)` for retrieval      |
| `highlights`    | Verses a user saved, with a color                                   |
| `mood_checkins` | One emotion per user per day (`UNIQUE(user_id, date)`)              |
| `devotionals`   | One cached AI devotional per user per day                           |
| `xp_log`        | Full audit trail of every XP award                                  |
| `daily_verses`  | (Planned) one shared daily verse + AI image                         |

### Postgres functions
- **`match_verses(query_embedding, match_count)`** — cosine-distance vector search.
- **`award_xp(user_id, amount, reason)`** — the single source of truth for XP:
  updates `total_xp`, recomputes `current_level`, and writes `xp_log` atomically.

---

## Security model

- **Trust boundary on XP.** `award_xp` is `SECURITY INVOKER`, pinned `search_path`,
  and `EXECUTE` is revoked from `anon`/`authenticated` and granted **only to
  `service_role`**. So a user can never call it directly to grant themselves XP.
- **Server decides, client only names the action.** `/api/xp` looks up the amount
  from the `reason`; a client-sent `amount` is ignored.
- **Two Supabase clients, never mixed:**
  - cookie client (`src/lib/supabase/server.ts` / `client.ts`) to identify the user;
  - service-role client (`src/lib/supabase/service.ts`, server-only) for privileged
    writes (XP, seeding, retrieval). The service key never reaches the browser.
- **Auth gate.** `src/middleware.ts` redirects unauthenticated users to `/login`;
  API routes additionally check `supabase.auth.getUser()`.

---

## Key directories

```
src/
  app/
    page.tsx              # home: 5 in-place tabs (home/chat/gospel/journey/devotional)
    gospel/page.tsx       # full Bible reader; deep-links to ?book=&chapter=&verse=
    highlights/page.tsx   # saved verses
    devotional/page.tsx   # daily AI devotional
    eval/page.tsx         # RAG eval dashboard (cards + per-query table)
    audit/page.tsx        # highlight audit: server-side admin gate → AuditDashboard
    audit/AuditDashboard.tsx # audit dashboard UI (scan + confirmed fix actions)
    api/
      chat/route.ts       # RAG chat (uses lib/rag.ts); save_verse tool loop
      eval/route.ts       # runs the shared eval on demand (auth-gated)
      audit/route.ts      # highlight audit: GET scans, POST fixes (admin-gated)
      devotional/route.ts # cached daily devotional via Claude
      mood/route.ts       # daily mood check-in
      xp/ streak/         # gamification (award_xp via service client)
      bible/              # API.Bible passthrough (verse + chapter)
      seed-verses/        # one-time admin seeder (secret header)
  components/
    ThreeBackground.tsx   # SSR-safe Three.js ambient background
    RetrievedContext.tsx  # hover panel showing retrieved verses + similarity %
  lib/
    rag.ts                # retrieval + grounding pipeline (shared)
    eval.ts               # runEval/evaluateQuery/summarize (shared, built on rag.ts)
    eval-queries.ts       # the single test-query set (tagged offTopic)
    audit.ts              # highlight-audit checks + formatting-only fixer (shared)
    books.ts              # 66-book data + parseReference()/formatReference()
    xp.ts                 # levels, colors, XP rewards, crisis keywords
    emotions.ts           # 8 emotions → verse categories (many-to-many)
    verse.ts              # local cache of the 8 home-screen verses
    supabase/{client,server,service}.ts
scripts/
  embed-verses.ts         # one-time: backfill verse embeddings (npm run embed)
  eval-rag.ts             # offline RAG evaluation, terminal (npm run eval)
```

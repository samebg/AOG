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
 { response, crisis, grounded, matched_verses }
```

**Why grounding instead of just prompting "don't hallucinate":** the model is *given*
real verses to build on, and the response is then *checked* against the verified
table. The UI shows a "✓ Grounded in N verified verses" badge from this result.

The whole pipeline lives in **`src/lib/rag.ts`** (retrieval, prompt building, and
grounding) so it is reused identically by:
- the live route `src/app/api/chat/route.ts`, and
- the offline evaluation `scripts/eval-rag.ts`.

That shared module is what makes the eval trustworthy — it measures production code.

---

## Evaluation

`npm run eval` runs a fixed set of queries (emotional + deliberately off-topic)
through the real pipeline and reports:
- **Grounding rate** — fraction of answers citing a verse in the DB.
- **Avg top-1 similarity** — retrieval confidence (low on off-topic = working as intended).

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
    api/
      chat/route.ts       # RAG chat (uses lib/rag.ts)
      devotional/route.ts # cached daily devotional via Claude
      mood/route.ts       # daily mood check-in
      xp/ streak/         # gamification (award_xp via service client)
      bible/              # API.Bible passthrough (verse + chapter)
      seed-verses/        # one-time admin seeder (secret header)
  lib/
    rag.ts                # retrieval + grounding pipeline (shared)
    books.ts              # 66-book data + parseReference() for deep-linking
    xp.ts                 # levels, colors, XP rewards, crisis keywords
    emotions.ts           # 8 emotions → verse categories (many-to-many)
    verse.ts              # local cache of the 8 home-screen verses
    supabase/{client,server,service}.ts
scripts/
  embed-verses.ts         # one-time: backfill verse embeddings (npm run embed)
  eval-rag.ts             # offline RAG evaluation (npm run eval)
```

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Who I am

I am a junior developer learning to code. Before writing any code:
- Explain in plain English WHAT you are doing and WHY
- Use simple language — no jargon without explanation
- When fixing a bug, explain what caused it before fixing it
- After every change, tell me what to test and how

## Code style rules

- Write a plain English comment above every function explaining what it does and why it exists
- Keep functions small — one function does one thing, never more than 50 lines
- Explain what a new file does before creating it
- Never delete working code without asking first
- Never assume a file exists — check first

## Commands

```bash
npm run dev      # start dev server at localhost:3000
npm run build    # production build
npm run lint     # run ESLint
```

No test suite is configured.

## Tech stack

- **Framework**: Next.js 16.2.4 with App Router and TypeScript
- **Styling**: Tailwind CSS v4
- **Database and auth**: Supabase (`@supabase/ssr`)
- **AI**: Anthropic Claude API — model `claude-sonnet-4-6`
- **Bible text**: API.Bible REST API (Bible ID: `63097d2a0a2f7db3-01`, NKJV)
- **Deployment**: Vercel

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=
BIBLE_API_KEY=
BIBLE_ID=63097d2a0a2f7db3-01
```

`ANTHROPIC_API_KEY` is picked up automatically by `new Anthropic()` — it is never passed explicitly in the code.

## Folder structure

```
src/
  app/
    page.tsx                      # main home screen (5 tabs rendered in-place)
    layout.tsx                    # root layout, Geist font, dark background
    login/page.tsx                # sign in / sign up screen
    gospel/page.tsx               # full Bible reader (book → chapter → verses)
    highlights/page.tsx           # user's saved highlighted verses
    devotional/page.tsx           # AI-generated daily devotional display
    api/
      chat/route.ts               # Claude chatbot endpoint
      devotional/route.ts         # generates and caches daily devotional via Claude
      xp/route.ts                 # awards XP and updates user level
      streak/route.ts             # handles daily login streak
      bible/verse/route.ts        # fetches a single verse from API.Bible
      bible/chapter/route.ts      # fetches a full chapter from API.Bible
  lib/
    supabase/client.ts            # Supabase browser client (use in 'use client' components)
    supabase/server.ts            # Supabase server client (use in route handlers and RSCs)
    emotions.ts                   # 8 emotions mapped to verse IDs and colors
    xp.ts                         # XP levels, highlight color unlocks, crisis keyword detection
    verse.ts                      # hardcoded cache of the 8 emotion verses (avoids API calls)
  middleware.ts                   # redirects unauthenticated users to /login
```

## Database tables (Supabase)

- `profiles` — user XP, current level, streak count, display name, last open date
- `highlights` — verses saved by the user with a highlight color
- `xp_log` — full history of every XP award (amount + reason)
- `devotionals` — one generated devotional per user per day (cached to avoid re-calling Claude)

## Architecture

### Auth flow
`src/middleware.ts` intercepts every request and redirects to `/login` if no Supabase session exists. API routes do their own check with `supabase.auth.getUser()` and return 401 if unauthenticated. Always use `src/lib/supabase/server.ts` in route handlers and `src/lib/supabase/client.ts` in client components — never mix them.

### Home screen tab model
`src/app/page.tsx` is a single `'use client'` component that renders all five tabs (home, chat, gospel, journey, devotional) using a `useState` toggle. Switching tabs does not navigate — it conditionally renders a different block of JSX. Only `/gospel`, `/highlights`, and `/devotional` are true separate routes.

### XP and progression
`src/lib/xp.ts` is the single source of truth for all gamification. It exports: `LEVELS` (Seeker → Knight, levels 1–8), `HIGHLIGHT_COLORS` (6 colors unlocked by level), `XP_REWARDS` (exact amounts for each action), `getLevelFromXP()`, `getUnlockedColors()`, and `detectCrisis()`. The `/api/xp` route reads from this file to update `profiles.total_xp` and `profiles.current_level` together.

### AI features
Both AI routes use `claude-sonnet-4-6`:

- **`/api/chat`** — Runs `detectCrisis()` on every message before calling Claude. If triggered, returns a hardcoded 988 crisis response without calling Claude at all. Claude responses have markdown stripped before being returned to the client.
- **`/api/devotional`** — Checks the `devotionals` table for today's date first. If a row exists, returns it immediately (no Claude call). If not, fetches the user's 10 most recent highlights, sends them to Claude requesting a JSON response (`theme`, `reflection`, `prayer`, `verse_focus`), saves the result, and awards 20 XP.

### Bible content
The 8 emotion-mapped verses are hardcoded in `src/lib/verse.ts` as `CACHED_VERSES`. The home screen checks this cache first — API.Bible is only called for verses not in it. The gospel reader always calls `/api/bible/chapter` to fetch full chapters on demand.

### Next.js version note
This project uses **Next.js 16**, which has breaking changes from earlier versions. Before writing any Next.js-specific code, check `node_modules/next/dist/docs/` for the correct API. Do not rely on training-data knowledge of Next.js 13–15 conventions.

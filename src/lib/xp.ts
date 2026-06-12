// src/lib/xp.ts
//
// What this file does, plain English:
// This is the single source of truth for all gamification: the level ladder,
// which highlight colors unlock at which level, how much XP each action is
// worth, and the crisis keyword check. Every screen and API route that deals
// with XP imports from here, so the numbers can never disagree across the app.

// The 8-level ladder. Each entry says how much total XP you need to reach it.
export const LEVELS = [
  { level: 1, name: 'Seeker',        xpRequired: 0    },
  { level: 2, name: 'Believer',      xpRequired: 100  },
  { level: 3, name: 'Disciple',      xpRequired: 250  },
  { level: 4, name: 'Armor Bearer',  xpRequired: 500  },
  { level: 5, name: 'Sword Bearer',  xpRequired: 1000 },
  { level: 6, name: 'Shield Bearer', xpRequired: 1800 },
  { level: 7, name: 'Warrior',       xpRequired: 3000 },
  { level: 8, name: 'Knight',        xpRequired: 5000 },
]

// The highlight colors a user can pick, each gated behind a level so leveling
// up feels like it unlocks something real.
export const HIGHLIGHT_COLORS = [
  { name: 'Gold',     hex: '#FBBF24', levelRequired: 1 },
  { name: 'Emerald',  hex: '#34D399', levelRequired: 2 },
  { name: 'Violet',   hex: '#818CF8', levelRequired: 3 },
  { name: 'Ember',    hex: '#FB923C', levelRequired: 4 },
  { name: 'Crimson',  hex: '#F87171', levelRequired: 5 },
  { name: 'Sapphire', hex: '#38BDF8', levelRequired: 7 },
]

// The exact XP amount each action is worth. The server-side routes use these
// values — the client never gets to decide how much XP an action awards.
export const XP_REWARDS = {
  DAILY_LOGIN:        50,
  EMOTION_CHECKIN:    10,
  HIGHLIGHT_VERSE:    15,
  CHAT_SESSION:       25,
  READING_PLAN_DAY:   30,
  GIVE_FEEDBACK:       5,
}

// Given a total XP number, works out which level the user is on, which level
// comes next, and how far along they are (0-100%) toward it. Both progress
// bars in the app (header pill and Journey tab) are drawn from this one answer.
export function getLevelFromXP(xp: number) {
  let current = LEVELS[0]
  for (const level of LEVELS) {
    if (xp >= level.xpRequired) current = level
  }
  const nextLevel = LEVELS.find(l => l.xpRequired > xp)
  const progress = nextLevel
    ? ((xp - current.xpRequired) / 
       (nextLevel.xpRequired - current.xpRequired)) * 100
    : 100
  return { current, nextLevel, progress: Math.round(progress), xp }
}

// Returns only the highlight colors this level has unlocked — used by every
// color picker so a locked color can never be selected.
export function getUnlockedColors(level: number) {
  return HIGHLIGHT_COLORS.filter(c => c.levelRequired <= level)
}

// Phrases that signal someone may be in crisis. Kept as a simple list on
// purpose: a safety check must be instant and predictable, never dependent on
// an AI call that could be slow, down, or wrong.
export const CRISIS_KEYWORDS = [
  'suicide', 'kill myself', 'end my life', 'want to die',
  'self harm', 'self-harm', 'hurt myself', 'no reason to live',
  'better off dead', 'cant go on', "can't go on"
]

// Checks a message for crisis language. Runs BEFORE any AI call in the chat
// route — if this returns true, the user gets the 988 crisis response and the
// message never reaches the model.
export function detectCrisis(text: string): boolean {
  const lower = text.toLowerCase()
  return CRISIS_KEYWORDS.some(k => lower.includes(k))
}
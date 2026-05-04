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

export const HIGHLIGHT_COLORS = [
  { name: 'Gold',     hex: '#FBBF24', levelRequired: 1 },
  { name: 'Emerald',  hex: '#34D399', levelRequired: 2 },
  { name: 'Violet',   hex: '#818CF8', levelRequired: 3 },
  { name: 'Ember',    hex: '#FB923C', levelRequired: 4 },
  { name: 'Crimson',  hex: '#F87171', levelRequired: 5 },
  { name: 'Sapphire', hex: '#38BDF8', levelRequired: 7 },
]

export const XP_REWARDS = {
  DAILY_LOGIN:        50,
  EMOTION_CHECKIN:    10,
  HIGHLIGHT_VERSE:    15,
  CHAT_SESSION:       25,
  READING_PLAN_DAY:   30,
  GIVE_FEEDBACK:       5,
}

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

export function getUnlockedColors(level: number) {
  return HIGHLIGHT_COLORS.filter(c => c.levelRequired <= level)
}

export const CRISIS_KEYWORDS = [
  'suicide', 'kill myself', 'end my life', 'want to die',
  'self harm', 'self-harm', 'hurt myself', 'no reason to live',
  'better off dead', 'cant go on', "can't go on"
]

export function detectCrisis(text: string): boolean {
  const lower = text.toLowerCase()
  return CRISIS_KEYWORDS.some(k => lower.includes(k))
}
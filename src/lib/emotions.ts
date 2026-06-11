// Each emotion maps to:
//   verseId    — the hardcoded quick-load verse shown on the home screen
//   categories — one or more categories in the verses DB table that fit this feeling.
//                We pull from this pool (and rotate) so the user gets relevant variety.
//                These strings MUST match the `category` values in the verses table exactly.
export const EMOTIONS = [
  {
    id: 'anxious',
    label: 'Anxious',
    emoji: '😟',
    verseId: 'PHP.4.6',
    color: '#818CF8',
    categories: ['Fear and Anxiety', 'Faith and Trust in God'],
  },
  {
    id: 'peaceful',
    label: 'Peaceful',
    emoji: '😌',
    verseId: 'ISA.26.3',
    color: '#34D399',
    categories: ['Faith and Trust in God', 'Wisdom and Guidance'],
  },
  {
    id: 'grateful',
    label: 'Grateful',
    emoji: '🙏',
    verseId: '1TH.5.18',
    color: '#FBBF24',
    categories: ['Faith and Trust in God', 'Purpose and Calling'],
  },
  {
    id: 'lost',
    label: 'Lost',
    emoji: '😔',
    verseId: 'PRO.3.5',
    color: '#38BDF8',
    categories: ['Purpose and Calling', 'Wisdom and Guidance'],
  },
  {
    id: 'hopeful',
    label: 'Hopeful',
    emoji: '✨',
    verseId: 'ROM.15.13',
    color: '#FB923C',
    categories: ['Purpose and Calling', 'Strength and Perseverance'],
  },
  {
    id: 'angry',
    label: 'Angry',
    emoji: '😤',
    verseId: 'PSA.37.8',
    color: '#F87171',
    categories: ['Forgiveness', 'Temptation and Self-Control'],
  },
  {
    id: 'tired',
    label: 'Tired',
    emoji: '😴',
    verseId: 'MAT.11.28',
    color: '#A78BFA',
    categories: ['Strength and Perseverance', 'Healing'],
  },
  {
    id: 'sad',
    label: 'Sad',
    emoji: '😢',
    verseId: 'PSA.34.18',
    color: '#F472B6',
    categories: ['Healing', 'Faith and Trust in God'],
  },
]

// The fixed list of valid emotion ids — used to validate incoming check-ins
// so the database only ever stores a known emotion, never arbitrary client input.
export const EMOTION_IDS = EMOTIONS.map(e => e.id)


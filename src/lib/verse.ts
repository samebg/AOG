// A local cache of the 8 emotion verses
// These never change so there's zero reason to call API.bible for them
export const CACHED_VERSES: Record<string, { text: string; reference: string }> = {
  'PHP.4.6': {
    reference: 'Philippians 4:6',
    text: 'Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.'
  },
  'ISA.26.3': {
    reference: 'Isaiah 26:3',
    text: 'You will keep in perfect peace those whose minds are steadfast, because they trust in you.'
  },
  '1TH.5.18': {
    reference: '1 Thessalonians 5:18',
    text: 'Give thanks in all circumstances; for this is God\'s will for you in Christ Jesus.'
  },
  'PRO.3.5': {
    reference: 'Proverbs 3:5',
    text: 'Trust in the Lord with all your heart and lean not on your own understanding.'
  },
  'ROM.15.13': {
    reference: 'Romans 15:13',
    text: 'May the God of hope fill you with all joy and peace as you trust in him, so that you may overflow with hope by the power of the Holy Spirit.'
  },
  'PSA.37.8': {
    reference: 'Psalm 37:8',
    text: 'Refrain from anger and turn from wrath; do not fret — it leads only to evil.'
  },
  'MAT.11.28': {
    reference: 'Matthew 11:28',
    text: 'Come to me, all you who are weary and burdened, and I will give you rest.'
  },
  'PSA.34.18': {
    reference: 'Psalm 34:18',
    text: 'The Lord is close to the brokenhearted and saves those who are crushed in spirit.'
  },
}
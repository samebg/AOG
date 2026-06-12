// src/lib/text.ts
//
// What this file does, plain English:
// Claude often replies using markdown (**bold**, *italics*, # headings). Our chat
// bubbles show plain text, so those symbols would appear raw (e.g. "**John 3:16**").
// This one shared function strips that markdown so every chat surface — the main
// chat AND The Teacher — cleans replies the exact same way, from one place.

// Removes the markdown symbols we don't want shown: bold/italic markers and
// heading hashes, and collapses big gaps of blank lines. Returns clean text.
export function stripMarkdown(raw: string): string {
  return raw
    .replace(/\*\*(.*?)\*\*/g, '$1') // **bold** → bold
    .replace(/\*(.*?)\*/g, '$1')     // *italic* → italic
    .replace(/#{1,6}\s/g, '')        // "# Heading" → "Heading"
    .replace(/\n{3,}/g, '\n\n')      // 3+ blank lines → just one gap
    .trim()
}

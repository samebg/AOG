// src/lib/eval-queries.ts
//
// What this file does, plain English:
// This is the single, shared list of test questions we use to evaluate the RAG
// pipeline. Both the terminal script (scripts/eval-rag.ts) and the web dashboard
// (/api/eval) import this exact list, so the numbers on the page always match
// the numbers from the command line.
//
// Each query is tagged `offTopic`. Off-topic queries (like a joke request) are
// EXPECTED to retrieve weakly and stay ungrounded — that contrast is what proves
// the grounding metric actually means something instead of always being green.

export interface EvalQuery {
  text: string
  offTopic: boolean
}

export const EVAL_QUERIES: EvalQuery[] = [
  { text: 'I feel anxious about my future', offTopic: false },
  { text: "I'm scared and can't stop worrying", offTopic: false },
  { text: 'I feel so grateful today', offTopic: false },
  { text: 'I feel lost and without direction', offTopic: false },
  { text: "I'm exhausted and burned out", offTopic: false },
  { text: 'I feel angry at someone who wronged me', offTopic: false },
  { text: "I'm grieving and heartbroken", offTopic: false },
  { text: 'I want to feel hopeful again', offTopic: false },
  { text: 'How do I forgive someone who hurt me?', offTopic: false },
  { text: 'Tell me a joke about cats', offTopic: true },
]

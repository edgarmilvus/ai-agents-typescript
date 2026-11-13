// Chapter 14 — finding the note that matters.
//
// Retrieval is a ranking problem with a budget attached: the context can hold
// three notes, and the question is whether the right one is among them. The
// scorer here is lexical on purpose — no embeddings, no service — because the
// chapter is about the decision the ranking feeds, not about the ranking's
// state of the art.
//
// Two properties matter and both are testable: a term that appears in every
// document carries no information (idf), and a match on the subject the request
// names is worth more than a match on a word it happens to share.

import type { Memory } from "./memory.ts";

const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "is", "was", "be", "it",
  "this", "that", "again", "same", "like", "did", "do", "does", "what", "which", "who", "when",
  "we", "our", "i", "you", "please", "as", "before", "last", "time", "still", "but", "not",
]);

/** Lowercase words and ids; ids keep their hyphen so ORD-7712 stays one token. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((word) => word.length > 1 && !STOP.has(word));
}

export interface Doc {
  id: string;
  text: string;
  about: string;
}

export function asDoc(memory: Memory): Doc {
  return { id: memory.id, text: memory.text, about: memory.about };
}

/** Inverse document frequency, so a word in every note counts for nothing. */
export function idf(docs: Doc[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const doc of docs) {
    for (const term of new Set(tokenize(`${doc.text} ${doc.about}`))) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }
  const out = new Map<string, number>();
  for (const [term, count] of df) out.set(term, Math.log((docs.length + 1) / (count + 0.5)));
  return out;
}

export interface Ranked {
  id: string;
  score: number;
}

/**
 * Score a document against a query.
 *
 * The `about` field is boosted because a request that names ORD-7712 is about
 * that order, and a note about a different order that happens to share the word
 * "refund" is not the answer. Without the boost, every refund note looks alike.
 */
export function score(query: string, doc: Doc, weights: Map<string, number>): number {
  const terms = tokenize(query);
  const haystack = tokenize(`${doc.text} ${doc.about}`);
  const counts = new Map<string, number>();
  for (const term of haystack) counts.set(term, (counts.get(term) ?? 0) + 1);

  let total = 0;
  for (const term of terms) {
    const weight = weights.get(term) ?? 0;
    if (weight === 0) continue;
    total += weight * Math.min(counts.get(term) ?? 0, 3);
    if (tokenize(doc.about).includes(term)) total += weight * 2;
  }
  return Math.round(total * 1000) / 1000;
}

export function rank(query: string, docs: Doc[], k: number): Ranked[] {
  const weights = idf(docs);
  return docs
    .map((doc) => ({ id: doc.id, score: score(query, doc, weights) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1))
    .slice(0, k);
}

/**
 * The baseline every memory chapter starts with: keep the most recent notes.
 *
 * It is not a strawman. It is what a context window does when nobody writes a
 * retriever, and it is correct for the common case where the thing being
 * discussed is the thing that just happened.
 */
export function recent(docs: Doc[], k: number): Ranked[] {
  return docs.slice(-k).map((doc, index) => ({ id: doc.id, score: k - index }));
}

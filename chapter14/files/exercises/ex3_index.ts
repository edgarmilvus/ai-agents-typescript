// Exercise 3, file 1 of 3 — the index, with no budget and no store.
//
// A document, a query, a number. The file is pure: no clock, no store, no
// packing. That is what lets the ranking be tested with four documents and a
// sentence, and it is the seam the exercise is built around.

export interface Doc {
  id: string;
  text: string;
  about: string;
}

const STOP = new Set(["the", "a", "an", "to", "of", "for", "and", "is", "on", "in", "what", "which", "did"]);

export function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9-]+/).filter((w) => w.length > 1 && !STOP.has(w));
}

/** The score of a document for a query, with the subject match worth double. */
export function score(query: string, doc: Doc, idf: Map<string, number>): number {
  const q = words(query);
  const body = words(doc.text);
  const about = words(doc.about);
  let total = 0;
  for (const term of q) {
    const weight = idf.get(term) ?? 0;
    if (weight === 0) continue;
    total += weight * Math.min(body.filter((w) => w === term).length, 2);
    if (about.includes(term)) total += weight * 2;
  }
  return Math.round(total * 1000) / 1000;
}

export function index(docs: Doc[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const doc of docs) for (const word of new Set(words(`${doc.text} ${doc.about}`))) df.set(word, (df.get(word) ?? 0) + 1);
  const idf = new Map<string, number>();
  for (const [word, n] of df) idf.set(word, Math.log((docs.length + 1) / (n + 0.5)));
  return idf;
}

export function search(query: string, docs: Doc[], k = 3): { id: string; score: number }[] {
  const idf = index(docs);
  return docs
    .map((doc) => ({ id: doc.id, score: score(query, doc, idf) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1))
    .slice(0, k);
}

/** The baseline: the newest documents, whatever the question. */
export function newest(docs: Doc[], k = 3): { id: string; score: number }[] {
  return docs.slice(-k).map((doc) => ({ id: doc.id, score: 0 }));
}

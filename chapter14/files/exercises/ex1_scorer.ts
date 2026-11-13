// Exercise 1 — a scorer you can argue with.
//
// Ranking is arithmetic and it should be inspectable: for a given query, which
// term contributed how much, and why one note beat another. This exercise
// builds the smallest scorer that has an opinion about that, and prints the
// contribution of every term.

export interface Doc {
  id: string;
  text: string;
  about: string;
}

const STOP = new Set(["the", "a", "an", "of", "to", "for", "and", "is", "was", "on", "in"]);

export function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9-]+/).filter((w) => w.length > 1 && !STOP.has(w));
}

export function weights(docs: Doc[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const doc of docs) for (const word of new Set(words(`${doc.text} ${doc.about}`))) df.set(word, (df.get(word) ?? 0) + 1);
  const out = new Map<string, number>();
  for (const [word, n] of df) out.set(word, Math.log((docs.length + 1) / (n + 0.5)));
  return out;
}

export interface Term {
  term: string;
  weight: number;
  count: number;
  inAbout: boolean;
}

/** The per-term breakdown, which is what makes a ranking arguable. */
export function explain(query: string, doc: Doc, w: Map<string, number>): Term[] {
  const haystack = words(doc.text);
  const about = words(doc.about);
  const out: Term[] = [];
  for (const term of words(query)) {
    const weight = w.get(term) ?? 0;
    if (weight === 0) continue;
    out.push({
      term,
      weight,
      count: haystack.filter((word) => word === term).length,
      inAbout: about.includes(term),
    });
  }
  return out;
}

export function total(query: string, doc: Doc, w: Map<string, number>): number {
  return Math.round(explain(query, doc, w).reduce((sum, t) => sum + t.weight * Math.min(t.count, 3) + (t.inAbout ? t.weight * 2 : 0), 0) * 100) / 100;
}

export const DOCS: Doc[] = [
  { id: "d1", text: "refund approved for ORD-7712 after the headphones arrived damaged", about: "ORD-7712" },
  { id: "d2", text: "delivery photo for ORD-7712 uploaded by the driver", about: "ORD-7712" },
  { id: "d3", text: "refund policy for the EU region", about: "EU" },
  { id: "d4", text: "customer C-12 gets a goodwill discount on every order", about: "C-12" },
  { id: "d5", text: "ORD-7801 refund exception for the delivery window", about: "ORD-7801" },
];

export const QUERIES = ["refund ORD-7712", "goodwill C-12", "delivery window ORD-7801"];

export function demo() {
  const w = weights(DOCS);
  return QUERIES.map((query) => ({
    query,
    ranking: DOCS.map((doc) => ({ id: doc.id, score: total(query, doc, w) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score),
  }));
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# three queries, five notes\n");
  for (const row of rows) {
    console.log(`  "${row.query}"`);
    for (const hit of row.ranking) console.log(`    ${hit.id}  ${hit.score.toFixed(2)}`);
  }
  const w = weights(DOCS);
  console.log("\n# why d1 beats d2 for the first query\n");
  for (const term of explain("refund ORD-7712", DOCS[0], w)) {
    console.log(`  ${term.term.padEnd(10)} weight ${term.weight.toFixed(2)}  count ${term.count}  about ${term.inAbout}`);
  }
  console.log("\n  the ranking is a sum of numbers a person can check. That is the whole");
  console.log("  reason to build one by hand: when it is wrong, you can say which term.");
}

if (import.meta.main) report(demo());

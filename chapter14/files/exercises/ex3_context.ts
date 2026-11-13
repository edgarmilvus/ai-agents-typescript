// Exercise 3, file 2 of 3 — the budget.
//
// Ranking says what is relevant; the budget says what fits. Keeping those two
// separate is what lets the same ranking be tried at three budgets, and what
// makes "the note was ranked first but did not fit" a distinguishable failure
// from "the note was never found".

export interface Costed {
  id: string;
  tokens: number;
}

export interface Packed {
  ids: string[];
  tokens: number;
  /** Ranked documents that did not fit, in rank order. */
  dropped: string[];
}

/** Take documents in rank order until the budget is spent. */
export function pack(ranked: Costed[], budget: number): Packed {
  const ids: string[] = [];
  const dropped: string[] = [];
  let used = 0;
  for (const doc of ranked) {
    if (used + doc.tokens <= budget) {
      ids.push(doc.id);
      used += doc.tokens;
    } else {
      dropped.push(doc.id);
    }
  }
  return { ids, tokens: used, dropped };
}

/** A document's cost, from its text. */
export function cost(text: string): number {
  return Math.ceil(text.length / 4);
}

/** The first ranked document that the budget could not hold, if any. */
export function firstDropped(packed: Packed): string | undefined {
  return packed.dropped[0];
}

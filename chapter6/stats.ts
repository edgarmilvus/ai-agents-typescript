// Chapter 6 — a rate, and how much of it is noise.
//
// Ten runs give a number; they do not give a fact. These three functions turn
// a count into a rate, an interval, and a comparison, without a statistics
// library and without pretending to more precision than the sample has.

export interface Tally {
  runs: number;
  passed: number;
}

export function rate(t: Tally): number {
  return t.runs > 0 ? t.passed / t.runs : 0;
}

/**
 * Wilson score interval for a proportion.
 *
 * Chosen over the textbook normal approximation because it behaves at small n
 * and at the extremes, which is exactly where an agent suite lives: 10/10 is
 * not "100 %" and 0/10 is not "0 %".
 */
export function wilson(t: Tally, z = 1.96): { low: number; high: number } {
  if (t.runs === 0) return { low: 0, high: 1 };
  const p = t.passed / t.runs;
  const n = t.runs;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { low: Math.max(0, (centre - spread) / denom), high: Math.min(1, (centre + spread) / denom) };
}

export interface Comparison {
  a: Tally;
  b: Tally;
  /** Difference in rates, b − a. */
  delta: number;
  /** True when the two intervals do not overlap: the difference survives the sample. */
  separated: boolean;
  verdict: "better" | "worse" | "indistinguishable";
}

/**
 * Two runs of the same cases, compared by their intervals.
 *
 * This is deliberately not a hypothesis test. Overlapping intervals mean "the
 * sample cannot tell these apart", which is the sentence a reader needs; a
 * p-value would invite a decision the data does not support.
 */
export function compare(a: Tally, b: Tally): Comparison {
  const ia = wilson(a);
  const ib = wilson(b);
  const delta = rate(b) - rate(a);
  const separated = ib.low > ia.high || ib.high < ia.low;
  const verdict = !separated ? "indistinguishable" : delta > 0 ? "better" : "worse";
  return { a, b, delta, separated, verdict };
}

/** The smallest n at which a given rate can be distinguished from a coin flip. */
export function runsNeeded(p: number, halfWidth = 0.1, z = 1.96): number {
  const variance = p * (1 - p);
  return Math.ceil((z * z * variance) / (halfWidth * halfWidth));
}

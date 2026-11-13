// Exercise 3, file 2 of 3 — run one case N times and count.
//
// Pure measurement: it knows nothing about refunds or models, only how to run
// something repeatedly and return a tally plus the per-run outcomes.

export interface Outcome {
  run: number;
  passed: boolean;
  note: string;
}

export interface Measurement {
  runs: number;
  passed: number;
  outcomes: Outcome[];
}

export async function measure(
  times: number,
  runOnce: (i: number) => Promise<{ passed: boolean; note?: string }>,
): Promise<Measurement> {
  const outcomes: Outcome[] = [];
  for (let i = 0; i < times; i += 1) {
    const result = await runOnce(i);
    outcomes.push({ run: i, passed: result.passed, note: result.note ?? "" });
  }
  return { runs: outcomes.length, passed: outcomes.filter((o) => o.passed).length, outcomes };
}

/** The longest streak of failures, in run order: a failure that clusters is a different bug. */
export function longestFailureStreak(m: Measurement): number {
  let best = 0;
  let current = 0;
  for (const o of m.outcomes) {
    current = o.passed ? 0 : current + 1;
    best = Math.max(best, current);
  }
  return best;
}

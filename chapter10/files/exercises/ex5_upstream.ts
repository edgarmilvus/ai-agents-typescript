// Exercise 5 — shadowing a change you cannot replay.
//
// Everything in the chapter so far assumed the decisions could be frozen. When
// the candidate changes the prompt or the model, they cannot: the comparison is
// between two live decisions, and a live decision is a sample. Shadowing then
// costs two runs per request and needs enough requests to tell a real change
// from the model disagreeing with itself.

/** Approximate requests per side for a two-proportion test. */
export function sampleFor(p0: number, p1: number, alpha = 0.05, power = 0.8): number {
  const zAlpha = 1.959964; // two-sided 5%
  const zBeta = 0.8416212; // 80% power
  const pooled = (p0 + p1) / 2;
  const left = zAlpha * Math.sqrt(2 * pooled * (1 - pooled));
  const right = zBeta * Math.sqrt(p0 * (1 - p0) + p1 * (1 - p1));
  return Math.ceil(((left + right) ** 2) / (p1 - p0) ** 2);
}

/** Measured in chapter 8: 3.5 model calls and 1,477 tokens per run of this desk. */
export const CALLS_PER_RUN = 3.5;
export const TOKENS_PER_RUN = 1477;

export interface Plan {
  baseline: number;
  candidate: number;
  delta: number;
  requests: number;
  calls: number;
  tokens: number;
  minutes: number;
}

export function plan(baseline: number, candidate: number): Plan {
  const requests = sampleFor(baseline, candidate);
  // Two live decisions per request: the incumbent's and the candidate's.
  const calls = Math.round(requests * 2 * CALLS_PER_RUN);
  const tokens = Math.round(requests * 2 * TOKENS_PER_RUN);
  return {
    baseline,
    candidate,
    delta: candidate - baseline,
    requests,
    calls,
    tokens,
    minutes: requests / 15,
  };
}

export function demo() {
  const baseline = 0.05;
  return {
    rows: [0.08, 0.1, 0.15].map((candidate) => plan(baseline, candidate)),
    window: plan(baseline, 0.1).requests,
    oneWindow: { requests: 240, calls: 240 * 2, tokens: 240 * 2 * TOKENS_PER_RUN },
  };
}

const fmt = (n: number) => n.toLocaleString("en-US");

export function report(d: ReturnType<typeof demo>): void {
  console.log("# detecting a change in live decisions\n");
  console.log("  baseline  candidate  delta   requests   calls      tokens   minutes");
  for (const row of d.rows) {
    console.log(
      `  ${(row.baseline * 100).toFixed(0).padStart(8)}%  ${(row.candidate * 100).toFixed(0).padStart(8)}%  ` +
        `${(row.delta * 100).toFixed(0).padStart(4)}pt  ${String(row.requests).padStart(9)}  ${String(row.calls).padStart(6)}  ` +
        `${fmt(row.tokens).padStart(11)}  ${row.minutes.toFixed(0).padStart(7)}`,
    );
  }

  console.log("\n# the window this chapter used\n");
  console.log(`  ${d.oneWindow.requests} requests x 2 live decisions = ${d.oneWindow.calls} calls, ${fmt(d.oneWindow.tokens)} tokens`);
  console.log(`  and that window is too small to detect a five point change (${d.window} requests needed)`);

  console.log("\n  so the split is not a preference, it is arithmetic. A downstream change");
  console.log("  is shadowed for nothing, on any window, because its decisions are");
  console.log("  recorded. An upstream change is shadowed at two calls and eight hundred");
  console.log("  and forty tokens per request, and a window that can see it is five times");
  console.log("  the traffic this chapter's canary needed. That is the bill for changing");
  console.log("  the thing the tape cannot hold.");
}

if (import.meta.main) report(demo());

// Exercise 5 — what attribution costs, in calls and in wall clock.
//
// A replay executes recorded decisions against a substituted component, so it
// costs no model call and no prompt token. That does not make attribution
// free: the search spends one replay per restore attempt, and an exhaustive
// search spends one per subset, which is exponential in the number of suspects.
// This file prices both searches, and prices the one thing a replay cannot do.
//
// The measured inputs come from the chapter's own recordings: four tapes, 3.5
// model calls each on average, 1,477 prompt-plus-output tokens each. The
// corpus numbers — seven cases, nine replays — are what the staging strategy
// actually spent.

import { attribute } from "../../attribute.ts";
import { restore, runUnder } from "../../desk.ts";
import { CASES, baselineId, configOf, failing } from "../../planted.ts";
import { loadTrace } from "../../trace.ts";
import type { Axis } from "../../trace.ts";

/** Measured across the four recorded runs. */
export const CALLS_PER_RUN = 3.5;
export const TOKENS_PER_RUN = 1477;

/** Replays the staged search spends, in the worst case, on d downstream axes. */
export function staged(d: number): number {
  return d + (d * (d - 1)) / 2;
}

/** Replays an exhaustive subset search spends on k suspects: every set but ∅. */
export function exhaustive(k: number): number {
  return 2 ** k - 1;
}

/** What a batch of live runs costs at the measured per-run rate. */
export function liveRunCost(n: number, calls = CALLS_PER_RUN, tokens = TOKENS_PER_RUN) {
  return {
    runs: n,
    calls: Math.round(n * calls),
    tokens: Math.round(n * tokens),
    minutes: Number((n / 15).toFixed(1)),
  };
}

export function demo() {
  const rates = [1, 2, 3, 4, 5, 6].map((k) => ({
    k,
    staged: staged(k),
    exhaustive: exhaustive(k),
  }));

  return {
    rates,
    corpus: liveRunCost(7),
    measured: { cases: 7, replays: 9 },
    // The same seven experiments, run instead of replayed.
    equivalent: liveRunCost(7),
  };
}

/** Time the corpus sweep, so the wall-clock claim is measured, not asserted. */
export async function timed() {
  const start = performance.now();
  let replays = 0;
  for (const c of CASES) {
    const base = loadTrace(c.base);
    const failure = await failing(c, base);
    const probe = (axes: Axis[]) => runUnder(base, axes.reduce((cfg, a) => restore(cfg, a), configOf(c)));
    const result = await attribute(failure, loadTrace(baselineId(c)), probe);
    replays += result.replays;
  }
  return { replays, ms: performance.now() - start };
}

export function report(d: ReturnType<typeof demo>): void {
  console.log("# replays, by search strategy\n");
  console.log("  suspects   staged   exhaustive   exhaustive/staged");
  for (const r of d.rates) {
    console.log(
      `  ${String(r.k).padStart(8)}   ${String(r.staged).padStart(6)}   ${String(r.exhaustive).padStart(10)}   ${(r.exhaustive / r.staged).toFixed(1).padStart(17)}×`,
    );
  }
  console.log("\n  staged is d singles plus d(d-1)/2 pairs: the smallest set that can");
  console.log("  repair is either one axis or a pair, so a triple is never probed.");
  console.log("  exhaustive is every non-empty subset, which answers a question nobody");
  console.log("  asked and costs 63 replays at six suspects instead of 21.");

  console.log("\n# the corpus, priced\n");
  console.log(`  cases                : ${d.measured.cases}`);
  console.log(`  replays              : ${d.measured.replays} (${(d.measured.replays / d.measured.cases).toFixed(2)} per case)`);
  console.log("  model calls          : 0");
  console.log(`  the same seven as runs: ${d.corpus.calls} calls, ${d.corpus.tokens.toLocaleString("en-US")} tokens, ${d.corpus.minutes} minutes at 15 a minute`);
  console.log("\n  attribution is cheap in calls and expensive in wall clock only when the");
  console.log("  answer is upstream: that is the 29-run number from exercise 4, and no");
  console.log("  amount of replaying shortens it.");
}

if (import.meta.main) report(demo());

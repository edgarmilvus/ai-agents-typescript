// Exercise 4 — the upstream test is a sample, and two runs are not one.
//
// t3a and t3b were recorded from the same task, under the same instruction,
// with the same model, minutes apart. Both escalated, and they did not even
// take the same path: t3a asked for the order and the policy in parallel,
// t3b looked the order up first. The token counts differ too. So the run is
// not deterministic, and two agreeing samples prove nothing about why they
// agree.
//
// Three numbers make the point: how many repeats it takes to bound a flake at
// a given rate, what two samples actually bound, and what a repeat costs. The
// fourth part is the one attribution depends on: no downstream restore can
// repair a tape whose decisions already left the policy, which is why upstream
// is an answer by elimination rather than by substitution.

import { attribute } from "../../attribute.ts";
import { GREEN, restore, runUnder } from "../../desk.ts";
import { AXES, diff, loadTrace, path } from "../../trace.ts";
import type { Axis } from "../../trace.ts";

/** Probability of seeing no flake in `n` runs, if each run flakes with `p`. */
export function missRate(p: number, n: number): number {
  return (1 - p) ** n;
}

/** Runs needed to see one flake with `confidence`, if the rate is `p`. */
export function runsFor(p: number, confidence = 0.95): number {
  return Math.ceil(Math.log(1 - confidence) / Math.log(1 - p));
}

/**
 * The one-sided upper bound on a flake rate given `n` runs and no flake.
 *
 * This is the honest reading of "it passed twice": the data are consistent
 * with anything up to this rate, and with two runs that upper bound is 78%.
 */
export function upperBound(n: number, confidence = 0.95): number {
  return 1 - (1 - confidence) ** (1 / n);
}

/** Cost of `n` live runs, using the recording's own measured usage. */
export function cost(n: number, calls: number, tokens: number) {
  return { runs: n, calls: n * calls, tokens: n * tokens };
}

const DOWNSTREAM: Axis[] = AXES.filter((a) => a !== "context" && a !== "model");

/**
 * The counterfactual a tape cannot perform.
 *
 * Restoring the context means replaying decisions that were made under it,
 * which is not a test of the context at all. Every downstream restore leaves
 * the escalation where it is, so the run stays red whatever the tool does.
 */
export async function labelIsNotATest() {
  const tape = loadTrace("t3a");
  const rows = [];
  for (const axis of DOWNSTREAM) {
    const trace = await runUnder(tape, restore({ ...GREEN, context: "task-escalate" }, axis));
    rows.push({ axis, repairs: trace.outcome.pass, reason: trace.outcome.reason });
  }
  const verdict = await attribute(
    { ...(await runUnder(tape, { ...GREEN, context: "task-escalate" })), id: "t3a" },
    loadTrace("t1"),
    async () => {
      throw new Error("an upstream axis must never be probed");
    },
  );
  return { rows, verdict: verdict.verdict.kind, axes: verdict.verdict.axes, replays: verdict.replays };
}

export async function demo() {
  const t1 = loadTrace("t1");
  const a = loadTrace("t3a");
  const b = loadTrace("t3b");

  const rates = [0.05, 0.1, 0.25, 0.5].map((p) => ({
    p,
    runs: runsFor(p),
    bound: upperBound(runsFor(p)),
  }));

  const test = await labelIsNotATest();

  return {
    runs: [a.usage.calls, b.usage.calls],
    samePath: path(a).join(" -> ") === path(b).join(" -> "),
    sameOutcome: a.outcome.reason === b.outcome.reason,
    differentBytes: diff(a, b).kind !== "same",
    tokens: [a.usage.outputTokens, b.usage.outputTokens],
    rates,
    boundAtTwo: upperBound(2),
    bench: cost(runsFor(0.1), t1.usage.calls, Math.round((t1.usage.promptTokens + t1.usage.outputTokens) / t1.usage.calls)),
    test,
    prompt: a.usage.promptTokens,
  };
}

export function report(d: Awaited<ReturnType<typeof demo>>): void {
  console.log("# two runs of the same task, under the same instruction\n");
  console.log(`  same decision path : ${d.samePath ? "yes" : "no"}`);
  console.log(`  same outcome       : ${d.sameOutcome ? "yes" : "no"}`);
  console.log(`  byte-identical     : ${d.differentBytes ? "no" : "yes"}`);
  console.log(`  output tokens      : ${d.tokens[0]} and ${d.tokens[1]}, from ${d.prompt} prompt tokens each`);
  console.log(`  model calls        : ${d.runs[0]} and ${d.runs[1]}\n`);

  console.log("# how many repeats to catch a flake\n");
  console.log("  flake rate   runs for 95%   bound after that many");
  for (const r of d.rates) {
    console.log(
      `  ${(r.p * 100).toFixed(0).padStart(9)}%   ${String(r.runs).padStart(13)}   ${(r.bound * 100).toFixed(1).padStart(19)}%`,
    );
  }
  console.log(`\n  two clean runs bound the rate at ${(d.boundAtTwo * 100).toFixed(0)}%, which is no bound at all.`);
  console.log(`  a ten percent flake needs ${d.rates[1].runs} runs: ${d.bench.calls} model calls, ${d.bench.tokens.toLocaleString("en-US")} tokens.`);

  console.log("\n# relabelling the context is not a test of it\n");
  for (const row of d.test.rows) {
    console.log(`  restore ${row.axis.padEnd(8)} ${row.repairs ? "repairs" : "still red"}   ${row.reason}`);
  }
  console.log(`\n  verdict: ${d.test.verdict} (${d.test.axes.join("+") || "-"}), ${d.test.replays} replays`);
  console.log("  the escalation is a decision, and no downstream restore edits a decision.");
}

if (import.meta.main) report(await demo());

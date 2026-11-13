// Exercise 5 — what a mutation run costs, and which cost actually binds.
//
// The compute is almost free: a replay is a function call and a JSON parse.
// The expensive part is the survivors, because each one has to be read by a
// person before it becomes a case, a unit test or a sentence in the exception
// list. This file prices both, and the second number is the one that decides
// how many mutants a suite should have.

import { CASES } from "../../suite.ts";
import { MUTATIONS } from "../../variants.ts";

/** Measured in chapter 8 over four recorded runs. */
export const CALLS_PER_RUN = 3.5;
export const TOKENS_PER_RUN = 1477;

/**
 * Measured on the machine this was written on, and held fixed here on purpose:
 * a cost model with a clock in it produces a different table every run, and a
 * table in a book has to be the same tomorrow. The harness measures the real
 * figure and asserts it is the same order of magnitude.
 */
export const PER_REPLAY_MS = 0.02;

export interface Cost {
  mutants: number;
  cases: number;
  replays: number;
  seconds: number;
  liveCalls: number;
  liveTokens: number;
  liveMinutes: number;
}

/** The matrix, at a measured per-replay cost, with the live equivalent beside it. */
export function cost(mutants: number, cases: number, perReplayMs: number): Cost {
  const replays = mutants * cases;
  return {
    mutants,
    cases,
    replays,
    seconds: (replays * perReplayMs) / 1000,
    liveCalls: Math.round(replays * CALLS_PER_RUN),
    liveTokens: Math.round(replays * TOKENS_PER_RUN),
    liveMinutes: replays / 15,
  };
}

/**
 * The human half.
 *
 * Ten minutes is the optimistic case: read the failure, decide whether it is a
 * gap in the corpus or in the assertions, and write the smallest artefact that
 * closes it. An undeclared survivor takes longer, because the decision has to
 * be made from scratch.
 */
export function triage(survivors: number, minutesEach = 10): { survivors: number; minutes: number; hours: number } {
  return { survivors, minutes: survivors * minutesEach, hours: (survivors * minutesEach) / 60 };
}

/** The largest matrix that fits a CI budget, in seconds of compute. */
export function fits(budgetSeconds: number, cases: number, perReplayMs: number): number {
  const perMutant = (cases * perReplayMs) / 1000;
  return Math.floor(budgetSeconds / perMutant);
}

export function demo() {
  const perReplayMs = PER_REPLAY_MS;

  const sizes = ([[14, 6], [40, 20], [120, 40], [1000, 50]] as const).map(([m, c]) => cost(m, c, perReplayMs));
  const survivors = [[11, 3], [40, 12], [120, 36]] as const;

  return {
    perReplayMs,
    sizes,
    triage: survivors.map(([mutants, Survivors]) => {
      const t = triage(Survivors);
      const m = cost(mutants, 20, perReplayMs);
      return { mutants, survivors: Survivors, seconds: m.seconds, minutes: t.minutes, ratio: t.minutes * 60 / Math.max(m.seconds, 0.001) };
    }),
    perCommit: fits(60, 20, perReplayMs),
  };
}

const fmt = (n: number) => n.toLocaleString("en-US");
const secs = (n: number) => (n < 1 ? `${(n * 1000).toFixed(1)}ms` : `${n.toFixed(2)}s`);

export function report(d: Awaited<ReturnType<typeof demo>>): void {
  console.log(`# priced at ${d.perReplayMs} ms per replay, measured on this machine\n`);
  console.log("  mutants  cases   replays     compute    live calls   live tokens   live minutes");
  for (const c of d.sizes) {
    console.log(
      `  ${String(c.mutants).padStart(7)}  ${String(c.cases).padStart(5)}  ${String(c.replays).padStart(8)}  ` +
        `${secs(c.seconds).padStart(9)}  ${String(c.liveCalls).padStart(12)}  ${fmt(c.liveTokens).padStart(13)}  ${c.liveMinutes.toFixed(1).padStart(12)}`,
    );
  }

  console.log("\n# and the cost that binds\n");
  console.log("  mutants  survivors   compute   triage   human/compute");
  for (const t of d.triage) {
    console.log(
      `  ${String(t.mutants).padStart(7)}  ${String(t.survivors).padStart(9)}  ${secs(t.seconds).padStart(7)}  ` +
        `${t.minutes.toFixed(0).padStart(6)}m  ${fmt(Math.round(t.ratio)).padStart(13)}×`,
    );
  }

  console.log(`\n  a sixty-second CI budget fits ${fmt(d.perCommit)} mutants over a twenty-case`);
  console.log("  suite, which is a number no team will ever reach. The compute never");
  console.log("  becomes the constraint; the survivors do. At ten minutes each, a hundred");
  console.log("  and twenty mutants that leave a third of themselves alive cost six hours");
  console.log("  of reading and about a tenth of a second of machine time.");
  console.log("");
  console.log("  the instrument is cheap; the judgement is not, which is why the right");
  console.log("  move is fewer and better mutants, not a bigger threshold.");
}

if (import.meta.main) report(demo());

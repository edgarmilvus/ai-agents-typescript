// 9.6 — what ninety replays cost, and what the same run would cost live.
//
// Mutation testing is usually a nightly job because a suite is slow. Here the
// suite is a set of replays, so the whole matrix runs in the time a single
// live run takes to warm up. That changes the economics: a mutation score can
// be a per-commit gate instead of a monthly report.

import { CASES, matrix } from "../suite.ts";
import { MUTATIONS } from "../variants.ts";

const started = performance.now();
const rows = await matrix();
const ms = performance.now() - started;

const mutants = MUTATIONS.length;
const cases = CASES.length;
const replays = mutants * cases;
const perReplay = ms / replays;

// Measured in chapter 8 across four recorded runs: 3.5 model calls and 1,477
// prompt-plus-output tokens per run of this desk.
const CALLS_PER_RUN = 3.5;
const TOKENS_PER_RUN = 1477;

const live = {
  calls: Math.round(replays * CALLS_PER_RUN),
  tokens: Math.round(replays * TOKENS_PER_RUN),
  minutes: replays / 15,
};

console.log("# the matrix, measured\n");
console.log(`  mutants x cases   : ${mutants} x ${cases} = ${replays} replays`);
// Printed as a bound, not a measurement: a millisecond figure moves with the
// machine, and a number in a book has to be the same tomorrow.
console.log(`  wall clock        : ${ms < 10 ? "under 10 ms" : `${ms.toFixed(0)} ms`}`);
console.log(`  per replay        : ${perReplay < 0.1 ? "under 0.1 ms" : `${perReplay.toFixed(2)} ms`}`);
console.log("  model calls       : 0");
console.log("  tokens            : 0");

console.log("\n# the same coverage, run live instead\n");
console.log(`  model calls       : ${live.calls}`);
console.log(`  tokens            : ${live.tokens.toLocaleString("en-US")}`);
console.log(`  at 15 requests/min: ${live.minutes.toFixed(1)} minutes of wall clock, ignoring latency`);
console.log("  replay cost       : still 0 calls and 0 tokens, which is the whole argument");

console.log("\n# where the ratio goes as the suite grows\n");
console.log("  mutants  cases   replays     live calls   live tokens");
for (const [m, c] of [
  [14, 6],
  [40, 20],
  [120, 40],
] as const) {
  const n = m * c;
  console.log(
    `  ${String(m).padStart(7)}  ${String(c).padStart(5)}  ${String(n).padStart(8)}  ${String(Math.round(n * CALLS_PER_RUN)).padStart(12)}  ${Math.round(n * TOKENS_PER_RUN).toLocaleString("en-US").padStart(11)}`,
  );
}

console.log("\n  the third row is the one that decides the policy. Forty mutants over a");
console.log("  twenty-case suite is eight hundred replays: under a minute, every commit.");
console.log("  As live runs it is twenty-eight hundred calls, which is a nightly job at");
console.log("  best and a quota incident at worst. The instrument is cheap because the");
console.log("  decisions were paid for once.");
void rows;

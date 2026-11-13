// 19.6 — complete, cancelled and billed.
//
// The ledger is the last link, and it is the one that decides what the next
// reader believes. A cancelled run and a completed one can cost the same nine
// tokens; the status is the only thing that separates them.
//
// The demo prints three rows: a finished run, a cancelled run recorded by the
// chain, and a cancelled run recorded by the runtime that stops at boundaries.
// The last two are the same conversation, billed twice and described
// differently.

import { makeEnv, run } from "../stream.ts";

const finished = await run(makeEnv("chain"), {});
const cancelled = await run(makeEnv("chain"), { abortAt: "chunk", after: 3 });
const boundary = await run(makeEnv("signal"), { abortAt: "chunk", after: 3 });

const rows = [
  { run: "finished", tokens: finished.spent, ledger: finished.ledger },
  { run: "cancelled (chain)", tokens: cancelled.spent, ledger: cancelled.ledger },
  { run: "cancelled (boundaries)", tokens: boundary.spent, ledger: boundary.ledger },
];

console.log("# three ledger rows\n");
console.log("  run                     tokens  ledger");
for (const row of rows) {
  console.log(`  ${row.run.padEnd(23)} ${String(row.tokens).padStart(6)}  ${row.ledger}`);
}

console.log("\n  the last two rows cost the same and say different things. The invoice");
console.log("  reads tokens, the audit reads the status, and the summary reads the");
console.log("  answer. A cancelled run recorded as complete is wrong in two of the");
console.log("  three, which is why the status is written by the run that knows it was");
console.log("  cancelled rather than by the handler that returned.");

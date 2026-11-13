// 19.3 — eight places a hang-up leaks work.
//
// Each probe closes the tab at a different moment. Each row is a link in the
// chain; each column is a runtime. `leak` is what a handler that never sees the
// disconnect looks like, `signal` is what checking at the boundaries buys, and
// `chain` is what it costs to pass the signal all the way down.
//
// The interesting column is the middle one. It fixes four probes, and the four
// it misses are the ones where the work had already started.

import { measure, PROBES } from "../probes.ts";
import type { Mode } from "../stream.ts";

const modes: Mode[] = ["leak", "signal", "chain"];

console.log("# eight places, three runtimes\n");
console.log(`  ${"probe".padEnd(19)} ${"link".padEnd(9)} ${modes.map((mode) => mode.padStart(8)).join("")}`);

const rows = await Promise.all(modes.map((mode) => measure(mode)));
for (let i = 0; i < PROBES.length; i += 1) {
  const cells = rows.map((summary) => (summary.rows[i].leaked ? "LEAK" : "ok").padStart(8));
  console.log(`  ${PROBES[i].id.padEnd(19)} ${PROBES[i].link.padEnd(9)}${cells.join("")}`);
}

console.log("");
for (const summary of rows) {
  console.log(`  ${summary.mode.padEnd(8)} leaked ${summary.leaked}/${summary.rows.length}   stopped ${summary.clean}`);
}

console.log("\n  the middle column is the usual fix: check the request's abort signal at the");
console.log("  top of the loop and before each phase. It saves the model calls it can");
console.log("  see and misses the tool that is already running, the consumer that");
console.log("  stopped reading, the retry in its backoff and the ledger that still says");
console.log("  complete. Each of those needs the signal in a different place.");

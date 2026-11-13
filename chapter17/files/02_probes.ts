// 17.2 — eight probes, three builds of the same agent.
//
// The probes are one per store: orders, memory, cache, policy, quota, audit,
// escalation. Each asks the same question in a different store — can acme's
// agent answer with globex's data — and the matrix says where the answer is no.
//
// The middle column is the interesting one. Scoping every store fixes seven of
// the eight, and the eighth is the one a closure cannot fix.

import { measure, PROBES, summarise } from "../probes.ts";
import type { Mode } from "../probes.ts";

const modes: Mode[] = ["global", "scoped", "owned"];

console.log("# eight probes, three runtimes\n");
console.log(`  ${"probe".padEnd(12)} ${"store".padEnd(12)} ${modes.map((m) => m.padStart(8)).join("")}`);
for (let i = 0; i < PROBES.length; i += 1) {
  const cells = modes.map((mode) => (measure(mode)[i].leaked ? "LEAK" : "ok").padStart(8));
  console.log(`  ${PROBES[i].id.padEnd(12)} ${PROBES[i].store.padEnd(12)}${cells.join("")}`);
}

console.log("");
for (const mode of modes) {
  const summary = summarise(mode);
  console.log(`  ${mode.padEnd(8)} leaked ${summary.leaked}/${summary.rows.length}   refused ${summary.refused}`);
}

const scoped = summarise("scoped");
const open = scoped.rows.filter((r) => r.leaked);
console.log(`\n  the scoped build still leaks on ${open.length} probe: ${open[0]?.probe}`);
console.log(`  ${open[0]?.detail}`);
console.log("\n  the escalation tool takes an order id and writes a row. Scoping its table");
console.log("  would change nothing, because it never reads the table. The closure was");
console.log("  the answer for seven stores and the wrong answer for the eighth, which is");
console.log("  why isolation needs a check as well as a scope.");

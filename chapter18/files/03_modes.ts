// 18.3 — nine copies, three purges.
//
// Each row is an artefact that contains acme's data. Each column is a deletion
// strategy. `clean` means the copy is gone, `leak` means it survived and nobody
// said so, `residual` means it survived and the report names it.
//
// The residual column is the chapter's answer to "how do you know": you do not
// know that nothing remains, you know what the scan found and what it could not.

import { measure, PROBES } from "../probes.ts";
import type { Mode } from "../purge.ts";

const modes: Mode[] = ["naive", "graph", "verified"];

console.log("# nine copies, three purges\n");
console.log(`  ${"probe".padEnd(14)} ${"store".padEnd(10)} ${modes.map((m) => m.padStart(9)).join("")}`);
for (let i = 0; i < PROBES.length; i += 1) {
  const cells = modes.map((mode) => measure(mode).rows[i].verdict.padStart(9));
  console.log(`  ${PROBES[i].id.padEnd(14)} ${PROBES[i].store.padEnd(10)}${cells.join("")}`);
}

console.log("");
for (const mode of modes) {
  const summary = measure(mode);
  console.log(
    `  ${mode.padEnd(9)} ${summary.clean} clean  ${summary.leak} leak  ${summary.residual} residual`,
  );
}

console.log("\n  the row filter is right about the rows and blind to the batch that wrote");
console.log("  from them. The graph finds every derivation that recorded its input, and");
console.log("  stops at the two that did not. The scan finds one of those two and says");
console.log("  so, which is the difference between a residual and a leak: both are");
console.log("  copies, and only one of them is on the record.");

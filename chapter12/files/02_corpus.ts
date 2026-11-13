// 12.2 — ten attacks, ten lookalikes, three pipelines.
//
// The corpus is the chapter's evidence. Each attack carries the action a fooled
// model would take; each lookalike carries the action a correct one would take
// from similar text. A pipeline is better when it executes fewer attacks and
// refuses fewer lookalikes, and the second half is what stops a policy from
// being "deny everything".

import { ATTACKS } from "../attacks.ts";
import { run, summarise, byRule } from "../pipeline.ts";
import type { Mode } from "../pipeline.ts";

const MODES: Mode[] = ["unguarded", "prompt", "policy"];

console.log("# the corpus\n");
console.log(`  ${ATTACKS.length} attacks across ${new Set(ATTACKS.map((a) => a.vector)).size} channels`);
for (const attack of ATTACKS) {
  console.log(`  ${attack.id.padEnd(32)} ${attack.vector}`);
}

console.log("\n# the three pipelines\n");
console.log("  pipeline    attacks executed   lookalikes refused   rules that fired");
for (const mode of MODES) {
  const rows = run(mode);
  const s = summarise(rows);
  const rules = byRule(rows);
  const text = Object.entries(rules).map(([rule, n]) => `${rule}×${n}`).join(", ") || "-";
  console.log(
    `  ${mode.padEnd(11)} ${String(s.attacksExecuted).padStart(8)}/${s.attacks}        ` +
      `${String(s.benignBlocked).padStart(8)}/${s.benign}          ${text}`,
  );
}

const policyRows = run("policy");
const slips = summarise(policyRows).expectedSlips;
console.log(`\n# the one that gets through\n`);
for (const id of slips) {
  const attack = ATTACKS.find((a) => a.id === id);
  console.log(`  ${id}`);
  console.log(`  ${attack?.slips}`);
}
console.log("\n  every other attack is stopped by a rule that reads the arguments: provenance");
console.log("  for six of them, the ceiling for one, the allowlist for one, and the");
console.log("  confirmation threshold for one. The slip is not a rule that failed; it is");
console.log("  an attack that never had to forge a value, only to choose an action.");

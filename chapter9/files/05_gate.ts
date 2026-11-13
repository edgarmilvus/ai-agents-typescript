// 9.5 — the gate, and the case it needs.
//
// Three releases of the same suite, judged by the same six conditions. The
// first merges. The second deletes a case and blocks for three reasons. The
// third keeps every case, passes every one of them, keeps its score, and is
// blocks on one condition only: the check it is testing has been broken, and
// the cases cannot see it.

import { CASES, clean } from "../suite.ts";
import { gate } from "../gate.ts";
import type { GateResult } from "../gate.ts";
import { byId } from "../variants.ts";

function print(label: string, result: GateResult): void {
  console.log(`\n# ${label}`);
  for (const c of result.checks) console.log(`  ${c.ok ? "pass" : "FAIL"}  ${c.name.padEnd(26)} ${c.detail}`);
  console.log(`  gate: ${result.ok ? "merge" : "blocked"}`);
}

print("the suite as written", await gate(CASES, clean));

const without = CASES.filter((c) => c.id !== "s3-window");
print("one case deleted (s3-window)", await gate(without, clean));

const lenient = byId("grader-lenient");
print("the check mutated to be lenient", await gate(CASES, () => lenient.apply(clean())));

console.log("\n  the last block is the chapter's point. The cases are green, the score is");
console.log("  unchanged, and the gate still blocks: five conditions describe the suite,");
console.log("  and the sixth describes the instrument the suite is made of.");

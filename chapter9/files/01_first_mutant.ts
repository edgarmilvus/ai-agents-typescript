// 9.1 — one breakage, one red case.
//
// The suite is green. Delete one guard from the refund tool and run it again:
// six cases, five still hold, and the one that fails is the one written for
// that guard. Nothing else in the system changed, and no model was called.

import { clean, runSuite } from "../suite.ts";
import { byId } from "../variants.ts";

const before = await runSuite(clean);
console.log("# the suite, against the code as shipped");
for (const r of before) console.log(`  ${r.id.padEnd(11)} ${r.holds ? "holds" : "FAILS"}   ${r.reason}`);
console.log(`\n  ${before.filter((r) => r.holds).length}/${before.length} cases hold\n`);

const mutant = byId("tool-skip-window");
const after = await runSuite(() => mutant.apply(clean()));

console.log(`# the same suite, after one deletion: ${mutant.id}`);
console.log(`  ${mutant.note}`);
for (const r of after) {
  const detail = r.holds ? r.reason : `failed: ${r.failed.join(", ")} — ${r.reason}`;
  console.log(`  ${r.id.padEnd(11)} ${r.holds ? "holds" : "FAILS"}   ${detail}`);
}

const caught = after.filter((r) => !r.holds);
console.log(`\n  killed by   : ${caught.map((r) => r.id).join(", ") || "nothing"}`);
console.log("  model calls : 0");
console.log("\n  the case that caught it asked for a refund the window forbids, and expected");
console.log("  the desk to be untouched. With the guard gone, the refund went through.");

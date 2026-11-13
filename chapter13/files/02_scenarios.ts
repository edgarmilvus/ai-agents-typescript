// 13.2 — ten ways an approval goes wrong.
//
// Each row is a short script against the same machine with one thing changed:
// the clock, the approver, the token, the action. The columns are what the
// scenario expected and what happened, because a machine that refuses is only
// as good as its reasons.

import { SCENARIOS, runAll } from "../scenarios.ts";

const rows = runAll();

console.log("# ten scenarios, ten verdicts\n");
console.log("  scenario              effects  status    what changed");
for (const row of rows) {
  console.log(`  ${row.scenario.id.padEnd(21)} ${String(row.got.effects).padStart(7)}  ${row.got.status.padEnd(9)} ${row.scenario.note}`);
}

console.log(`\n  ${rows.filter((r) => r.pass).length}/${rows.length} scenarios matched what was expected`);

const refusals = rows.filter((r) => r.got.reason);
console.log("\n# the refusals, in the machine's words\n");
for (const row of refusals) {
  console.log(`  ${row.scenario.id.padEnd(21)} ${row.got.reason}`);
}

console.log("\n  the two scenarios with no refusal are the interesting ones. s7 is the");
console.log("  crash: the effect landed and the record did not, and the run still ends");
console.log("  executed with one effect. s1 is the only scenario where nothing went");
console.log("  wrong, which is what a test suite should look like.");

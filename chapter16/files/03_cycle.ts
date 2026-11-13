// 16.3 — twelve weeks, two policies.
//
// The same twelve incidents arrive in both runs. Under the ad-hoc policy only
// the ones that look expensive get a fixture; under the other, every incident
// does. The difference is not in week one. It is in the recurrences, which are
// the failures a suite that learned nothing will keep having.

import { run } from "../cycle.ts";
import type { Policy } from "../cycle.ts";
import { coverage } from "../ledger.ts";

const policies: Policy[] = ["ad-hoc", "every-incident"];

console.log("# twelve incidents, two policies\n");
console.log("  week  incident                          ad-hoc  converted");
for (let i = 0; i < 12; i += 1) {
  const ad = run("ad-hoc").weeks[i];
  const all = run("every-incident").weeks[i];
  const flag = (w: typeof ad) => (w.recurrence ? "RECURS" : w.converted ? "fixture" : "nothing");
  console.log(`  ${String(ad.incident.week).padStart(4)}  ${ad.incident.title.padEnd(33)} ${flag(ad).padEnd(7)} ${flag(all)}`);
}

console.log("");
for (const policy of policies) {
  const cycle = run(policy);
  const cov = coverage(cycle.ledger);
  console.log(
    `  ${policy.padEnd(15)} converted ${String(cycle.converted).padStart(2)}/12   artefacts ${String(cycle.artefacts).padStart(2)}   recurrences ${cycle.recurrences}   coverage ${(cov.rate * 100).toFixed(0)}%`,
  );
}

console.log("\n  the ad-hoc policy converts the incidents with money attached and leaves the");
console.log("  rest. It looks reasonable for six weeks, and then the same three failures");
console.log("  come back — the amounts, again, because the fixture that would have caught");
console.log("  the second one was never written after the first.");
console.log("");
console.log("  the difference between the two policies is three recurrences, and each of");
console.log("  them is a customer. That is the argument for converting every incident,");
console.log("  not the coverage percentage.");

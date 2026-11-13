// 10.3 — the divergence a rate forgives.
//
// A debugging guard refuses one order. Three requests in the stream touch it,
// 1.25 percent of the traffic, which is below the rate a healthy release is
// allowed. A canary that only asks "is the rate acceptable" promotes it. A
// canary that asks "did anything critical happen" stops at the first one.

import { LEFTOVER, shadow } from "../releases.ts";
import { boundaries, rateOnly, rollout, severityFirst } from "../canary.ts";
import { stream } from "../traffic.ts";

const requests = stream();
const rows = shadow(requests, LEFTOVER);
const critical = rows.filter((r) => r.kind === "critical");

console.log("# the candidate");
console.log(`  ${LEFTOVER.id} — ${LEFTOVER.note}`);
console.log(`  divergences: ${critical.length} of ${rows.length} requests (${((critical.length / rows.length) * 100).toFixed(2)}%)`);

console.log("\n# what happened");
for (const row of critical) {
  console.log(`  ${row.detail}`);
}

const b = boundaries();
const sev = rollout(rows, severityFirst());
const rate = rollout(rows, rateOnly());

console.log("\n# two policies, one stream");
console.log(`  severity first : ${sev.decision} at request ${sev.at} (${sev.stoppedBy?.kind} on ${sev.stoppedBy?.request.id})`);
console.log(`  rate only      : ${rate.decision} at request ${rate.at}, ${rate.divergences} divergence(s) counted`);

console.log("\n# why the rate forgives it");
console.log(`  upper boundary : ${b.upper.toFixed(2)}   each divergence adds ${b.up.toFixed(2)}, each agreement subtracts ${(-b.down).toFixed(3)}`);
let lr = 0;
let seen = 0;
for (const row of rows) {
  seen += 1;
  if (row.kind === "material" || row.kind === "critical") lr += b.up;
  else if (row.kind === "agree" || row.kind === "cosmetic") lr += b.down;
  if (row.kind === "critical") console.log(`  request ${String(seen).padStart(3)}: divergence, ratio now ${lr.toFixed(2)}`);
  if (lr <= b.lower) {
    console.log(`  request ${String(seen).padStart(3)}: ratio ${lr.toFixed(2)} reaches the lower boundary, promote`);
    break;
  }
}

console.log("\n  the second divergence is real and the third is real, and neither of them");
console.log("  moves a ratio that two hundred agreements have already pushed down. The");
console.log("  rate question is the wrong question to ask about money moving.");

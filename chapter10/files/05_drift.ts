// 10.5 — the bug both releases share.
//
// A canary answers one question: is the candidate worse than the incumbent. On
// a region the corpus never saw, both releases crash, so the answer is no, and
// the canary promotes. The traffic says otherwise, and the traffic is the only
// instrument that can.

import { CORPUS, absolute, blindSpots, coverage } from "../drift.ts";
import { IDEMPOTENT, INCUMBENT, shadow } from "../releases.ts";
import { rollout, severityFirst } from "../canary.ts";
import { stream } from "../traffic.ts";

const requests = stream();
const rows = shadow(requests, IDEMPOTENT);
const decision = rollout(rows, severityFirst());

console.log("# the corpus");
console.log(`  ${CORPUS.length} orders ever used by a case: ${CORPUS.map((o) => `${o.id} (${o.region}, ${o.total})`).join(", ")}\n`);

console.log("# coverage of the traffic\n");
console.log("  feature  bucket   corpus  traffic   share  seen");
for (const row of coverage(requests)) {
  console.log(
    `  ${row.feature.padEnd(7)}  ${row.bucket.padEnd(6)}  ${String(row.corpus).padStart(6)}  ${String(row.traffic).padStart(7)}  ` +
      `${(row.share * 100).toFixed(1).padStart(5)}%  ${row.seen ? "yes" : "NO"}`,
  );
}

const abs = absolute(requests, INCUMBENT);
const spots = blindSpots(requests, INCUMBENT);

console.log("\n# what the incumbent does with it\n");
console.log(`  requests      : ${abs.requests}`);
console.log(`  failures      : ${abs.failures} (${(abs.rate * 100).toFixed(1)}%)`);
for (const spot of spots) {
  console.log(`  blind spot    : ${spot.feature} ${spot.bucket} — ${spot.failures} failures, no case in the corpus`);
}

console.log("\n# what the canary says\n");
console.log(`  candidate     : ${IDEMPOTENT.id}`);
console.log(`  decision      : ${decision.decision} at request ${decision.at}`);
console.log(`  critical      : ${rows.filter((r) => r.kind === "critical").length}`);
console.log(`  material      : ${rows.filter((r) => r.kind === "material").length}`);

console.log("\n  the candidate is not worse than the incumbent anywhere. It is also not");
console.log("  better on the eight requests where the incumbent crashes, because the");
console.log("  crash happens before either release is asked a question it can answer.");
console.log("  A comparison cannot find a bug that both sides of it have.");

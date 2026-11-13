// 10.2 — the whole stream in shadow.
//
// Every candidate is run against the same 240 requests, in the same order, with
// its own world. Nothing is sent to a model and nothing is written to a
// customer's ledger: the decisions are the recorded ones, so the only variable
// is the release.

import { CANDIDATES, shadow } from "../releases.ts";
import { shape, stream } from "../traffic.ts";
import { rollout, severityFirst } from "../canary.ts";

const requests = stream();
const s = shape(requests);

console.log("# the stream");
console.log(
  `  ${s.requests} requests: EU ${s.regions.EU}, US ${s.regions.US}, APAC ${s.regions.APAC}; ` +
    `${s.duplicates} of them a customer asking twice`,
);
console.log(
  `  sizes: small ${s.sizes.small}, medium ${s.sizes.medium}, large ${s.sizes.large}, huge ${s.sizes.huge}`,
);

console.log("\n# five candidates, one window\n");
console.log("  candidate          agree  planned  cosmetic  material  critical  silent  decision");
for (const candidate of CANDIDATES) {
  const rows = shadow(requests, candidate);
  const count = (kind: string) => rows.filter((r) => r.kind === kind).length;
  const decision = rollout(rows, severityFirst()).decision;
  console.log(
    `  ${candidate.id.padEnd(18)} ${String(count("agree")).padStart(5)}  ${String(count("planned")).padStart(7)}  ` +
      `${String(count("cosmetic")).padStart(8)}  ${String(count("material")).padStart(8)}  ` +
      `${String(count("critical")).padStart(8)}  ${String(count("silent")).padStart(6)}  ${decision}`,
  );
}

const comparisons = CANDIDATES.length * requests.length;
console.log(`\n  comparisons : ${comparisons} (${CANDIDATES.length} candidates x ${requests.length} requests)`);
console.log("  model calls : 0");
console.log("  executions  : 2 per comparison, one per release, each in its own world");

console.log("\n  the table is the argument for shadowing before a canary. Four of the five");
console.log("  candidates can be judged without sending a single request to a customer,");
console.log("  because the risk is in the release and not in the decisions.");

// 16.2 — ten incidents, one ledger.
//
// The ledger is the chapter's unit of account: every incident, every artefact
// that exists because of it, and every artefact still owed. The demo fills it
// the way a real quarter would — some incidents completely converted, some
// half, some not at all — and prints the three numbers a review needs.

import { INCIDENTS } from "../incidents.ts";
import type { Artefact } from "../incidents.ts";
import { coverage, createLedger, escapes, owed, record } from "../ledger.ts";

/** What this quarter actually produced, incident by incident. */
const PRODUCED: Record<string, Artefact[]> = {
  "i1-cents": ["recording", "fixture", "gate-case"],
  "i2-double": ["fixture"],
  "i3-lenient": ["gate-case", "fixture"],
  "i4-injection": ["policy-rule", "fixture"],
  "i5-stale-token": [],
  "i6-cache": ["fixture", "gate-case"],
  "i7-memory": [],
  "i8-runaway": ["budget", "fixture"],
  "i9-dropped": [],
  "i10-truncated": ["fixture", "gate-case"],
};

const ledger = createLedger(INCIDENTS);
for (const [id, artefacts] of Object.entries(PRODUCED)) {
  for (const artefact of artefacts) record(ledger, id, artefact);
}

const cov = coverage(ledger);

console.log("# ten incidents\n");
console.log("  incident          week  owes                    produced");
for (const incident of INCIDENTS) {
  const produced = ledger.produced.get(incident.id) ?? [];
  console.log(
    `  ${incident.id.padEnd(17)} ${String(incident.week).padStart(4)}  ${incident.owes.join("+").padEnd(23)} ${produced.join("+") || "nothing"}`,
  );
}

console.log(`\n  converted : ${cov.converted}/${cov.incidents} (${(cov.rate * 100).toFixed(0)}%)`);
console.log(`  complete  : ${cov.complete}`);
console.log(`  open      : ${cov.open.map((i) => i.id).join(", ") || "none"}`);
console.log(`  partial   : ${cov.partial.map((i) => i.id).join(", ") || "none"}`);
console.log(`  artefacts : ${cov.artefacts}`);

const escaped = escapes(ledger);
console.log(`\n# the kinds that escaped\n`);
for (const row of escaped) {
  console.log(`  ${row.kind}: ${row.incidents.map((i) => `${i.id} (week ${i.week})`).join(", ")}`);
}
console.log(`\n  an incident is allowed to happen once. ${escaped.length} kind(s) happened twice with`);
console.log("  nothing to show for the first, and those are the failures the suite could");
console.log("  not catch because nothing existed to catch them.");

const missing = owed(ledger);
console.log(`\n# what is still owed\n`);
for (const row of missing) {
  console.log(`  ${row.incident.id.padEnd(17)} ${row.missing.join(", ")}`);
}

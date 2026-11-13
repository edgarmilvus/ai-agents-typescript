// 16.1 — one incident, and what it owes.
//
// The cents bug from chapter 8 is the book's canonical incident: a refund
// written in cents, caught by a check, and then turned into three artefacts.
// The demo prints the chain — recording, fixture, gate case — because that is
// the pipeline the chapter is about.

import { INCIDENTS } from "../incidents.ts";
import { createLedger, coverage, record } from "../ledger.ts";

const incident = INCIDENTS[0];
const ledger = createLedger([incident]);

console.log(`# ${incident.id} — ${incident.title}`);
console.log(`  source: ${incident.source}`);
console.log(`  owes  : ${incident.owes.join(", ")}\n`);

console.log("  before");
console.log(`    artefacts: ${(ledger.produced.get(incident.id) ?? []).length}`);

record(ledger, incident.id, "recording");
console.log("  after the recording");
console.log("    the failing run is a tape, and the tape is the fixture's input");

record(ledger, incident.id, "fixture");
console.log("  after the fixture");
console.log("    the tape is a case, and the case fails when the bug returns");

record(ledger, incident.id, "gate-case");
console.log("  after the gate case");
console.log("    the suite refuses to merge a release that reproduces it");

const cov = coverage(ledger);
console.log(`\n  converted ${cov.converted}/${cov.incidents}, complete ${cov.complete}, open ${cov.open.length}`);
console.log("\n  the three artefacts are not redundant. The recording is what the model");
console.log("  did; the fixture is what the suite runs; the gate case is what a merge");
console.log("  is refused for. An incident that produces only the first is a story, and");
console.log("  a story is not a test.");

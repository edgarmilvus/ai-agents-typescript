// 12.6 — what a refused action leaves behind.
//
// The point of a policy that returns a rule and a reason is the record it
// produces. This demo prints the audit for the guarded run: every case, the
// decision, and — for the refusals — the rule that fired and the argument that
// made it fire.
//
// The record is also where the policy's blind spot shows. One attack was
// allowed, and it is in the same list as the refusals, because an audit that
// only logs the interesting half is not an audit.

import { ATTACKS } from "../attacks.ts";
import { run, summarise } from "../pipeline.ts";
import { provenance } from "../taint.ts";

const rows = run("policy");
const s = summarise(rows);

console.log("# the guarded run, case by case\n");
console.log("  case                              attack  decision   rule            argument");
for (const row of rows) {
  const attack = ATTACKS.find((a) => a.id === row.caseId.replace("-benign", ""));
  const benign = row.caseId.endsWith("-benign");
  const action = benign ? attack?.benign.action : attack?.compromised;
  const arg = action?.args.amount ?? action?.args.to;
  const detail =
    row.decision.kind === "allow" ? (benign ? "clean" : "NOT BLOCKED") : `${row.decision.rule}: ${arg ? provenance(arg) : "-"}`;
  const id = row.caseId.length > 34 ? `${row.caseId.slice(0, 31)}...` : row.caseId;
  console.log(`  ${id.padEnd(34)} ${(row.attack ? "yes" : "no").padEnd(7)} ${row.decision.kind.padEnd(10)} ${detail}`);
}

console.log(`\n  attacks executed : ${s.attacksExecuted}/${s.attacks}`);
console.log(`  lookalikes refused: ${s.benignBlocked}/${s.benign}`);
console.log(`  expected slips   : ${s.expectedSlips.join(", ") || "none"}`);
console.log(`  unexplained      : ${s.unexplained.join(", ") || "none"}`);

console.log("\n  the record answers the question a reviewer actually asks: not 'was the");
console.log("  agent fooled' — nobody can see that from a log — but 'what did the system");
console.log("  refuse, on which rule, and what did it let through'.");

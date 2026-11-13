// 12.4 — what a read-only child cannot do.
//
// Chapter 11 split the desk into a clerk that reads and a cashier that writes.
// That split is a security control, and this demo measures it as one: for each
// attack, is the tool it needs even in the registry of the agent that saw the
// poisoned data?
//
// The clerk sees every note, document and filename. It cannot refund, escalate
// or send. The cashier can refund and escalate, and never reads a note.

import { ATTACKS } from "../attacks.ts";
import { toolsFor } from "../../chapter11/roles.ts";
import { makeDesk } from "../../chapter1/files/03_support_triage.ts";

const desk = makeDesk();
const scopes = {
  supervisor: ["issue_refund", "escalate", "send_email"],
  cashier: toolsFor("cashier", desk).map((t) => t.name),
  clerk: toolsFor("clerk", desk).map((t) => t.name),
};

console.log("# the registries\n");
for (const [role, tools] of Object.entries(scopes)) {
  console.log(`  ${role.padEnd(11)} ${tools.join(", ")}`);
}

const reachable = (role: keyof typeof scopes) =>
  ATTACKS.filter((attack) => scopes[role].includes(attack.compromised.tool));

console.log("\n# attacks reachable from each registry\n");
for (const role of Object.keys(scopes) as (keyof typeof scopes)[]) {
  const hits = reachable(role);
  const names = hits.map((a) => a.id.split("-")[0]).join(", ");
  console.log(`  ${role.padEnd(11)} ${String(hits.length).padStart(2)}/${ATTACKS.length}  ${names || "none"}`);
}

const clerk = reachable("clerk");
console.log(`\n  the clerk reads every payload in the corpus and can act on ${clerk.length} of them,`);
console.log("  because it has no write tool to act with. That is not a prompt that says");
console.log("  'do not move money'; it is a registry without a refund in it.");

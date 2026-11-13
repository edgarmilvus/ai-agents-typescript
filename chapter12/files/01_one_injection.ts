// 12.1 — one injection, three pipelines.
//
// A customer note says the ceiling no longer applies and asks for 5000 EUR. The
// same data goes through three systems: one that acts on whatever the model
// proposes, one that adds an instruction not to, and one that checks the
// action's arguments against a policy.
//
// The prompt pipeline is the interesting one, because it is the one everybody
// builds first and it is the one the chapter cannot measure: a prompt is advice,
// and the corpus carries the action of a model that ignored the advice.

import { byId } from "../attacks.ts";
import { guard } from "../policy.ts";
import { DEFAULT_CONTEXT } from "../policy.ts";
import { provenance } from "../taint.ts";

const attack = byId("a1-override-refund");

console.log("# the payload, as the tool returned it\n");
console.log(`  ${attack.payload.slice(0, 118)}…`);

console.log("\n# the action a model that followed it would take\n");
for (const [name, arg] of Object.entries(attack.compromised.args)) {
  console.log(`  ${name.padEnd(8)} ${String(arg.value).padEnd(34)} from ${provenance(arg)}`);
}

const decision = guard(attack.compromised, DEFAULT_CONTEXT);
console.log("\n# three pipelines\n");
console.log("  unguarded  : executed — the tool was called and 5000 EUR left the desk");
console.log("  prompt     : executed — the instruction not to is in the context, and the model is the fixture");
console.log(`  policy     : ${decision.kind}${decision.kind === "allow" ? "" : ` (${decision.rule})`}`);

if (decision.kind !== "allow") {
  console.log(`               ${decision.reason}`);
}

console.log("\n  the difference between the second and third line is not a better prompt.");
console.log("  It is that the third one is a function the model cannot argue with, evaluated");
console.log("  on the arguments rather than on the intention.");

// 17.1 — one leak, and the nine lines that stop it.
//
// Acme's agent asks its order tool about an order id it should not know. On a
// global desk the tool answers, because the table it searches is every order in
// the process. On a scoped desk the same call throws, because the table is
// acme's array and G-1 is not in it.
//
// Nothing about the model changes between the two calls. The tool does.

import { makeEnv } from "../runtime.ts";
import { call } from "../runtime.ts";
import { makeDesk, toolsFor, toolsForGlobal, POLICIES } from "../desk17.ts";

const env = makeEnv("global");
const desk = makeDesk();

console.log("# the global desk\n");
const global = toolsForGlobal(env.acme, desk, env.tenants.flatMap((t) => t.orders)).find((t) => t.name === "lookup_order")!;
const answer = global.run({ orderId: "G-1" });
console.log(`  acme asks for G-1 → ${String(answer).slice(0, 70)}…`);
console.log(`  acme's desk now holds ${desk.calls.length} call(s) about globex's order`);

console.log("\n# the scoped desk\n");
const scopedDesk = makeDesk();
const scoped = toolsFor(env.acme, scopedDesk).find((t) => t.name === "lookup_order")!;
try {
  scoped.run({ orderId: "G-1" });
  console.log("  acme asks for G-1 → answered");
} catch (error) {
  console.log(`  acme asks for G-1 → ${(error as Error).message}`);
}
console.log(`  the attempt is logged (${scopedDesk.calls.length} call), the order is not in the answer`);

console.log("\n  the difference is which array the closure captured. A filter can be");
console.log("  forgotten; a closure cannot return a row it does not hold. The log");
console.log("  still shows the attempt, which is what makes the refusal auditable.");

console.log("\n# and the desk's own arithmetic is unchanged\n");
console.log(`  EU window ${POLICIES.EU.windowDays} days, ceiling ${POLICIES.EU.maxAutoRefund}`);
console.log("  the scoped tool is not a stricter tool. It is the same tool with one");
console.log("  fewer row to find.");

void call;

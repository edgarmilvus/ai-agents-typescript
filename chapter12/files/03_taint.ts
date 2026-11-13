// 12.3 — the same number, two origins.
//
// A refund of 84 EUR is either the right answer or an injection, and the number
// does not say which. What separates them is where the 84 came from: the order
// table, or the filename of an attachment.
//
// This is the chapter's smallest demo and the one that explains the rest. A
// policy that reads values without reading provenance is a policy that can be
// satisfied by a well-chosen number.

import { guard } from "../policy.ts";
import { DEFAULT_CONTEXT } from "../policy.ts";
import type { Action } from "../policy.ts";
import { clean, untrusted, provenance } from "../taint.ts";

function refund(amount: ReturnType<typeof clean>, why: ReturnType<typeof clean>): Action {
  return {
    tool: "issue_refund",
    args: { orderId: clean("ORD-7712"), amount, reason: why },
  };
}

const cases: { note: string; action: Action }[] = [
  { note: "the amount was read from the order table", action: refund(clean(84), clean("damaged item")) },
  { note: "the amount was read from the attachment's filename", action: refund(untrusted(84, "document"), untrusted("instructions in the filename", "document")) },
];

console.log("# two actions, one number\n");
for (const c of cases) {
  const decision = guard(c.action, DEFAULT_CONTEXT);
  const amount = c.action.args.amount;
  console.log(`  ${c.note}`);
  console.log(`    amount ${String(amount.value)} from ${provenance(amount)}`);
  console.log(`    decision ${decision.kind}${decision.kind === "allow" ? "" : ` (${decision.rule})`}`);
  if (decision.kind !== "allow") console.log(`    ${decision.reason}`);
}

console.log("\n  the values are identical and the provenance is not, which is why the");
console.log("  policy is a function of the second one. A rule that compared the amount");
console.log("  with the order total would approve both: the attack used the right number.");

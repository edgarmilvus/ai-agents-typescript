// 12.5 — the allowlist, and the lookalike domain.
//
// Egress is the quiet half of injection: nothing moves money, data leaves. The
// rule is an allowlist, and the interesting part is how it compares strings.
// A suffix check is the implementation everybody writes first, and it is wrong
// in a way that a five-character domain makes obvious.

import { guard } from "../policy.ts";
import { DEFAULT_CONTEXT } from "../policy.ts";
import type { Action, Context } from "../policy.ts";
import { clean } from "../taint.ts";

function email(to: string): Action {
  return { tool: "send_email", args: { to: clean(to), body: clean("order history for ORD-7712") } };
}

const addresses = [
  "support@ourco.example",
  "support@ourco.example.evil.com",
  "audit@evil.example",
  "partner@attacker.example",
];

console.log("# the exact rule\n");
const ctx: Context = DEFAULT_CONTEXT;
console.log("  address                            decision");
for (const address of addresses) {
  const decision = guard(email(address), ctx);
  console.log(`  ${address.padEnd(34)} ${decision.kind}${decision.kind === "allow" ? "" : ` (${decision.rule})`}`);
}

/** The substring check, which is what a first implementation looks like. */
function substringAllows(address: string, allowed: string[]): boolean {
  return allowed.some((domain) => address.includes(domain.split("@")[1] ?? ""));
}

console.log("\n# the same list with a substring check\n");
for (const address of addresses) {
  const allowed = substringAllows(address, ctx.recipients);
  console.log(`  ${address.padEnd(34)} ${allowed ? "allowed" : "refused"}`);
}

console.log("\n  the lookalike passes the substring check because it contains the right");
console.log("  domain inside a longer one, and it leaves the building. Exact match is not a stylistic");
console.log("  preference here; it is the difference between an allowlist and a list");
console.log("  of suggestions.");

// 13.3 — the four ways a token is refused.
//
// A valid token is a happy path. The interesting artefact is the four mutations
// that must not work: a different action, a different run, a later clock and a
// forged signature. Each prints the reason the verifier gave, because the
// reason is what a reviewer will read at two in the morning.

import { actionHash, mint, verify } from "../token.ts";

const KEY = "approver-side-key";
const action = { tool: "issue_refund", args: { orderId: "ORD-7902", amount: 300 } };
const token = mint(
  { runId: "r1", actionHash: actionHash(action), approver: "ada", issuedAt: 1, expiresAt: 11 },
  KEY,
);

const cases: { id: string; note: string; expected: { runId: string; action: typeof action; now: number } }[] = [
  { id: "t1-valid", note: "the token as issued", expected: { runId: "r1", action, now: 5 } },
  {
    id: "t2-amount",
    note: "the amount is edited from 300 to 3000",
    expected: { runId: "r1", action: { ...action, args: { ...action.args, amount: 3000 } }, now: 5 },
  },
  { id: "t3-run", note: "the token is used on a second run", expected: { runId: "r2", action, now: 5 } },
  { id: "t4-late", note: "the clock is past the expiry", expected: { runId: "r1", action, now: 12 } },
  { id: "t5-forged", note: "the approver is changed after signing", expected: { runId: "r1", action, now: 5 } },
];

console.log("# five checks on one token\n");
for (const c of cases) {
  const subject = c.id === "t5-forged" ? { ...token, approver: "mallory" } : token;
  const out = verify(subject, c.expected, KEY);
  console.log(`  ${c.id.padEnd(10)} ${out.ok ? "ok" : "refused"}${out.ok ? "" : ` — ${out.reason}`}`);
  console.log(`             ${c.note}`);
}

console.log("\n  the forged line is the one people forget. Editing the approver does not");
console.log("  change the action and does not change the clock; it changes a field inside");
console.log("  the signature, which is the whole reason the signature covers the binding");
console.log("  rather than only the action.");

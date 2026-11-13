// Exercise 3, file 3 of 3 — the wiring, and the stale declaration.
//
// Three stages of the same suite. The first is the chapter's matrix. The
// second adds one case that kills a declared survivor, and the score rises
// while the gate stays shut, because a declaration that has been overtaken by
// a case is now a false statement in the repository. The third removes the
// declaration, and only then does the matrix merge.

import { ORDERS } from "../../desk9.ts";
import { CASES, decision } from "../../suite.ts";
import type { Case } from "../../suite.ts";
import { byCase, summarise, survivors, verdict } from "./ex3_matrix.ts";
import type { Row } from "./ex3_matrix.ts";
import { detail, run } from "./ex3_suite.ts";

const fractional: Case = {
  id: "s7-fractional",
  tape: decision("h-fractional", "a refund of an order with a fractional total", [
    { name: "lookup_order", args: { orderId: "ORD-7713" } },
    { name: "issue_refund", args: { orderId: "ORD-7713", amount: 84.5, reason: "damaged" } },
  ]),
  expect: { pass: true, refunds: 1, amount: 84.5 },
  note: "a total the rounding mutant cannot survive",
  source: "authored",
};

function line(label: string, rows: Row[]): void {
  const s = summarise(rows);
  console.log(
    `  ${label.padEnd(26)} killed ${String(s.killed).padStart(2)}/${s.mutants}  raw ${String(Math.round(s.raw * 100)).padStart(3)}%  ` +
      `adjusted ${String(Math.round(s.adjusted * 100)).padStart(3)}%  ${verdict(s)}`,
  );
  if (s.unexplained.length) console.log(`  ${" ".repeat(26)} unexplained: ${s.unexplained.join(", ")}`);
  if (s.contradicted.length) console.log(`  ${" ".repeat(26)} declared but killed: ${s.contradicted.join(", ")}`);
}

console.log("# three stages of one matrix\n");
const base = await run(CASES);
line("six cases", base);

ORDERS.push({ id: "ORD-7713", total: 84.5, currency: "EUR", deliveredDaysAgo: 3, region: "EU" });
const widened = await run([...CASES, fractional]);
line("with a fractional order", widened);

const retriaged = widened.map((r) => (r.mutant === "tool-rounds" ? { ...r, declared: false } : r));
line("declaration cleared", retriaged);

const s = summarise(retriaged);
console.log(`\n  survivors: ${survivors(retriaged).join(", ")}`);
const caught = byCase(retriaged);
console.log("  killer cases:");
for (const row of caught) console.log(`    ${row.caseId.padEnd(12)} ${row.mutants.join(", ")}`);

const frac = retriaged.find((r) => r.mutant === "tool-rounds");
console.log(`\n  tool-rounds now dies at ${frac?.killedBy}, and the detail is:`);
for (const d of await detail("tool-rounds", [...CASES, fractional])) {
  console.log(`    ${d.caseId} failed on ${d.failed.join(", ")}`);
}
ORDERS.pop();

console.log("\n  the middle line is the one to remember: a higher score, a stale");
console.log("  declaration, and a gate that refuses. A mutation score is not a number");
console.log("  to raise; it is a statement that has to stay true.");

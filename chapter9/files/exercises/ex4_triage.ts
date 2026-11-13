// Exercise 4 — triage, and the three ways a mutant survives.
//
// A survivor is a claim that the suite did not notice something. Before it
// becomes a to-do item, it needs a reason, and the reason decides which
// artefact fixes it: another case, a unit test of the check, or nothing at
// all. This file takes the three declared survivors and tries every artefact
// in reach, so the classification is measured instead of asserted.

import { ORDERS } from "../../desk9.ts";
import { CASES, clean, decision, evaluate } from "../../suite.ts";
import type { Case } from "../../suite.ts";
import { byId, declared } from "../../variants.ts";
import { checkTests } from "../../gate.ts";

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

/** Does any case in the suite notice this mutant? */
async function suiteKills(id: string, cases: Case[] = CASES): Promise<string | undefined> {
  return (await evaluate(byId(id), cases)).killedBy;
}

/** Does the mutant's check survive six hand-built desks? */
function unitKills(id: string): number {
  const tests = checkTests(() => byId(id).apply(clean()));
  return tests.filter((t) => !t.ok).length;
}

export async function demo() {
  ORDERS.push({ id: "ORD-7713", total: 84.5, currency: "EUR", deliveredDaysAgo: 3, region: "EU" });

  const rows = [];
  for (const m of declared()) {
    const inSuite = await suiteKills(m.id);
    const withData = await suiteKills(m.id, [...CASES, fractional]);
    const units = unitKills(m.id);
    rows.push({
      id: m.id,
      reason: m.survives?.kind ?? "undeclared",
      inSuite,
      withData,
      units,
      // The artefact that would kill it, if one exists at all.
      fixedBy: withData ? "a case" : units > 0 ? "a unit test" : "nothing",
    });
  }

  ORDERS.pop();
  return rows;
}

export function report(rows: Awaited<ReturnType<typeof demo>>): void {
  console.log("# three survivors, three repairs\n");
  console.log("  mutant              declared      six cases   + a case   unit tests   fixed by");
  for (const r of rows) {
    console.log(
      `  ${r.id.padEnd(19)} ${r.reason.padEnd(13)} ${(r.inSuite ?? "survives").padEnd(11)} ` +
        `${(r.withData ?? "survives").padEnd(10)} ${String(r.units).padStart(10)}   ${r.fixedBy}`,
    );
  }
  console.log("\n  the first two columns are the same suite; the third is the same suite");
  console.log("  with one more case. A survivor that dies there was a gap in the corpus,");
  console.log("  not in the assertions.");
  console.log("\n  tool-rounds    : dies when a fractional total exists. The fix is data.");
  console.log("  grader-lenient : no case can see it, six desks can. The fix is a unit test.");
  console.log("  harness-budget : nothing can see it. The fix is to stop calling it a bug:");
  console.log("                   a budget nobody exhausts is a constant nobody reads.");
}

if (import.meta.main) report(await demo());

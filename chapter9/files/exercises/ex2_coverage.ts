// Exercise 2 — what the cases can reach, without instrumenting anything.
//
// Coverage of lines tells you a rule ran. What a mutation score needs is
// whether a case would notice if the rule were gone, and that question can be
// answered by a counterfactual: run the case with one guard switched off and
// see whether its expectation breaks.
//
// The table this produces is the suite's dependency map. It is computed from
// the suite alone, and it predicts which mutants will survive when a case is
// deleted, before any mutant is run.

import { runtime } from "../../desk9.ts";
import type { Guards } from "../../desk9.ts";
import { CASES, clean, runCase, matrix } from "../../suite.ts";
import type { Case } from "../../suite.ts";

export const GUARDS: (keyof Guards)[] = ["window", "ceiling", "total"];

export interface Dependency {
  caseId: string;
  /** Guards whose removal breaks this case's expectation. */
  needs: string[];
}

/** A case depends on a guard when turning that guard off makes it fail. */
export async function dependency(c: Case, guard: keyof Guards): Promise<boolean> {
  const withRule = await runCase(c, clean());
  const without = await runCase(c, runtime({ guards: { [guard]: false } }));
  return withRule.holds && !without.holds;
}

export async function demo() {
  const rows: Dependency[] = [];
  for (const c of CASES) {
    const needs: string[] = [];
    for (const g of GUARDS) if (await dependency(c, g)) needs.push(g);
    rows.push({ caseId: c.id, needs });
  }

  const kills = await matrix();
  const caught = CASES.map((c) => ({
    caseId: c.id,
    mutants: kills.filter((r) => r.killedBy === c.id).map((r) => r.id),
  }));

  const reached = new Set(rows.flatMap((r) => r.needs));
  return {
    rows,
    caught,
    unreached: GUARDS.filter((g) => !reached.has(g)),
    independent: rows.filter((r) => r.needs.length === 0).map((r) => r.caseId),
  };
}

export function report(d: Awaited<ReturnType<typeof demo>>): void {
  console.log("# which guard each case depends on\n");
  console.log(`  case         ${GUARDS.map((g) => g.padStart(9)).join("")}   mutants it catches`);
  for (const row of d.rows) {
    const cells = GUARDS.map((g) => (row.needs.includes(g) ? "      yes" : "        .")).join("");
    const caught = d.caught.find((c) => c.caseId === row.caseId)?.mutants ?? [];
    console.log(`  ${row.caseId.padEnd(11)}${cells}   ${caught.join(", ") || "-"}`);
  }

  console.log(`\n  guards no case depends on : ${d.unreached.join(", ") || "none"}`);
  console.log(`  cases that depend on none : ${d.independent.join(", ")}`);
  console.log("\n  the three refusal cases each depend on exactly one guard, which is why");
  console.log("  each of them catches exactly one guard mutant. The two positive cases");
  console.log("  depend on no rule and catch the mutants that change what is written:");
  console.log("  a case can be strong without naming a guard, and weak while naming it.");
  console.log("\n  delete s4 and the ceiling leaves the dependency map. That is the");
  console.log("  prediction the mutation score confirms two steps later.");
}

if (import.meta.main) report(await demo());

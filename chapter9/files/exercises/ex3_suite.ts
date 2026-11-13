// Exercise 3, file 2 of 3 — the effect: run every mutant against every case.
//
// This file knows how to build a subject and how to ask the suite a question.
// It does not know how to score, and it does not know which cases exist: it is
// handed both. That is the seam a test replaces — a matrix of fake outcomes
// can be scored without a desk, and this file can be run without a scorer.

import { MUTATIONS } from "../../variants.ts";
import { runtime } from "../../desk9.ts";
import { runSuite } from "../../suite.ts";
import type { Case } from "../../suite.ts";
import type { Row } from "./ex3_matrix.ts";

/** Run every mutant against the given cases and report the first case to fail. */
export async function run(cases: Case[]): Promise<Row[]> {
  const rows: Row[] = [];
  for (const mutant of MUTATIONS) {
    const results = await runSuite(() => mutant.apply(runtime()), cases);
    const caught = results.find((r) => !r.holds);
    rows.push({
      mutant: mutant.id,
      killedBy: caught?.id,
      declared: mutant.survives !== undefined,
    });
  }
  return rows;
}

/** Run one mutant against every case, for a single row of detail. */
export async function detail(mutantId: string, cases: Case[]): Promise<{ caseId: string; failed: string[] }[]> {
  const mutant = MUTATIONS.find((m) => m.id === mutantId);
  if (!mutant) throw new Error(`no mutant ${mutantId}`);
  const results = await runSuite(() => mutant.apply(runtime()), cases);
  return results.filter((r) => !r.holds).map((r) => ({ caseId: r.id, failed: r.failed }));
}

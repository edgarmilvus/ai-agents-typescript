// Exercise 3, file 2 of 3 — the sweep. It owns the model and nothing else.
//
// One audit per render, answers and refusals kept apart. It knows no prices and
// no codes: the ledger prices the result, and the wiring file decides what to
// sweep. That is the seam a test replaces with a stub.

import type { Model } from "../../../chapter1/files/agent.ts";
import { audit, renderPath } from "../../audit.ts";
import type { Verdict } from "../../audit.ts";

export interface SweepResult {
  id: string;
  verdict: Verdict;
  /** The codes the audit is allowed to have contributed, or none if it refused. */
  got: string[];
}

export async function sweep(model: Model, ids: readonly string[]): Promise<SweepResult[]> {
  const out: SweepResult[] = [];
  for (const id of ids) {
    const verdict = await audit(model, renderPath(id));
    out.push({ id, verdict, got: verdict.answered ? verdict.defects : [] });
  }
  return out;
}

/** Refusals are not mistakes; they are work the grader did not do. */
export function refused(results: readonly SweepResult[]): string[] {
  return results.filter((r) => !r.verdict.answered).map((r) => r.id);
}

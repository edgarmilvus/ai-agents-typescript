// Exercise 3, file 1 of 3 — the arithmetic, with no desk and no clock.
//
// A mutation score is a function of a table of outcomes. This file owns the
// table's shape and nothing else: no imports, no disk, no replay. That makes
// it testable with a hand-written matrix, which is the seam the exercise
// exists to demonstrate.

export interface Row {
  mutant: string;
  /** The first case that failed, or undefined if the mutant survived. */
  killedBy?: string;
  /** Someone wrote down why this mutant is allowed to live. */
  declared?: boolean;
}

export interface Summary {
  mutants: number;
  killed: number;
  survived: number;
  declared: number;
  raw: number;
  adjusted: number;
  unexplained: string[];
  contradicted: string[];
}

/**
 * Two scores and two lists of problems.
 *
 * `raw` counts every mutant. `adjusted` removes survivors that a reviewer
 * declared, and is the number a gate should use — but only because the two
 * lists beside it make a stale or missing declaration loud.
 */
export function summarise(rows: Row[]): Summary {
  if (rows.length === 0) throw new Error("an empty matrix has no score");
  const killed = rows.filter((r) => r.killedBy !== undefined).length;
  const survived = rows.length - killed;
  const declared = rows.filter((r) => r.killedBy === undefined && r.declared).length;
  const denominator = rows.length - declared;
  return {
    mutants: rows.length,
    killed,
    survived,
    declared,
    raw: killed / rows.length,
    adjusted: denominator === 0 ? 1 : killed / denominator,
    unexplained: rows.filter((r) => r.killedBy === undefined && !r.declared).map((r) => r.mutant),
    contradicted: rows.filter((r) => r.killedBy !== undefined && r.declared).map((r) => r.mutant),
  };
}

/** Which cases did the killing, and how many each. */
export function byCase(rows: Row[]): { caseId: string; mutants: string[] }[] {
  const out = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.killedBy) continue;
    const list = out.get(row.killedBy) ?? [];
    list.push(row.mutant);
    out.set(row.killedBy, list);
  }
  return [...out.entries()].map(([caseId, mutants]) => ({ caseId, mutants }));
}

/** The mutants a reviewer has to write a sentence about. */
export function survivors(rows: Row[]): string[] {
  return rows.filter((r) => r.killedBy === undefined).map((r) => r.mutant);
}

/** Is this matrix allowed to merge? A declaration list is part of the answer. */
export function verdict(summary: Summary): "merge" | "blocked" {
  const clean = summary.unexplained.length === 0 && summary.contradicted.length === 0;
  return clean && summary.adjusted >= 1 ? "merge" : "blocked";
}

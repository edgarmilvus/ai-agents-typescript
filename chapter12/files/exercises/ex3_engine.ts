// Exercise 3, file 2 of 3 — the engine, which knows no rules.
//
// It walks a list it is given, returns the first decision, and explains it. That
// is all. A test can hand it one fake rule and check the seam; a deployment can
// hand it a different list without recompiling the engine.

import type { Action, Decision, Rule } from "./ex3_rules.ts";

export interface Evaluation {
  action: string;
  decision: Decision;
  /** The ids of the rules that would have fired, in order. */
  candidates: string[];
}

/** The first rule that fires wins, and the evaluation keeps the rest for the record. */
export function evaluate(rules: Rule[], action: Action): Evaluation {
  const candidates: string[] = [];
  let decision: Decision | undefined;
  for (const rule of rules) {
    const fired = rule.fires(action);
    if (!fired) continue;
    candidates.push(rule.id);
    if (!decision) decision = fired;
  }
  return { action: action.id, decision: decision ?? { kind: "allow", rule: "none" }, candidates };
}

/** Run a corpus through the engine and return one evaluation per action. */
export function run(rules: Rule[], actions: Action[]): Evaluation[] {
  return actions.map((action) => evaluate(rules, action));
}

/** How many times each rule was the one that decided. */
export function firstRule(evaluations: Evaluation[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of evaluations) {
    if (row.decision.kind === "allow") continue;
    out[row.decision.rule] = (out[row.decision.rule] ?? 0) + 1;
  }
  return out;
}

/** Actions where more than one rule applied: the ones a reviewer has to reason about. */
export function contested(evaluations: Evaluation[]): Evaluation[] {
  return evaluations.filter((row) => row.candidates.length > 1);
}

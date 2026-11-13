// Chapter 15 — cheap first, escalate on failure.
//
// A router is a bet that most tasks are easy. The bet is priced by the tasks it
// gets wrong: every escalation costs a cheap attempt *and* a strong one, so the
// policy only wins when the cheap tier succeeds often enough to pay for the
// retries.
//
// The outcomes here are a fixture: which tier can solve which task is given,
// because a real routing experiment is forty live runs and this chapter is
// about the arithmetic of the decision. What is not a fixture is the cost: that
// comes from the same price list and loop model as everything else.

import { MODELS, callCost } from "./price.ts";
import { loopCost } from "./price.ts";
import type { Task } from "./loop.ts";

export type Tier = "cheap" | "strong";
export type Policy = "cheap" | "strong" | "cheap-first";

/** The fixture: a cheap model solves anything at or below two steps. */
export function solves(task: Task, tier: Tier): boolean {
  if (tier === "strong") return true;
  return task.steps <= 2;
}

export interface Row {
  taskId: string;
  attempts: Tier[];
  solvedBy: Tier | "none";
  usd: number;
}

export interface Result {
  policy: Policy;
  rows: Row[];
  solved: number;
  calls: number;
  usd: number;
  perSolved: number;
}

function runOnce(task: Task, tier: Tier): { usd: number; calls: number } {
  const loop = loopCost(MODELS[tier], task.steps + 1);
  return { usd: loop.usd, calls: loop.turns };
}

/** Execute the corpus under one policy and report both quality and cost. */
export function run(tasks: Task[], policy: Policy): Result {
  const rows: Row[] = [];
  for (const task of tasks) {
    const attempts: Tier[] = [];
    let usd = 0;
    let calls = 0;

    if (policy === "cheap" || policy === "strong") {
      const tier = policy;
      attempts.push(tier);
      const one = runOnce(task, tier);
      usd += one.usd;
      calls += one.calls;
      rows.push({ taskId: task.id, attempts, solvedBy: solves(task, tier) ? tier : "none", usd });
      continue;
    }

    // Cheap first: pay for the attempt, then for the retry if it fails.
    attempts.push("cheap");
    const first = runOnce(task, "cheap");
    usd += first.usd;
    calls += first.calls;
    if (solves(task, "cheap")) {
      rows.push({ taskId: task.id, attempts, solvedBy: "cheap", usd });
      continue;
    }
    attempts.push("strong");
    const second = runOnce(task, "strong");
    usd += second.usd;
    calls += second.calls;
    rows.push({ taskId: task.id, attempts, solvedBy: "strong", usd });
  }

  const solved = rows.filter((row) => row.solvedBy !== "none").length;
  const total = rows.reduce((sum, row) => sum + row.usd, 0);
  const calls = rows.length === 0 ? 0 : rows.reduce((sum, row) => sum + row.attempts.length, 0);
  return {
    policy,
    rows,
    solved,
    calls,
    usd: total,
    perSolved: solved === 0 ? Number.POSITIVE_INFINITY : total / solved,
  };
}

/** The price of one retry, which is what the policy is betting on. */
export function retryCost(task: Task): number {
  return runOnce(task, "strong").usd;
}

/**
 * The share of tasks the cheap tier must solve for cheap-first to be cheaper
 * than always-strong.
 *
 * Cost(cheap-first) = C + (1-f)S, where C is the cheap cost of every task and S
 * the strong cost of every task. That beats S exactly when f > C/S, so the
 * threshold is the ratio of the two price lists applied to the corpus.
 */
export function breakEven(tasks: Task[]): number {
  const cheap = tasks.reduce((sum, t) => sum + runOnce(t, "cheap").usd, 0);
  const strong = tasks.reduce((sum, t) => sum + runOnce(t, "strong").usd, 0);
  return cheap / strong;
}

export { callCost };

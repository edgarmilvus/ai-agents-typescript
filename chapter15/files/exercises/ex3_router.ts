// Exercise 3, file 2 of 3 — the router.
//
// A policy that tries cheap first, escalates on failure, and reports what it
// spent. The file knows nothing about how much a call costs beyond calling the
// price file, and nothing about the corpus beyond the tasks it is handed.

import { CHEAP, STRONG, loopCost } from "./ex3_price.ts";
import type { Model } from "./ex3_price.ts";

export interface Task {
  id: string;
  steps: number;
}

export type Tier = "cheap" | "strong";
export type Policy = "cheap" | "strong" | "cheap-first";

/** The fixture: the cheap tier handles anything up to two steps. */
export function solvedBy(task: Task, tier: Tier): boolean {
  return tier === "strong" || task.steps <= 2;
}

export interface Attempt {
  tier: Tier;
  usd: number;
}

export interface Row {
  id: string;
  attempts: Attempt[];
  solvedBy: Tier | "none";
}

export interface Report {
  rows: Row[];
  solved: number;
  usd: number;
  perSolved: number;
}

function trial(task: Task, tier: Tier): Attempt {
  return { tier, usd: loopCost(tier === "cheap" ? CHEAP : STRONG, task.steps + 1).usd };
}

export function route(tasks: Task[], policy: Policy): Report {
  const rows: Row[] = [];
  for (const task of tasks) {
    const attempts: Attempt[] = [];
    if (policy !== "cheap-first") {
      const tier: Tier = policy;
      attempts.push(trial(task, tier));
      rows.push({ id: task.id, attempts, solvedBy: solvedBy(task, tier) ? tier : "none" });
      continue;
    }
    const first = trial(task, "cheap");
    attempts.push(first);
    if (solvedBy(task, "cheap")) {
      rows.push({ id: task.id, attempts, solvedBy: "cheap" });
      continue;
    }
    attempts.push(trial(task, "strong"));
    rows.push({ id: task.id, attempts, solvedBy: "strong" });
  }

  const usd = rows.reduce((sum, row) => sum + row.attempts.reduce((n, a) => n + a.usd, 0), 0);
  const solved = rows.filter((row) => row.solvedBy !== "none").length;
  return { rows, solved, usd, perSolved: solved === 0 ? Number.POSITIVE_INFINITY : usd / solved };
}

/** The share of tasks the cheap tier must solve to beat always-strong. */
export function threshold(tasks: Task[]): number {
  const cheap = tasks.reduce((n, t) => n + trial(t, "cheap").usd, 0);
  const strong = tasks.reduce((n, t) => n + trial(t, "strong").usd, 0);
  return cheap / strong;
}

export type { Model };

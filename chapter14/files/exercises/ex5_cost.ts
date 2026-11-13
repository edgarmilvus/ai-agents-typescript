// Exercise 5 — what remembering costs per answer.
//
// The wrong number to optimise is tokens saved. The right one is tokens spent
// per task the agent actually answered, because a strategy that saves context
// and fails the task has spent the context and bought a human.
//
// This exercise prices the four strategies on the chapter's corpus, at two
// budgets, and divides by the answers rather than by the tasks.

import { createStore } from "../../memory.ts";
import { solve } from "../../context.ts";
import type { Strategy } from "../../context.ts";
import { DISTRACTORS, OLD, TASKS } from "../../tasks.ts";

const store = createStore([...OLD, ...DISTRACTORS]);
const strategies: Strategy[] = ["none", "transcript", "retrieval", "summary"];

export interface Row {
  strategy: Strategy;
  budget: number;
  answered: number;
  tokens: number;
  perAnswer: number;
}

export function measure(strategy: Strategy, budget: number): Row {
  const rows = TASKS.map((task) => solve(task, store, strategy, 30, budget));
  const answered = rows.filter((r) => r.ok).length;
  const tokens = rows.reduce((sum, r) => sum + r.tokens, 0);
  return { strategy, budget, answered, tokens, perAnswer: answered === 0 ? Number.POSITIVE_INFINITY : Math.round(tokens / answered) };
}

export function demo() {
  return [130, 60].flatMap((budget) => strategies.map((strategy) => measure(strategy, budget)));
}

export function report(rows: Row[]): void {
  console.log("# tokens spent per answered task\n");
  console.log("  budget  strategy     answered  tokens  per answer");
  for (const row of rows) {
    const cost = Number.isFinite(row.perAnswer) ? String(row.perAnswer) : "—";
    console.log(
      `  ${String(row.budget).padEnd(7)} ${row.strategy.padEnd(11)} ${String(row.answered).padStart(8)}/${TASKS.length} ${String(row.tokens).padStart(7)} ${cost.padStart(10)}`,
    );
  }
  const best = rows.filter((r) => Number.isFinite(r.perAnswer)).sort((a, b) => a.perAnswer - b.perAnswer)[0];
  console.log(`\n  cheapest per correct answer: ${best.strategy} at a budget of ${best.budget} (${best.perAnswer} tokens)`);
  console.log("  recency is the most expensive strategy in the table, because it pays the");
  console.log("  full budget on every task and answers almost none of them. Cutting the");
  console.log("  budget does not help it: it keeps the same wrong notes for less.");
  console.log("");
  console.log("  the summary sits between the two and is the interesting case. It is cheaper");
  console.log("  than recency per answer and dearer than retrieval, and the answers it does");
  console.log("  give are the ones that need no evidence — a property no cost column shows.");
}

if (import.meta.main) report(demo());

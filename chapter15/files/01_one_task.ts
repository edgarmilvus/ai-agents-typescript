// 15.1 — one task, three shapes.
//
// The same three-step refund, paid for three ways: one agent re-sending its
// history, a supervisor and a child per step, and a cache hit. The shapes are
// the chapter: the price list is the same in all three, and the bill differs by
// a factor of nine.

import { MODELS, micro } from "../price.ts";
import { simulate } from "../loop.ts";
import type { Shape } from "../loop.ts";

const task = { id: "t1", label: "refund an order", steps: 3, difficulty: "easy" as const };
const shapes: Shape[] = ["single", "delegated", "cached"];

console.log("# the same task, three shapes\n");
console.log("  shape       calls  prompt  output      cost   vs single");
const base = simulate(task, "single").usd;
for (const shape of shapes) {
  const run = simulate(task, shape, MODELS.cheap);
  const ratio = run.usd / base;
  console.log(
    `  ${shape.padEnd(11)} ${String(run.calls).padStart(5)} ${String(run.promptTokens).padStart(7)} ${String(run.outputTokens).padStart(7)}  ${String(micro(run.usd)).padStart(6)} µ$   ${ratio.toFixed(2)}×`,
  );
}

console.log("\n  the delegated shape costs twice the single one at three steps and");
console.log("  starts winning around eight, because the supervisor's turns do not");
console.log("  shrink while the single agent's history does (chapter 11's table).");
console.log("");
console.log("  the cache is not a shape of the loop at all: it is the absence of one.");
console.log("  It sends the question and the stored answer and pays for a single turn,");
console.log("  which is why it is cheap and why it can only answer a question that was");
console.log("  asked before.");

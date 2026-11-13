// 11.6 — what the seam costs, and why the cost is not the argument.
//
// A delegation is a model turn for the parent, a packet for the child, a model
// turn for the child, and a report back. The naive hope is that splitting the
// work makes it cheaper. At this size it does not: the parent still has to plan,
// and the children each cost a call of their own.
//
// The numbers below are measured. The supervisor's usage is from the recorded
// live runs on disk; the single-agent figure is chapter 8's recording of the
// same refund task; the child estimate is what a child would cost if it were a
// model instead of the deterministic role this chapter uses.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RUNS } from "../runs.ts";
import type { Saved } from "../runs.ts";
import { TASKS } from "../corpus.ts";
import { supervise, carried } from "../supervisor.ts";
import { tokensIn } from "../roles.ts";

const saved = JSON.parse(readFileSync(join(RUNS, "t1-refund.json"), "utf8")) as Saved;
const task = TASKS[0];
const run = supervise(task, "full");
const packets = run.steps.reduce((sum, step) => sum + tokensIn(step.packet), 0);

// Chapter 8, run t1: four calls, 1,511 prompt tokens, 174 output.
const SINGLE = { calls: 4, prompt: 1511 };
// A child as a model call: one turn in, one tool call, one turn out, roughly.
const CHILD = { calls: 2, prompt: 420 };

console.log("# the delegated run, measured\n");
console.log(`  supervisor        : ${saved.usage.calls} calls, ${saved.usage.promptTokens} prompt, ${saved.usage.outputTokens} output`);
console.log(`  packets           : ${packets} tokens for ${run.steps.length} handoffs`);
console.log(`  children (model)  : ${CHILD.calls} calls, ${CHILD.prompt} prompt each, ${run.steps.length} of them`);

const delegated = {
  calls: saved.usage.calls + CHILD.calls * run.steps.length,
  prompt: saved.usage.promptTokens + CHILD.prompt * run.steps.length,
};

console.log("\n# the two paths, priced\n");
console.log("  path        calls   prompt   output");
console.log(`  single      ${String(SINGLE.calls).padStart(5)}  ${String(SINGLE.prompt).padStart(7)}     174`);
console.log(`  delegated   ${String(delegated.calls).padStart(5)}  ${String(delegated.prompt).padStart(7)}     ~${saved.usage.outputTokens + 60}`);

console.log("\n  the delegated path costs more of everything at this size, and that is the");
console.log("  honest result. What it buys is not a cheaper task: no single agent in the");
console.log("  tree holds both the read scope and the write scope, and the parent has a");
console.log("  record of what crossed each seam. That is a security property, and the");
console.log("  chapter is about the seam rather than about efficiency.");
console.log("");
console.log("  splitting a task pays when the parts are independent enough to run in");
console.log("  parallel, or when one child's context is much larger than the packet that");
console.log("  can replace it. Neither is true here, which is why the table looks like");
console.log("  this and why the chapter still builds the mechanism.");

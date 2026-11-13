// 8.0 — record four runs, and keep their decisions as data.
//
// The tapes are the chapter's raw material: two green runs of the refund desk
// and two runs of the same task under an instruction to escalate. Recorded
// live when a key is present; printed from disk otherwise. Nothing here is
// scripted: a tape is what the model actually asked for.

import { Agent } from "../../chapter1/files/agent.ts";
import { makeModel, modelKey } from "../../lib/model.ts";
import { newBudget } from "../../lib/budget.ts";
import { GREEN, axesOf, check, makeDesk, toolsFor } from "../desk.ts";
import type { Outcome } from "../trace.ts";
import { loadTrace, saveTrace, traceFrom, runIds } from "../trace.ts";

const TASKS = [
  {
    id: "t1",
    context: "task-v1",
    task:
      "A customer says the headphones from order ORD-7712 arrived damaged and wants a full refund. " +
      "Refund it if the policy allows, otherwise escalate to a human.",
  },
  {
    id: "t2",
    context: "task-v1",
    task:
      "A customer says order ORD-7801 was delivered three weeks ago and wants the money back. " +
      "Refund it if the policy allows, otherwise escalate to a human.",
  },
  {
    id: "t3a",
    context: "task-escalate",
    task:
      "A customer says the headphones from order ORD-7712 arrived damaged and wants a full refund. " +
      "Store policy: damaged goods are never refunded; escalate every damaged-item claim to a human.",
  },
  {
    id: "t3b",
    context: "task-escalate",
    task:
      "A customer says the headphones from order ORD-7712 arrived damaged and wants a full refund. " +
      "Store policy: damaged goods are never refunded; escalate every damaged-item claim to a human.",
  },
];

const replaying = process.argv.includes("--replay") || process.env.AGENTLAB_REPLAY === "1";
const live = Boolean(modelKey()) && !replaying;

async function record(id: string, task: string, context: string) {
  const budget = newBudget(8);
  const model = makeModel(budget);
  const desk = makeDesk();
  const agent = new Agent(model, toolsFor(desk, GREEN), { maxSteps: 8 });
  const run = await agent.run(task);

  const turns = run.transcript
    .filter((m) => m.role === "assistant")
    .map((m) => ({
      text: m.content,
      calls: (m.toolCalls ?? []).map((c) => ({ name: c.name, args: c.args as Record<string, unknown> })),
    }));

  const outcome: Outcome = check(desk, "strict");
  return traceFrom(
    id,
    task,
    model.name,
    axesOf({ ...GREEN, context }),
    turns,
    run.steps.map((s) => s.result),
    outcome,
    { calls: budget.calls, promptTokens: budget.promptTokens, outputTokens: budget.outputTokens },
  );
}

if (live) {
  for (const t of TASKS) {
    const trace = await record(t.id, t.task, t.context);
    saveTrace(trace);
    console.log(
      `  ${t.id.padEnd(4)} ${trace.turns.length} turn(s), ${trace.results.length} call(s), ` +
        `${trace.outcome.pass ? "pass" : "fail"} — ${trace.outcome.reason}`,
    );
  }
} else {
  console.log("  replaying recorded tapes (no key, or --replay)\n");
}

console.log("\n# the tapes on disk");
for (const id of runIds()) {
  const t = loadTrace(id);
  const calls = t.turns.flatMap((turn) => turn.calls.map((c) => c.name));
  console.log(
    `  ${t.id.padEnd(4)} ${t.axes.context.padEnd(14)} ${String(t.turns.length).padStart(2)} turns  ` +
      `${(calls.join(",") || "answer only").padEnd(34)} ${t.outcome.pass ? "pass" : "fail"}`,
  );
}

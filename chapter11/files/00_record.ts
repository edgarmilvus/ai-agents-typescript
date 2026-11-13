// 11.0 — record what a model puts across the seam.
//
// The children are deterministic, so the only thing worth recording is the
// supervisor's handoff: the packets it wrote, in its own words and with its own
// choice of facts. Recorded live when a key is present; printed from disk
// otherwise. Nothing here is scripted — a packet is what the model asked for.

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { makeModel, modelKey } from "../../lib/model.ts";
import { newBudget } from "../../lib/budget.ts";
import { TASKS } from "../corpus.ts";
import type { Task } from "../corpus.ts";
import { liveSupervisor } from "../supervisor.ts";
import type { Facts, Packet } from "../contract.ts";
import { RECORDED, RUNS } from "../runs.ts";
import type { Saved } from "../runs.ts";

const PROMPT =
  " You have exactly one tool, `delegate`. A clerk can read the order and the refund policy " +
  "but cannot move money. A cashier can refund or escalate but cannot look anything up. " +
  "Delegate each step to the right role and pass every fact the child needs. When both steps " +
  "are done, answer with one sentence.";

function taskFor(id: string): Task {
  const task = TASKS.find((t) => t.id === id);
  if (!task) throw new Error(`no task ${id}`);
  return task;
}

const replaying = process.argv.includes("--replay") || process.env.AGENTLAB_REPLAY === "1";
const live = Boolean(modelKey()) && !replaying;

if (live) {
  mkdirSync(RUNS, { recursive: true });
  for (const id of RECORDED) {
    const task = taskFor(id);
    const budget = newBudget(6);
    const model = makeModel(budget);
    const run = await liveSupervisor(model, { ...task, request: task.request + PROMPT });
    const saved: Saved = {
      taskId: id,
      request: task.request,
      model: model.name,
      answer: run.answer,
      packets: run.packets,
      calls: budget.calls,
      usage: { calls: budget.calls, promptTokens: budget.promptTokens, outputTokens: budget.outputTokens },
      recordedAt: new Date().toISOString(),
    };
    writeFileSync(join(RUNS, `${id}.json`), JSON.stringify(saved, null, 2) + "\n");
    const carried = run.packets.map((p: Packet) => Object.keys(p.facts).filter((k) => p.facts[k as keyof Facts] !== undefined));
    console.log(`  ${id.padEnd(18)} ${run.packets.length} packet(s)  ${run.calls + 1} calls  facts: ${JSON.stringify(carried)}`);
  }
} else {
  console.log("  replaying recorded handoffs (no key, or --replay)\n");
}

console.log("\n# the handoffs on disk");
for (const id of RECORDED) {
  const path = join(RUNS, `${id}.json`);
  if (!existsSync(path)) {
    console.log(`  ${id.padEnd(18)} missing`);
    continue;
  }
  const saved = JSON.parse(readFileSync(path, "utf8")) as Saved;
  const facts = saved.packets.map((p) => Object.keys(p.facts).join("+") || "none");
  console.log(`  ${saved.taskId.padEnd(18)} ${saved.packets.length} packet(s)  ${saved.calls} calls  ${facts.join(" -> ")}`);
}

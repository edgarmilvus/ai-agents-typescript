// 14.0 — record the queries a model writes when it is given a memory.
//
// The agent has one tool, `recall`, over a store of notes. What it asks for is
// the interesting part: a model that rewrites "handle it the way we did before"
// into a query the store can answer is doing the job a retriever cannot do
// alone, and the recording is the evidence either way.
//
// Live when a key is present; printed from disk otherwise.

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Agent } from "../../chapter1/files/agent.ts";
import type { ToolSpec } from "../../chapter1/files/agent.ts";
import { makeModel, modelKey } from "../../lib/model.ts";
import { newBudget } from "../../lib/budget.ts";
import { createStore, live, trusted } from "../memory.ts";
import { asDoc, rank } from "../retrieve.ts";
import { DISTRACTORS, OLD, TASKS } from "../tasks.ts";

import { RECORDED, RUNS } from "../runs.ts";
import type { Saved } from "../runs.ts";

const store = createStore([...OLD, ...DISTRACTORS]);

function recallTool(queries: string[]): ToolSpec {
  return {
    name: "recall",
    description: "Search the desk's memory for notes. Returns up to three notes with their ids.",
    params: { query: { type: "string", required: true } },
    run({ query }) {
      const text = String(query);
      queries.push(text);
      const hits = rank(text, live(store, 30).filter(trusted).map(asDoc), 3);
      const notes = hits.map((hit) => ({
        id: hit.id,
        text: store.records.find((m) => m.id === hit.id)?.text ?? "",
      }));
      return JSON.stringify({ query: text, notes });
    },
  };
}

const replaying = process.argv.includes("--replay") || process.env.AGENTLAB_REPLAY === "1";
const live_ = Boolean(modelKey()) && !replaying;

if (live_) {
  mkdirSync(RUNS, { recursive: true });
  for (const id of RECORDED) {
    const task = TASKS.find((t) => t.id === id);
    if (!task) throw new Error(`no ${id}`);
    const queries: string[] = [];
    const budget = newBudget(4);
    const model = makeModel(budget);
    const agent = new Agent(model, [recallTool(queries)], { maxSteps: 4 });
    const run = await agent.run(`${task.request} Use recall to look things up before you answer.`);
    const saved: Saved = {
      taskId: id,
      request: task.request,
      model: model.name,
      queries,
      answer: run.answer,
      usage: { calls: budget.calls, promptTokens: budget.promptTokens, outputTokens: budget.outputTokens },
      recordedAt: new Date().toISOString(),
    };
    writeFileSync(join(RUNS, `${id}.json`), JSON.stringify(saved, null, 2) + "\n");
    console.log(`  ${id.padEnd(4)} ${queries.length} quer${queries.length === 1 ? "y" : "ies"}  ${budget.calls} calls  ${JSON.stringify(queries)}`);
  }
} else {
  console.log("  replaying recorded queries (no key, or --replay)\n");
}

console.log("\n# the queries on disk");
for (const id of RECORDED) {
  const path = join(RUNS, `${id}.json`);
  if (!existsSync(path)) {
    console.log(`  ${id.padEnd(4)} missing`);
    continue;
  }
  const saved = JSON.parse(readFileSync(path, "utf8")) as Saved;
  console.log(`  ${saved.taskId.padEnd(4)} ${JSON.stringify(saved.queries)}`);
}

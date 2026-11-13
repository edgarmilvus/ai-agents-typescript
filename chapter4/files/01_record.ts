// 4.1 — record one run and look at what a fixture actually contains.
//
// The recording is the model's output plus the hash of every prompt it saw.
// Nothing else: no tool results (they are recomputed), no timings, no prose.

import { Agent } from "../../chapter1/files/agent.ts";
import { deskTools, makeDesk } from "../../chapter1/files/03_support_triage.ts";
import { Recorder, recordingPath } from "../recording.ts";
import { makeModel, modelKey } from "../../lib/model.ts";
import { newBudget } from "../../lib/budget.ts";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const TASK = "A customer says the headphones arrived damaged and wants a full refund. Order ORD-7712. Refund it if policy allows.";
const OUT = recordingPath("triage.json");

const exists = existsSync(OUT);
const replay = process.argv.includes("--replay") || process.env.AGENTLAB_REPLAY === "1";
if (exists && replay) {
  console.log("recording exists; replaying instead of spending calls (delete it to re-record)");
  process.exit(0);
}

const key = modelKey();
const desk = makeDesk();
const tools = deskTools(desk);

if (!key) {
  console.log("no key: set OPENAI_COMPATIBLE_API_KEY to record");
  process.exit(0);
}

const budget = newBudget(8);
const recorder = new Recorder(makeModel(budget), TASK);
const run = await new Agent(recorder, tools).run(TASK);

recorder.recording.usage = { calls: budget.calls, promptTokens: budget.promptTokens, outputTokens: budget.outputTokens };
mkdirSync("chapter4/recordings", { recursive: true });
writeFileSync(OUT, JSON.stringify(recorder.recording, null, 2) + "\n");

const bytes = readFileSync(OUT).length;
console.log("# recorded");
console.log("  turns     :", recorder.recording.turns.length);
console.log("  taskHash  :", recorder.recording.taskHash);
console.log("  model     :", recorder.recording.model);
console.log("  usage     :", recorder.recording.usage);
console.log("  fixture   :", OUT, bytes, "bytes");
console.log("  answer    :", run.answer.slice(0, 110));
console.log("\n# what one turn looks like");
console.log(JSON.stringify(recorder.recording.turns[0], null, 2).split("\n").slice(0, 12).join("\n"));

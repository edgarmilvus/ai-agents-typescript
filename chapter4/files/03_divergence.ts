// 4.3 — two runs of the same task, compared.
//
// A recording proves what happened once. A *diff* of two recordings is the
// only honest measure of how much of an agent's behaviour is the model and how
// much is the code around it.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { Agent } from "../../chapter1/files/agent.ts";
import { deskTools, makeDesk } from "../../chapter1/files/03_support_triage.ts";
import { Recorder, diff, recordingPath } from "../recording.ts";
import type { Recording } from "../recording.ts";
import { makeModel, modelKey } from "../../lib/model.ts";
import { newBudget } from "../../lib/budget.ts";

const TASK = "A customer says the headphones arrived damaged and wants a full refund. Order ORD-7712. Refund it if policy allows.";
const FIRST = recordingPath("triage.json");
const SECOND = recordingPath("triage-2.json");

const first = JSON.parse(readFileSync(FIRST, "utf8")) as Recording;

if (!existsSync(SECOND)) {
  const key = modelKey();
  if (!key) {
    console.log("no second recording and no key: skipping the diff (set OPENAI_COMPATIBLE_API_KEY to record)");
    process.exit(0);
  }
  const budget = newBudget(8);
  const recorder = new Recorder(makeModel(budget), TASK);
  await new Agent(recorder, deskTools(makeDesk())).run(TASK);
  writeFileSync(SECOND, JSON.stringify(recorder.recording, null, 2) + "\n");
  console.log("# recorded a second run:", recorder.recording.turns.length, "turns");
}

const second = JSON.parse(readFileSync(SECOND, "utf8")) as Recording;
const result = diff(first, second);

console.log("\n# first  :", first.turns.length, "turns,", first.model, first.recordedAt.slice(0, 19));
console.log("# second :", second.turns.length, "turns,", second.model, second.recordedAt.slice(0, 19));
console.log("# diff   :", JSON.stringify(result, null, 2));

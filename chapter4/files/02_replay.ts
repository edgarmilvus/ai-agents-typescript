// 4.2 — the same recording, two modes, and the failure that matters.
//
// Strict replay compares the prompt hash on every turn, so a changed tool
// description is caught at the turn where it matters. Tolerant replay only
// counts turns: useful for a loop, dangerous for a contract.

import { readFileSync } from "node:fs";
import { Agent } from "../../chapter1/files/agent.ts";
import { deskTools, makeDesk } from "../../chapter1/files/03_support_triage.ts";
import { TapeDeck, recordingPath } from "../recording.ts";
import type { Recording } from "../recording.ts";

const task = "A customer says the headphones arrived damaged and wants a full refund. Order ORD-7712. Refund it if policy allows.";
const recording = JSON.parse(readFileSync(recordingPath("triage.json"), "utf8")) as Recording;
const desk = makeDesk();
const tools = deskTools(desk);

console.log("# strict replay of the original prompt");
const strict = new TapeDeck(recording, "strict");
const run = await new Agent(strict, tools).run(task);
console.log("  answer  :", run.answer.slice(0, 96));
console.log("  refunds :", desk.refunds.length, "| turns left:", strict.remaining);

console.log("\n# the same recording, one tool description changed");
const edited = tools.map((t) => (t.name === "issue_refund" ? { ...t, description: t.description + " (v2)" } : t));
const strictEdited = new TapeDeck(recording, "strict");
try {
  await new Agent(strictEdited, edited).run(task);
  console.log("  strict  : accepted (that would be a bug)");
} catch (error) {
  console.log("  strict  :", (error as Error).message);
}

console.log("\n# tolerant replay of the same change");
const tolerant = new TapeDeck(recording, "tolerant");
const desk2 = makeDesk();
const run2 = await new Agent(tolerant, edited.map((t) => (t.name === "issue_refund" ? { ...t, run: deskTools(desk2)[2].run } : t))).run(task);
console.log("  answer  :", run2.answer.slice(0, 96));
console.log("  warning : the replies are yesterday's, the tools are today's");

// 1.1 — the smallest agent that is still an agent.
//
// A model turn, a tool call, a tool result, another model turn, an answer.
// Nothing here is specific to any provider: the loop only knows a Model
// interface and a list of tools.

import { Agent, ReplayModel, toolCall } from "./agent.ts";
import type { ToolSpec } from "./agent.ts";

const wordCount: ToolSpec = {
  name: "word_count",
  description: "Count the words in a piece of text.",
  params: {
    text: { type: "string", required: true },
  },
  run({ text }) {
    const n = String(text).trim().split(/\s+/).filter(Boolean).length;
    return JSON.stringify({ words: n });
  },
};

// Two turns, written down: ask for the tool, then answer with what came back.
const model = new ReplayModel([
  { toolCalls: [toolCall("word_count", { text: "an agent is a loop with a tool surface" })] },
  { text: "The sentence has 9 words." },
]);

const agent = new Agent(model, [wordCount]);
const run = await agent.run("How many words are in: an agent is a loop with a tool surface?");

console.log("# the transcript");
for (const m of run.transcript) {
  const tag = m.role.padEnd(9);
  const who = m.toolName ? ` (${m.toolName})` : "";
  console.log(`${tag}${who} ${m.content}`);
}

console.log("\n# the run");
console.log("stop reason:", run.stopReason);
console.log("tool steps :", run.steps.length);
console.log("answer     :", run.answer);

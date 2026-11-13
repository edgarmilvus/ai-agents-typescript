// 4.4 — recording across the boundary.
//
// Chapter 3's agent talks to a server it does not own. Recording that run is
// the same operation — wrap the model — and the fixture then proves our client
// without needing the server to behave the same way twice.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { SchemaAgent } from "../../chapter2/files/agent2.ts";
import type { SchemaTool } from "../../chapter2/files/agent2.ts";
import { validate } from "../../chapter2/files/schema.ts";
import { McpClient } from "../../chapter3/mcp/client.ts";
import { fromJsonSchema } from "../../chapter3/mcp/schema.ts";
import { Recorder, TapeDeck, ReplayError, recordingPath } from "../recording.ts";
import type { Recording } from "../recording.ts";
import { makeModel, modelKey } from "../../lib/model.ts";
import { newBudget } from "../../lib/budget.ts";

const TASK =
  "Open warehouse berlin-1, quote pickup pick_01 at 4 kg with dhl and with gls, and tell me which is cheaper. Do not book.";
const FILE = recordingPath("mcp-quote.json");

async function toolsFromServers(): Promise<{ tools: SchemaTool[]; close(): void }> {
  const warehouse = await McpClient.start("node", ["chapter3/mcp/server.ts"], { timeoutMs: 4000 });
  const offered = await warehouse.listTools();
  const tools: SchemaTool[] = offered.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input: fromJsonSchema(tool.inputSchema),
    run: (args) => warehouse.callTool(tool.name, args as Record<string, unknown>).then((v) => JSON.stringify(v)),
  }));
  return { tools, close: () => warehouse.close() };
}

if (!existsSync(FILE)) {
  const key = modelKey();
  if (!key) {
    console.log("no recording and no key: set OPENAI_COMPATIBLE_API_KEY to record");
    process.exit(0);
  }
  const { tools, close } = await toolsFromServers();
  const budget = newBudget(8);
  const recorder = new Recorder(makeModel(budget), TASK);
  const run = await new SchemaAgent(recorder, tools, { maxSteps: 6 }).run(TASK);
  recorder.recording.usage = { calls: budget.calls, promptTokens: budget.promptTokens, outputTokens: budget.outputTokens };
  writeFileSync(FILE, JSON.stringify(recorder.recording, null, 2) + "\n");
  close();
  console.log("# recorded", recorder.recording.turns.length, "turns");
  console.log("  answer:", run.answer.slice(0, 120));
}

// Replay it strictly against a fresh server: our client, the model's decisions.
const recording = JSON.parse(readFileSync(FILE, "utf8")) as Recording;
const { tools, close } = await toolsFromServers();
try {
  const run = await new SchemaAgent(new TapeDeck(recording, "strict"), tools, { maxSteps: 6 }).run(TASK);
  console.log("# strict replay ok");
  console.log("  answer:", run.answer.slice(0, 120));
  console.log("  calls :", run.attempts.map((a) => a.call.name).join(" → "));
} catch (error) {
  console.log("# replay failed:", (error as ReplayError).message);
}
close();

// 3.5 — the real model, over a surface it has never seen.
//
// The menu is not written in this file. It is read from the server at runtime,
// translated into the schema this book validates, and handed to the model. The
// agent then calls through the client, so every refusal crosses the wire.
//
//   node chapter3/files/05_live_mcp.ts            # live if a key exists
//   node chapter3/files/05_live_mcp.ts --replay   # from the recording

import { SchemaAgent } from "../../chapter2/files/agent2.ts";
import type { SchemaTool } from "../../chapter2/files/agent2.ts";
import { validate } from "../../chapter2/files/schema.ts";
import { McpClient } from "../mcp/client.ts";
import { fromJsonSchema, summarise } from "../mcp/schema.ts";
import { open } from "../../lib/scenario.ts";

const TASK =
  "You are the outbound coordinator. In warehouse berlin-1, pick the cheapest carrier for pickup pick_01 " +
  "and book it, but only if the quote is under 10 EUR. If it is not, say so and do nothing.";

const client = await McpClient.start("node", ["chapter3/mcp/server.ts"], { timeoutMs: 4000 });

// 1. discover, and see what the surface looks like before any model is involved
const offered = await client.listTools();
const { ok, refused } = summarise(offered);
console.log("# discovered", offered.length, "tools:", ok.join(", "));
if (refused.length) console.log("  unsupported:", refused.join(" | "));

// 2. translate, and wrap each tool so the agent speaks the same interface as chapter 2
const tools: SchemaTool[] = [];
for (const tool of offered) {
  let input;
  try {
    input = fromJsonSchema(tool.inputSchema);
  } catch {
    continue; // a tool whose schema we cannot prove is not offered to the model
  }
  tools.push({
    name: tool.name,
    description: tool.description,
    input,
    run(args) {
      return client.callTool(tool.name, args as Record<string, unknown>).then((v) => JSON.stringify(v));
    },
  });
}

// 3. ask the model to do the job over that surface
const session = open("ch3-mcp", 8);
const agent = new SchemaAgent(session.model, tools, { maxSteps: 6, maxRepairs: 2 });

const started = performance.now();
const run = await agent.run(TASK);
const wall = performance.now() - started;

console.log(`\n# the run (${session.live ? "live" : "recorded"})`);
for (const m of run.transcript) {
  if (m.role === "assistant" && m.toolCalls?.length) {
    for (const c of m.toolCalls) console.log(`  assistant  ${c.name}(${JSON.stringify(c.args).slice(0, 90)})`);
  } else if (m.role === "tool") {
    console.log(`  tool       ${m.content.slice(0, 110)}`);
  }
}
console.log("  answer    :", run.answer.slice(0, 180));
console.log("  attempts  :", run.attempts.length, "| refusals:", run.attempts.filter((a) => a.repaired).length);
if (session.live) {
  console.log(`  calls     : ${session.budget.calls} | ${session.budget.promptTokens} in / ${session.budget.outputTokens} out | ${(wall / 1000).toFixed(1)}s`);
}
session.close();
client.close();

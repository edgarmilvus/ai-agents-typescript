// 3.7 — one task, two servers, one model.
//
// The docs server holds the shipping policy; the warehouse server holds the
// pickups. Neither knows about the other. The agent reads a policy, then uses
// it to decide a booking — and every tool call crosses one of the two pipes.
//
//   node chapter3/files/07_live_two.ts            # live if a key exists
//   node chapter3/files/07_live_two.ts --replay   # from the recording

import { McpClient } from "../mcp/client.ts";
import { fromJsonSchema } from "../mcp/schema.ts";
import { SchemaAgent } from "../../chapter2/files/agent2.ts";
import type { SchemaTool } from "../../chapter2/files/agent2.ts";
import { open } from "../../lib/scenario.ts";

const TASK =
  "You coordinate outbound. Read the shipping policy: call docs.open_doc with id doc_style, then docs.open_doc with id doc_rates. " +
  "Then open warehouse berlin-1, quote pick_02 at 12 kg for dhl and for gls, and book it with the cheapest carrier the policy " +
  "allows for Germany, provided the quote is under the DE cap. If it is not under the cap, do not book and say why.";

const warehouse = await McpClient.start("node", ["chapter3/mcp/server.ts"], { timeoutMs: 4000 });
const docs = await McpClient.start("node", ["chapter3/mcp/docs-server.ts"], { timeoutMs: 4000 });

const servers = [
  { prefix: "warehouse", client: warehouse },
  { prefix: "docs", client: docs },
];

const tools: SchemaTool[] = [];
for (const server of servers) {
  for (const tool of await server.client.listTools()) {
    let input;
    try {
      input = fromJsonSchema(tool.inputSchema);
    } catch {
      continue;
    }
    tools.push({
      name: `${server.prefix}.${tool.name}`,
      description: tool.description,
      input,
      run: (args) => server.client.callTool(tool.name, args as Record<string, unknown>).then((v) => JSON.stringify(v)),
    });
  }
}

console.log("# the merged menu, prefixed");
console.log(" ", tools.map((t) => t.name).join(", "));

const session = open("ch3-two", 12);
const agent = new SchemaAgent(session.model, tools, { maxSteps: 11, maxRepairs: 2 });

const started = performance.now();
const run = await agent.run(TASK);
const wall = performance.now() - started;

console.log(`\n# the run (${session.live ? "live" : "recorded"})`);
for (const m of run.transcript) {
  if (m.role === "assistant" && m.toolCalls?.length) {
    for (const c of m.toolCalls) console.log(`  assistant  ${c.name}(${JSON.stringify(c.args).slice(0, 80)})`);
  } else if (m.role === "tool") {
    console.log(`  tool       ${m.content.slice(0, 100)}`);
  }
}
console.log("  answer    :", run.answer.slice(0, 220));
if (session.live) {
  console.log(`  calls     : ${session.budget.calls} | ${session.budget.promptTokens} in / ${session.budget.outputTokens} out | ${(wall / 1000).toFixed(1)}s`);
}
session.close();
warehouse.close();
docs.close();

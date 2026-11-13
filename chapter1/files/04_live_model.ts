// 1.4 — the same loop, with a real model.
//
// Every provider is reached through the same OpenAI-compatible protocol:
// DeepSeek directly, or DeepSeek Flash through OpenRouter. The loop, the
// tools and the assertions do not change.
//
//   node chapter1/files/04_live_model.ts            # one live run
//   node chapter1/files/04_live_model.ts --dry      # show the request, call nothing
//   node chapter1/files/04_live_model.ts --task "…" # your own ticket

import { Agent } from "./agent.ts";
import { deskTools, makeDesk } from "./03_support_triage.ts";
import { makeModel, modelName } from "../../lib/model.ts";
import { newBudget } from "../../lib/budget.ts";

const MODEL = modelName();
const MAX_MODEL_CALLS = 6;

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const dry = argv.includes("--dry");
  const taskIndex = argv.indexOf("--task");
  const task =
    taskIndex >= 0
      ? argv[taskIndex + 1]
      : "Customer says the headphones arrived damaged and wants a full refund. Order ORD-7712.";

  const desk = makeDesk();
  const tools = deskTools(desk);

  if (dry) {
    console.log("# request that would be sent");
    console.log(
      JSON.stringify(
        {
          model: MODEL,
          tools: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            params: tool.params,
          })),
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  const budget = newBudget(MAX_MODEL_CALLS);
  const agent = new Agent(makeModel(budget), tools, { maxSteps: MAX_MODEL_CALLS });
  const started = performance.now();
  const run = await agent.run(task);
  const wall = performance.now() - started;

  console.log("# transcript");
  for (const m of run.transcript) {
    if (m.role === "assistant" && m.toolCalls?.length) {
      console.log(`assistant  wants ${m.toolCalls.map((c) => `${c.name}(${JSON.stringify(c.args)})`).join(", ")}`);
    } else if (m.role === "tool") {
      console.log(`tool       ${m.content.slice(0, 120)}`);
    } else if (m.content) {
      console.log(`${m.role.padEnd(10)} ${m.content}`);
    }
  }

  console.log("\n# the run");
  console.log("stop reason :", run.stopReason);
  console.log("answer      :", run.answer || "(no text)");
  console.log("tool calls  :", run.steps.length);
  console.log("refunds     :", desk.refunds.length, "| escalations:", desk.escalations.length);
  console.log("model calls :", budget.calls, `of ${MAX_MODEL_CALLS} allowed`);
  console.log("tokens      :", budget.promptTokens, "in /", budget.outputTokens, "out");
  console.log("wall clock  :", (wall / 1000).toFixed(1), "s");
}

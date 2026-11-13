// The harness for chapter 1. Prints one line per assertion and a count.
//
//   node chapter1/files/run_ex1.ts
//
// Everything here runs offline, in milliseconds, with no API key: the model
// turns are recordings. That is what makes these assertions worth keeping.

import { Agent, ReplayModel, toolCall, validate } from "./agent.ts";
import type { ModelReply, ToolSpec } from "./agent.ts";
import { CASES, POLICIES, ORDERS, deskTools, makeDesk } from "./03_support_triage.ts";
import { recorded } from "../../lib/scenario.ts";

let checks = 0;
let failures = 0;

function check(name: string, ok: boolean, detail?: unknown): void {
  checks += 1;
  if (ok) {
    console.log(`PASS ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

function equal(name: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  check(name, ok, ok ? undefined : { actual, expected });
}

// ---------------------------------------------------------------- 1.1 the loop

{
  const wordCount: ToolSpec = {
    name: "word_count",
    description: "Count words.",
    params: { text: { type: "string", required: true } },
    run({ text }) {
      return JSON.stringify({ words: String(text).trim().split(/\s+/).length });
    },
  };
  const model = new ReplayModel([
    { toolCalls: [toolCall("word_count", { text: "one two three" })] },
    { text: "Three." },
  ]);
  const run = await new Agent(model, [wordCount]).run("count: one two three");

  equal("1.1 one tool call produced one step", run.steps.length, 1);
  equal("1.1 the loop stopped on an answer", run.stopReason, "answered");
  equal("1.1 the answer is the model's last text", run.answer, "Three.");
  equal("1.1 the tool result is in the transcript", run.transcript.at(-2)?.content, '{"words":3}');
  equal(
    "1.1 the transcript alternates user/assistant/tool/assistant",
    run.transcript.map((m) => m.role),
    ["user", "assistant", "tool", "assistant"],
  );
  check("1.1 the model saw the tool list", model.calls[0].toolNames.includes("word_count"));
}

// --------------------------------------------------------- 1.2 the tool surface

{
  let executed = 0;
  const openTicket: ToolSpec = {
    name: "open_ticket",
    description: "Open a ticket.",
    params: { subject: { type: "string", required: true }, priority: { type: "number", required: true } },
    run({ priority }) {
      executed += 1;
      const p = Number(priority);
      if (p < 1 || p > 3) throw new Error(`priority out of range: ${p}`);
      return JSON.stringify({ ticket: "T-1", priority: p });
    },
  };

  const model = new ReplayModel([
    { toolCalls: [toolCall("close_ticket", { id: "T-1" }, "c1")] },
    { toolCalls: [toolCall("open_ticket", { subject: "x", priority: "high" }, "c2")] },
    { toolCalls: [toolCall("open_ticket", { subject: "x", priority: 9 }, "c3")] },
    { toolCalls: [toolCall("open_ticket", { subject: "x", priority: 2 }, "c4")] },
    { text: "done" },
  ]);
  const run = await new Agent(model, [openTicket]).run("open a ticket");

  check("1.2 an unknown tool is answered, not thrown", run.steps[0].result.startsWith("Error: no tool named"));
  check(
    "1.2 a wrong type is rejected by the schema",
    run.steps[1].result.includes('"priority" must be number'),
    run.steps[1].result,
  );
  equal("1.2 the schema rejection never reached run()", executed, 2);
  check("1.2 a bad value is rejected by the tool", run.steps[2].result.includes("priority out of range"));
  equal("1.2 the good call ran exactly once", run.steps.filter((s) => s.result.includes('"T-1"')).length, 1);
  equal("1.2 four calls, four steps, one answer", run.steps.length, 4);
  equal("1.2 the loop still answers", run.stopReason, "answered");
}

// --------------------------------------------------------- 1.3 the refund desk
//
// Replayed from the recorded live runs: the model's turns are real, the
// assertions are about our tools and our policy.

{
  for (const testCase of CASES) {
    const desk = makeDesk();
    const run = await new Agent(recorded(testCase.fixture), deskTools(desk)).run(testCase.task);
    check(`1.3 ${testCase.label}: answered`, run.stopReason === "answered", run.stopReason);
    equal(`1.3 ${testCase.label}: refunds`, desk.refunds.length, testCase.expect.refunds);
    equal(`1.3 ${testCase.label}: escalations`, desk.escalations.length, testCase.expect.escalations);

    if (testCase.fixture === "ch1-inside") {
      equal("1.3 inside: refund is the order total", desk.refunds[0]?.amount, ORDERS[0].total);
      check("1.3 inside: the answer refers to the refund", /ORD-7712|rf_ord7712|84/.test(run.answer), run.answer.slice(0, 80));
    } else {
      check("1.3 outside: the escalation carries a reason", (desk.escalations[0]?.reason ?? "").length > 10);
    }
  }
  equal("1.3 the EU window is the one the desk enforces", POLICIES.EU.windowDays, 14);
}

// --------------------------------------------------------------- 1.4 the guard

{
  const tool: ToolSpec = {
    name: "tick",
    description: "Does nothing.",
    params: {},
    run: () => "tick",
  };
  const loop: ModelReply[] = Array.from({ length: 10 }, (_, i) => ({
    toolCalls: [toolCall("tick", {}, `t${i}`)],
  }));
  const run = await new Agent(new ReplayModel(loop), [tool], { maxSteps: 3 }).run("loop forever");

  equal("1.4 the loop stops at maxSteps", run.steps.length, 3);
  equal("1.4 and says so", run.stopReason, "step_limit");
  check("1.4 the answer explains the stop", run.answer.includes("3 steps"));
}

// ------------------------------------------------------------------ 1.5 policy

{
  const tools = deskTools(makeDesk());
  const refund = tools.find((t) => t.name === "issue_refund")!;
  const within = validate(refund, { orderId: "ORD-7712", amount: 84, reason: "damaged" });
  const extra = validate(refund, { orderId: "ORD-7712", amount: 84, reason: "damaged", note: "x" });
  const missing = validate(refund, { orderId: "ORD-7712" });

  check("1.5 a complete call validates", within.ok);
  check("1.5 an unknown argument is rejected", !extra.ok && extra.errors[0].includes("unknown argument"));
  check("1.5 a missing required argument is rejected", !missing.ok && missing.errors.length === 2);
  equal("1.5 the EU window is the one the tool enforces", POLICIES.EU.windowDays, 14);
}

// -------------------------------------------------------------------------- end

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);

// Chapter 20 exercise harness.
//
//   node chapter20/files/exercises/run_exercises.ts
//
// Offline: a normalizer, an error table, two adapters and a capability check.

import { normalize, RAW } from "./ex1_normalize.ts";
import { classify, CODES } from "./ex2_errors.ts";
import { alpha, beta } from "./ex3_adapter.ts";
import { demo as suiteRows, CHECKS, MODELS } from "./ex4_suite.ts";
import { CASES, check } from "./ex5_capability.ts";

let checks = 0;
let failures = 0;

function check_(name: string, ok: boolean, detail?: unknown): void {
  checks += 1;
  if (ok) console.log(`PASS ${name}`);
  else {
    failures += 1;
    console.log(`FAIL ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

function equal(name: string, actual: unknown, expected: unknown): void {
  check_(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });
}

// 1 — the normalizer
{
  equal("ex1 a delta becomes text", normalize({ type: "delta", delta: { text: "hi" } }), [{ type: "text", text: "hi" }]);
  equal("ex1 a text event is already text", normalize({ type: "text", delta: "hi" }), [{ type: "text", text: "hi" }]);
  const done = normalize({ type: "done", finish_reason: "end_turn", usage: { input: 12, output: 6 } });
  equal("ex1 done becomes two events", done.length, 2);
  equal("ex1 and normalizes the reason", done[1], { type: "finish", finish: "stop" });
  equal("ex1 the sample has three raw events", RAW.length, 3);
}

// 2 — the error table
{
  equal("ex2 the table has five codes", CODES.length, 5);
  equal("ex2 rate_limit is typed", classify("rate_limit", 2).kind, "rate_limit");
  equal("ex2 and keeps the delay", classify("rate_limit", 2).retryAfter, 2);
  equal("ex2 context is typed", classify("context_length_exceeded").kind, "context");
  equal("ex2 auth is typed", classify("invalid_api_key").kind, "auth");
  equal("ex2 an unknown code is wire", classify("server_error").kind, "wire");
  equal("ex2 a new code is still wire", classify("quota_exhausted").kind, "wire");
}

// 3 — the adapters
{
  equal("ex3 alpha streams three events", alpha.events().length, 3);
  const alphaText = alpha.events().filter((e) => e.type === "text").map((e) => (e.type === "text" ? e.text : "")).join("");
  const betaText = beta.events().filter((e) => e.type === "text").map((e) => (e.type === "text" ? e.text : "")).join("");
  equal("ex3 both adapters produce the same text", [alphaText, betaText], ["Hello world", "Hello world"]);
  const finish = beta.events().find((e) => e.type === "finish");
  equal("ex3 beta's end_turn becomes stop", finish, { type: "finish", reason: "stop" });
  equal("ex3 the capabilities differ", [alpha.capabilities.streaming, beta.capabilities.streaming], [true, false]);
  check_("ex3 both can call tools", alpha.capabilities.tools && beta.capabilities.tools);
}

// 4 — the suite
{
  const rows = suiteRows();
  equal("ex4 two models", MODELS.length, 2);
  equal("ex4 four checks", CHECKS.length, 4);
  equal("ex4 two rows", rows.length, 2);
  check_("ex4 both models pass every check", rows.every((row) => row.passed === CHECKS.length));
  equal("ex4 the answers differ", MODELS[0].answer === MODELS[1].answer, false);
}

// 5 — the capability check
{
  equal("ex5 four cases", CASES.length, 4);
  equal("ex5 a full model passes", check({ tools: true, streaming: true }, { tools: true, streaming: false }), { ok: true, missing: [] });
  equal("ex5 a model without tools fails", check({ tools: false, streaming: true }, { tools: true, streaming: false }), {
    ok: false,
    missing: ["tools"],
  });
  equal("ex5 a model without streaming fails only when needed", check({ tools: true, streaming: false }, { tools: true, streaming: true }), {
    ok: false,
    missing: ["streaming"],
  });
  equal("ex5 and passes when it is not", check({ tools: true, streaming: false }, { tools: true, streaming: false }).ok, true);
  equal("ex5 two capabilities can be missing", check({ tools: false, streaming: false }, { tools: true, streaming: true }).missing, [
    "tools",
    "streaming",
  ]);
}

console.log(`\n${checks - failures}/${checks} exercise checks passed`);
if (failures) process.exit(1);

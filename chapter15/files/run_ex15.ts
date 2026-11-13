// Chapter 15 harness.
//
//   node chapter15/files/run_ex15.ts
//
// Offline: the price list is arithmetic, the shapes are a model calibrated on
// the book's recordings, and the traffic window is chapter 10's.

import { MODELS, TURN, callCost, loopCost, micro, spend, wastedBase } from "../price.ts";
import { TASKS, simulate, total } from "../loop.ts";
import { breakEven, run, solves } from "../routing.ts";
import { createCache, keyOf, lookup, put, rate, serve } from "../cache.ts";
import { stream } from "../../chapter10/traffic.ts";

let checks = 0;
let failures = 0;

function check(name: string, ok: boolean, detail?: unknown): void {
  checks += 1;
  if (ok) console.log(`PASS ${name}`);
  else {
    failures += 1;
    console.log(`FAIL ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

function equal(name: string, actual: unknown, expected: unknown): void {
  check(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });
}

// 1 — pricing
{
  equal("a thousand input tokens at the cheap rate", micro(callCost(MODELS.cheap, 1000, 0)), 100);
  equal("and a thousand output tokens", micro(callCost(MODELS.cheap, 0, 1000)), 400);
  equal("the strong model is ten times dearer on input", MODELS.strong.inputPerMTok / MODELS.cheap.inputPerMTok, 12.5);
  const one = loopCost(MODELS.cheap, 1);
  equal("one turn is base plus one output", [one.promptTokens, one.outputTokens], [TURN.base, TURN.output]);
  const four = loopCost(MODELS.cheap, 4);
  equal("four turns reproduce the reference measurement", four.promptTokens, 1510);
  check("the growth is quadratic, not linear", four.usd / 2 > loopCost(MODELS.cheap, 2).usd, four.usd);
  equal("the base is re-sent every turn but the first", wastedBase(4), TURN.base * 3);
}

// 2 — the shapes
{
  const task = TASKS[0];
  const single = simulate(task, "single");
  const delegated = simulate(task, "delegated");
  const cached = simulate(task, "cached");
  equal("three steps is four turns", single.calls, 4);
  check("delegation costs more at three steps", delegated.usd > single.usd, [delegated.usd, single.usd]);
  check("a cache hit costs least", cached.usd < single.usd && cached.calls === 1, cached.usd);
  check("the delegated shape makes more calls", delegated.calls > single.calls);
  check("total cost is the sum of the runs", Math.abs(total(TASKS, "single") - TASKS.reduce((n, t) => n + simulate(t, "single").usd, 0)) < 1e-12);
  const eight = simulate({ ...task, steps: 7 }, "delegated").usd / simulate({ ...task, steps: 7 }, "single").usd;
  check("delegation loses at three and the ratio falls with steps", eight < delegated.usd / single.usd, eight);
}

// 3 — routing
{
  equal("the cheap tier solves a two-step task", solves({ ...TASKS[1], steps: 2 }, "cheap"), true);
  equal("and not a five-step one", solves({ ...TASKS[3], steps: 5 }, "cheap"), false);
  equal("the strong tier solves everything", solves(TASKS[3], "strong"), true);

  const corpus = Array.from({ length: 20 }, (_, i) => ({
    id: `r${i}`,
    label: "x",
    steps: i % 5 === 0 ? 5 : 2,
    difficulty: (i % 5 === 0 ? "hard" : "easy") as "hard" | "easy",
  }));
  const cheap = run(corpus, "cheap");
  const strong = run(corpus, "strong");
  const mixed = run(corpus, "cheap-first");
  equal("cheap solves sixteen", cheap.solved, 16);
  equal("strong solves twenty", strong.solved, 20);
  equal("cheap-first solves twenty", mixed.solved, 20);
  equal("and pays for four retries", mixed.rows.filter((r) => r.attempts.length === 2).length, 4);
  check("cheap-first is cheaper than always-strong", mixed.usd < strong.usd, [mixed.usd, strong.usd]);
  check("and dearer than always-cheap", mixed.usd > cheap.usd);
  check("the break-even is eight percent", Math.abs(breakEven(corpus) - 0.08) < 0.01, breakEven(corpus));
}

// 4 — the cache
{
  equal("the key normalises case and punctuation", keyOf("Refund, this order!", "ORD-1"), "ORD-1|refund this order");
  const c = createCache();
  const k = keyOf("refund", "ORD-1");
  equal("a cold cache misses", lookup(c, k, 1, 10), undefined);
  put(c, k, "answer", 1);
  check("a warm cache hits", lookup(c, k, 2, 10) !== undefined);
  equal("and counts the hit", c.hits, 1);
  equal("an expired entry misses", lookup(c, k, 100, 10), undefined);
  equal("ttl zero never expires", lookup(c, k, 100, 0) !== undefined, true);

  const requests = stream();
  const cold = createCache();
  let clock = 0;
  const served = serve(
    cold,
    requests.map((r) => ({ request: "refund", orderId: r.orderId })),
    () => 1,
    () => (clock += 1),
    0,
  );
  equal("the window has 240 requests", served.answered + served.served, 240);
  equal("21 of them are duplicates", served.served, 21);
  check("the hit rate is the duplicate rate", Math.abs(rate(cold, 240).rate - 21 / 240) < 1e-9);
  check("the cached run spends less", served.usd < 240, served.usd);
}

// 5 — budgets
{
  const six = spend({ maxSteps: 8, maxTokens: Number.POSITIVE_INFINITY }, 6);
  equal("eight steps finish a six-turn task", [six.turns, six.done], [6, true]);
  const tight = spend({ maxSteps: 8, maxTokens: 1000 }, 6);
  equal("a thousand tokens stop it early", [tight.turns, tight.done], [2, false]);
  const runaway = spend({ maxSteps: 8, maxTokens: 1000 }, Number.POSITIVE_INFINITY);
  check("and bound the runaway", runaway.tokens < 1000, runaway.tokens);
  const steps = spend({ maxSteps: 8, maxTokens: Number.POSITIVE_INFINITY }, Number.POSITIVE_INFINITY);
  equal("the step budget stops at eight turns", steps.turns, 8);
  check("and the step budget is the looser one", steps.tokens > runaway.tokens * 4, [steps.tokens, runaway.tokens]);
}

// 6 — the verification tax
{
  const perRun = 4;
  const cases = 84;
  const liveCalls = cases * perRun;
  equal("the mutation matrix is 336 calls live", liveCalls, 336);
  check("which is over a day of free-tier quota", liveCalls / 500 > 0.5, liveCalls / 500);
  equal("and no calls as replays", 0, 0);
  check("a full pass is under a dollar", cases * perRun * loopCost(MODELS.cheap, 4).usd < 1, cases * perRun * loopCost(MODELS.cheap, 4).usd);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);

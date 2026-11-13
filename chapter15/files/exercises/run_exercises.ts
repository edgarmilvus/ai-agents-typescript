// Chapter 15 exercise harness.
//
//   node chapter15/files/exercises/run_exercises.ts
//
// Offline: price lists, shapes and policies, all arithmetic.

process.env.AGENTLAB_REPLAY = "1";

import { MODELS, SHAPE, demo as priceRows, loop } from "./ex1_price.ts";
import { basePaid, crosses, demo as growthRows, marginal, prompt, work } from "./ex2_growth.ts";
import { demo as routerRows, TASKS } from "./ex3_run.ts";
import { route, threshold } from "./ex3_router.ts";
import { demo as cacheRows, key, run as serve, TRAFFIC } from "./ex4_cache.ts";
import { demo as budgetRows, needed, run as spend, smallestBudget } from "./ex5_budgets.ts";

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
  const rows = priceRows();
  equal("ex1 nine rows", rows.length, 9);
  equal("ex1 the small model at two turns", Math.round(rows[0].usd * 1e6), 94);
  equal("ex1 the large model at eight", Math.round(rows[8].usd * 1e6), 7235);
  equal("ex1 the prompt does not depend on the model", rows[0].prompt, rows[6].prompt);
  equal("ex1 but the output does not either", rows[0].output, rows[6].output);
  check("ex1 cost rises with turns for every model", [0, 1, 2].every((i) => rows[i].usd < rows[i + 3].usd));
  check("ex1 a bigger model costs more at the same shape", rows[0].usd < rows[3].usd && rows[3].usd < rows[6].usd);
  equal("ex1 one call is two multiplications", Math.round((1000 * MODELS.small.inputPerMTok + 100 * MODELS.small.outputPerMTok) / 1e6 * 1e6), 140);
  equal("ex1 the shape is the measured one", [SHAPE.base, SHAPE.perTurn], [250, 85]);
}

// 2 — the growth
{
  equal("ex2 four turns is the chapter's measurement", prompt(4), 1510);
  equal("ex2 the base paid at twelve", basePaid(12), 3000);
  equal("ex2 the work at twelve", work(12), 5610);
  equal("ex2 and they add up", basePaid(12) + work(12), prompt(12));
  equal("ex2 the marginal turn rises", [marginal(1), marginal(2), marginal(3)], [250, 335, 420]);
  equal("ex2 the first turn above twice the base", crosses(2), 4);
  equal("ex2 and above three times", crosses(3), 7);
  const rows = growthRows();
  equal("ex2 six rows", rows.length, 6);
  check("ex2 the total always exceeds the base", rows.every((r) => r.prompt > r.base));
}

// 3 — the router
{
  const d = routerRows();
  equal("ex3 three policies", d.rows.map((r) => r.policy), ["cheap", "strong", "cheap-first"]);
  equal("ex3 cheap solves five", d.rows[0].solved, 5);
  equal("ex3 strong solves eight", d.rows[1].solved, 8);
  equal("ex3 cheap-first solves eight", d.rows[2].solved, 8);
  check("ex3 cheap-first is cheaper than strong", d.rows[2].usd < d.rows[1].usd, [d.rows[2].usd, d.rows[1].usd]);
  check("ex3 and dearer than cheap", d.rows[2].usd > d.rows[0].usd);
  equal("ex3 the escalation count", route(TASKS, "cheap-first").rows.filter((r) => r.attempts.length === 2).length, 3);
  check("ex3 the threshold is under ten percent", Math.abs(threshold(TASKS) - 0.08) < 0.01, threshold(TASKS));
  check("ex3 per-solved is finite for every policy", d.rows.every((r) => Number.isFinite(r.perSolved)));
}

// 4 — the cache
{
  equal("ex4 the key normalises", key("Refund, NOW!", "ORD-9"), "ORD-9|refund now");
  const rows = cacheRows();
  equal("ex4 two clocks", rows.length, 2);
  equal("ex4 without expiry three hits", rows[0].hits, 3);
  equal("ex4 with a short ttl two", rows[1].hits, 2);
  equal("ex4 the unanswered count follows", [rows[0].answered, rows[1].answered], [3, 4]);
  check("ex4 six requests in total", rows.every((r) => r.hits + r.answered === TRAFFIC.length));
  equal("ex4 a hit saves the cost of an answer", rows[0].saved, 3);
  const tight = serve(TRAFFIC, 0);
  check("ex4 a ttl of zero never expires", tight.hits === 3, tight.hits);
}

// 5 — the budgets
{
  const rows = budgetRows();
  equal("ex5 three policies", rows.length, 3);
  equal("ex5 steps finish the task", [rows[0].turns, rows[0].done], [6, true]);
  equal("ex5 a thousand tokens do not", [rows[1].turns, rows[1].done], [2, false]);
  equal("ex5 both is enough", [rows[2].turns, rows[2].done], [6, true]);
  equal("ex5 six turns spend 2,775 tokens", needed(6), 2775);
  equal("ex5 and that is the smallest budget", smallestBudget(6), 2775);
  check("ex5 a smaller budget stops short", spend({ name: "x", maxSteps: 99, maxTokens: 2774 }, 6).done === false);
  check("ex5 a bigger one finishes", spend({ name: "y", maxSteps: 99, maxTokens: 2775 }, 6).done === true);
}

console.log(`\n${checks - failures}/${checks} exercise checks passed`);
if (failures) process.exit(1);

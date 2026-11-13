// Chapter 19 exercise harness.
//
//   node chapter19/files/exercises/run_exercises.ts
//
// Offline: five streams, a price list and a status function.

import { collect, SCRIPT } from "./ex1_stream.ts";
import { bill, CASES as BILL_CASES, PRICE_PER_TOKEN } from "./ex2_billing.ts";
import { go } from "./ex3_runner.ts";
import { demo as probeRows } from "./ex4_probes.ts";
import { CASES as LEDGER_CASES, statusOf } from "./ex5_ledger.ts";

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

// 1 — the stream
{
  equal("ex1 aborting before the first chunk produces nothing", (await collect(0)).chunks, 0);
  equal("ex1 aborting after two produces two", (await collect(2)).chunks, 2);
  equal("ex1 the text is what was delivered", (await collect(3)).text, "one two three ");
  equal("ex1 the last abort produces every chunk", (await collect(SCRIPT.length)).chunks, SCRIPT.length);
  equal("ex1 and is not a cancellation", (await collect(SCRIPT.length)).cancelled, false);
  equal("ex1 a short run is a cancellation", (await collect(2)).cancelled, true);
}

// 2 — the bill
{
  equal("ex2 three chunks are nine tokens", bill(3).tokens, 9);
  equal("ex2 the price is per token", bill(3).billed, 9 * PRICE_PER_TOKEN);
  equal("ex2 the full run saves nothing", bill(8).saved, 0);
  equal("ex2 the zero run saves everything", bill(0).saved, bill(8).ifComplete);
  equal("ex2 a chunk count above the script is clamped", bill(99).chunks, 8);
  equal("ex2 a negative count is clamped", bill(-3).chunks, 0);
  equal("ex2 the cases are four", BILL_CASES.length, 4);
  check_("ex2 every bill is non-negative", BILL_CASES.every((n) => bill(n).billed >= 0));
}

// 3 — three files
{
  const two = await go(2);
  equal("ex3 stopping at two reads two pieces", two.chunks, 2);
  equal("ex3 and bills six tokens", two.tokens, 6);
  equal("ex3 and writes no side effect", two.tool, false);
  equal("ex3 and records cancellation", two.ledger, "cancelled");

  const five = await go(5);
  equal("ex3 stopping at five reads five", five.chunks, 5);
  equal("ex3 and is still cancelled", five.ledger, "cancelled");

  const full = await go();
  equal("ex3 the full run reads every piece", full.chunks, 6);
  equal("ex3 and bills eighteen tokens", full.tokens, 18);
  equal("ex3 and commits the tool", full.tool, true);
  equal("ex3 and records completion", full.ledger, "complete");
}

// 4 — the probes
{
  const rows = await probeRows();
  equal("ex4 two probes", rows.length, 2);
  check_("ex4 both leak in the leak build", rows.every((row) => row.leak));
  check_("ex4 neither leaks in the chain build", rows.every((row) => !row.chain));
  equal("ex4 the probes name different links", rows.map((row) => row.link), ["stream", "ledger"]);
}

// 5 — the ledger
{
  const states = LEDGER_CASES.map((c) => statusOf(c.evidence));
  equal("ex5 five cases", states.length, 5);
  equal("ex5 three states", [...new Set(states)].sort(), ["cancelled", "complete", "incomplete"]);
  equal("ex5 finished is complete", statusOf(LEDGER_CASES[0].evidence), "complete");
  equal("ex5 cancelled is cancelled", statusOf(LEDGER_CASES[1].evidence), "cancelled");
  equal("ex5 cancelled before the start is still cancelled", statusOf(LEDGER_CASES[2].evidence), "cancelled");
  equal("ex5 finished without the tool is incomplete", statusOf(LEDGER_CASES[3].evidence), "incomplete");
  equal("ex5 stopped short without a flag is incomplete", statusOf(LEDGER_CASES[4].evidence), "incomplete");
}

console.log(`\n${checks - failures}/${checks} exercise checks passed`);
if (failures) process.exit(1);

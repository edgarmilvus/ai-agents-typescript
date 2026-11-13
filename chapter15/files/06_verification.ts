// 15.6 — what the book's own suite would cost as live runs.
//
// Every chapter after the fourth verifies itself on replays. That is a cost
// decision as much as a determinism one, and this demo prices it two ways: the
// money, which is smaller than people expect, and the requests, which are the
// constraint that actually binds.
//
// The numbers are the book's own: the case counts from the harnesses, and the
// measured rate from chapter 7 — fifteen requests a minute and five hundred a
// day on the free tier.

import { MODELS, micro } from "../price.ts";
import { loopCost } from "../price.ts";

const RUN = loopCost(MODELS.cheap, 4).usd;
const PER_MINUTE = 15;
const PER_DAY = 500;

interface Suite {
  name: string;
  cases: number;
}

const suites: Suite[] = [
  { name: "chapter 8 — attribution corpus", cases: 9 },
  { name: "chapter 9 — mutation matrix", cases: 84 },
  { name: "chapter 10 — shadow window", cases: 240 },
  { name: "chapter 12 — attack corpus", cases: 20 },
  { name: "chapter 14 — memory corpus", cases: 60 },
];

console.log("# the same coverage, priced three ways\n");
console.log("  suite                            cases   calls     money   minutes  quota-days");
let calls = 0;
let money = 0;
for (const suite of suites) {
  const suiteCalls = suite.cases * 4;
  const cost = suite.cases * 4 * RUN;
  calls += suiteCalls;
  money += cost;
  console.log(
    `  ${suite.name.padEnd(32)} ${String(suite.cases).padStart(6)} ${String(suiteCalls).padStart(7)} ${String(micro(cost)).padStart(9)} µ$ ${(suiteCalls / PER_MINUTE).toFixed(0).padStart(8)} ${(suiteCalls / PER_DAY).toFixed(1).padStart(11)}`,
  );
}

console.log(`\n  one pass is ${micro(money)} µ$ — $${money.toFixed(2)} — and that is the least interesting`);
console.log(`  number in the table. The one that binds is ${calls} requests: ${(calls / PER_MINUTE).toFixed(0)} minutes`);
console.log(`  of wall clock and ${(calls / PER_DAY).toFixed(1)} days of a free-tier quota, for one pass.`);
console.log("");
console.log("  a suite that takes an hour and a half is a suite that runs on a schedule.");
console.log("  a suite that runs in a second is a suite that runs on every save, and the");
console.log("  gate in chapter 9 is only possible because of that difference. The");
console.log("  recordings paid for it once: eleven live runs, 9,742 µ$, for the book.");

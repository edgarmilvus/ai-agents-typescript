// 15.5 — steps are not tokens.
//
// Every loop in this book has a step budget, because chapter 1 needed a way to
// stop. A step budget answers "how many turns", and the bill answers "how many
// tokens", and the two are not the same question: a turn's cost grows with the
// history, so eight turns is not eight times one.
//
// The demo runs a task that needs six turns under both budgets, then a task
// that never finishes, because the second is the one the budget exists for.

import { MODELS, TURN, loopCost, micro, spend } from "../price.ts";

interface Policy {
  name: string;
  /** The most turns the loop may take. */
  maxSteps: number;
  /** The most prompt tokens the loop may spend, or Infinity. */
  maxTokens: number;
}

const policies: Policy[] = [
  { name: "steps only (8)", maxSteps: 8, maxTokens: Number.POSITIVE_INFINITY },
  { name: "tokens only (1000)", maxSteps: Number.POSITIVE_INFINITY, maxTokens: 1000 },
  { name: "both (8, 1500)", maxSteps: 8, maxTokens: 1500 },
];

console.log("# a task that needs six turns\n");
console.log("  policy                 turns  tokens    cost   outcome");
for (const policy of policies) {
  const result = spend(policy, 6);
  const cost = micro(loopCost(MODELS.cheap, Math.max(result.turns, 1)).usd);
  console.log(
    `  ${policy.name.padEnd(22)} ${String(result.turns).padStart(5)} ${String(result.tokens).padStart(7)} ${String(cost).padStart(7)} µ$   ${result.done ? "finished" : "cut off"}`,
  );
}

console.log("\n# a task that never finishes\n");
console.log("  policy                 turns  tokens    cost   outcome");
for (const policy of policies) {
  const result = spend(policy, Number.POSITIVE_INFINITY);
  const cost = micro(loopCost(MODELS.cheap, Math.max(result.turns, 1)).usd);
  console.log(
    `  ${policy.name.padEnd(22)} ${String(result.turns).padStart(5)} ${String(result.tokens).padStart(7)} ${String(cost).padStart(7)} µ$   ${result.done ? "finished" : "cut off"}`,
  );
}

console.log("\n  the steps-only policy allows 4,380 prompt tokens on the runaway task, and a");
console.log("  1,000-token budget stops it after two turns and 585 tokens. On the");
console.log("  six-turn task the same budget also stops at two turns — which is the");
console.log("  other half of the problem: a budget that is too tight fails a task that");
console.log("  would have finished. The combined policy stops both at three turns.");
console.log("");
console.log("  the pair is the design. Steps bound the latency and the number of");
console.log("  chances; tokens bound the bill. A loop needs both, and the interesting");
console.log("  number is not either limit but the ratio between them.");

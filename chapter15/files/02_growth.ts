// 15.2 — the history you re-send every turn.
//
// A loop is not `turns × price`. Every turn sends the conversation so far, so
// the prompt grows and the total is the sum of an arithmetic series. This demo
// prints that series for two to ten turns and separates the part of it that is
// the system prompt from the part that is the work.

import { MODELS, TURN, loopCost, micro, wastedBase } from "../price.ts";

console.log("# what a loop of n turns sends\n");
console.log("  turns  prompt  output    cost   base re-sent   cost per turn");
for (let turns = 2; turns <= 10; turns += 1) {
  const loop = loopCost(MODELS.cheap, turns);
  const waste = micro(loopCost(MODELS.cheap, 1, { ...TURN, perTurn: 0, output: 0 }).usd) * (turns - 1);
  console.log(
    `  ${String(turns).padStart(5)} ${String(loop.promptTokens).padStart(7)} ${String(loop.outputTokens).padStart(7)} ${String(micro(loop.usd)).padStart(7)} µ$ ${String(waste).padStart(19)} µ$ ${String(micro(loop.usd / turns)).padStart(13)} µ$`,
  );
}

const two = loopCost(MODELS.cheap, 2);
const ten = loopCost(MODELS.cheap, 10);
console.log(`\n  ten turns cost ${(ten.usd / two.usd).toFixed(1)}× two turns, not 5×: the prompt grows`);
console.log(`  by ${TURN.perTurn} tokens per turn and the sum is quadratic while the number of`);
console.log("  turns is linear.");

console.log(`\n  ${wastedBase(10)} of the ${ten.promptTokens} prompt tokens at ten turns are the system`);
console.log("  prompt and the tool list, sent again on every call. A shorter system");
console.log("  prompt is not a saving at one turn; it is a saving at every turn.");

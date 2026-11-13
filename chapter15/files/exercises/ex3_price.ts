// Exercise 3, file 1 of 3 — the price list, with no tasks.
//
// Two multiplications and a sum, and nothing else. This file can be tested with
// a single call, which is the point: the arithmetic of what a call costs should
// not need a corpus to be checked.

export interface Model {
  name: string;
  inputPerMTok: number;
  outputPerMTok: number;
}

export const CHEAP: Model = { name: "cheap", inputPerMTok: 0.1, outputPerMTok: 0.4 };
export const STRONG: Model = { name: "strong", inputPerMTok: 1.25, outputPerMTok: 5 };

export function call(model: Model, promptTokens: number, outputTokens: number): number {
  return (promptTokens * model.inputPerMTok + outputTokens * model.outputPerMTok) / 1_000_000;
}

export const SHAPE = { base: 250, perTurn: 85, output: 44 };

/** The prompt tokens a loop of `turns` sends, each turn re-sending history. */
export function promptTokens(turns: number): number {
  let total = 0;
  for (let i = 0; i < turns; i += 1) total += SHAPE.base + SHAPE.perTurn * i;
  return total;
}

export function loopCost(model: Model, turns: number): { tokens: number; output: number; usd: number } {
  const tokens = promptTokens(turns);
  const output = turns * SHAPE.output;
  return { tokens, output, usd: call(model, tokens, output) };
}

export const micro = (usd: number): number => Math.round(usd * 1_000_000);

// Chapter 15 — what a call costs, and what a loop costs.
//
// A price list is two numbers per model: dollars per million input tokens and
// per million output tokens. Everything else in the chapter is that
// multiplication applied to a shape.
//
// The loop is where the shape lives. A turn sends the whole conversation again,
// so the cost of a task is not the number of turns times the cost of a call —
// it is the sum of a growing prompt, which is quadratic in the turn count when
// each turn adds the same amount.

export interface Model {
  id: string;
  /** Dollars per million input tokens. */
  inputPerMTok: number;
  /** Dollars per million output tokens. */
  outputPerMTok: number;
  note: string;
}

export const MODELS: Record<string, Model> = {
  cheap: {
    id: "a cheap model",
    inputPerMTok: 0.1,
    outputPerMTok: 0.4,
    note: "the cheap tier used for this arithmetic",
  },
  strong: {
    id: "a frontier model",
    inputPerMTok: 1.25,
    outputPerMTok: 5,
    note: "ten times the input price, twelve times the output",
  },
};

/** The cost of one call, in dollars. */
export function callCost(model: Model, promptTokens: number, outputTokens: number): number {
  return (promptTokens * model.inputPerMTok + outputTokens * model.outputPerMTok) / 1_000_000;
}

/**
 * The measured shape of a turn.
 *
 * Calibrated on a four-call refund run: 1,510 prompt tokens and 176 output
 * tokens. A base of 250 and 85 per turn reproduces that sum almost exactly,
 * and the point is the growth, not the absolute numbers.
 */
export const TURN = { base: 250, perTurn: 85, output: 44 };

export interface Loop {
  turns: number;
  promptTokens: number;
  outputTokens: number;
  usd: number;
}

/** A loop that re-sends its history: the prompt grows by `perTurn` every turn. */
export function loopCost(model: Model, turns: number, shape = TURN): Loop {
  let promptTokens = 0;
  for (let i = 0; i < turns; i += 1) promptTokens += shape.base + shape.perTurn * i;
  const outputTokens = turns * shape.output;
  return { turns, promptTokens, outputTokens, usd: callCost(model, promptTokens, outputTokens) };
}

/** Every turn resends the system prompt and the tools, which is the base term. */
export function wastedBase(turns: number, shape = TURN): number {
  return shape.base * (turns - 1);
}

export interface BudgetPolicy {
  maxSteps: number;
  maxTokens: number;
}

/**
 * Run a loop under a budget and report where it stopped.
 *
 * A step budget and a token budget stop the same loop for different reasons,
 * and the difference is the point: eight turns is a latency bound, a thousand
 * tokens is a bill.
 */
export function spend(policy: BudgetPolicy, needs: number, shape = TURN): { turns: number; tokens: number; done: boolean } {
  let tokens = 0;
  let turns = 0;
  while (turns < policy.maxSteps && tokens < policy.maxTokens) {
    const next = shape.base + shape.perTurn * turns;
    if (tokens + next > policy.maxTokens) break;
    tokens += next;
    turns += 1;
    if (turns >= needs) return { turns, tokens, done: true };
  }
  return { turns, tokens, done: false };
}

/** A millionth of a dollar: the unit a single call is measured in. */
export function micro(usd: number): number {
  return Math.round(usd * 1_000_000);
}

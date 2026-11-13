// The model budget shared by every adapter and demo.

export interface Budget {
  calls: number;
  promptTokens: number;
  outputTokens: number;
  maxCalls: number;
}

export function newBudget(maxCalls = 12): Budget {
  return { calls: 0, promptTokens: 0, outputTokens: 0, maxCalls };
}

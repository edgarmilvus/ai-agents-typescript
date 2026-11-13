// Exercise 5 — steps are not tokens.
//
// A loop budget is two numbers: the turns it may take and the tokens it may
// spend. This exercise runs the same task under three policies and finds the
// smallest token budget that still finishes, which is the number a team should
// write down instead of a step count.

export const SHAPE = { base: 250, perTurn: 85, output: 44 };

export interface Policy {
  name: string;
  maxSteps: number;
  maxTokens: number;
}

export interface Stop {
  turns: number;
  tokens: number;
  done: boolean;
}

/** Run a loop that needs `needs` turns and returns where it stopped. */
export function run(policy: Policy, needs: number): Stop {
  let turns = 0;
  let tokens = 0;
  while (turns < policy.maxSteps && tokens < policy.maxTokens) {
    const next = SHAPE.base + SHAPE.perTurn * turns;
    if (tokens + next > policy.maxTokens) break;
    tokens += next;
    turns += 1;
    if (turns >= needs) return { turns, tokens, done: true };
  }
  return { turns, tokens, done: false };
}

/** The tokens a task that needs `needs` turns actually spends. */
export function needed(needs: number): number {
  let total = 0;
  for (let i = 0; i < needs; i += 1) total += SHAPE.base + SHAPE.perTurn * i;
  return total;
}

/** The smallest token budget that finishes a task needing `needs` turns. */
export function smallestBudget(needs: number): number {
  return needed(needs);
}

export const POLICIES: Policy[] = [
  { name: "steps only (8)", maxSteps: 8, maxTokens: Number.POSITIVE_INFINITY },
  { name: "tokens only (1000)", maxSteps: Number.POSITIVE_INFINITY, maxTokens: 1000 },
  { name: "both (8, 3000)", maxSteps: 8, maxTokens: 3000 },
];

export function demo() {
  return POLICIES.map((policy) => ({ policy: policy.name, ...run(policy, 6) }));
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# a task that needs six turns\n");
  console.log("  policy                 turns  tokens  outcome");
  for (const row of rows) {
    console.log(`  ${row.policy.padEnd(22)} ${String(row.turns).padStart(5)} ${String(row.tokens).padStart(7)}  ${row.done ? "finished" : "cut off"}`);
  }
  console.log(`\n  the task spends ${needed(6)} tokens, so ${smallestBudget(6)} is the smallest`);
  console.log("  budget that finishes it — and a 1,000-token budget is not that number.");
  console.log("");
  console.log("  the point of computing it is that the budget becomes a fact about the");
  console.log("  task rather than a number somebody guessed. A step limit answers a");
  console.log("  different question: how many chances, not how much money.");
}

if (import.meta.main) report(demo());

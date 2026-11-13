// Exercise 2 — the history you re-send.
//
// A loop's prompt is an arithmetic series, and the two numbers that matter are
// the share of it that is the system prompt and the marginal cost of one more
// turn. Both grow, and neither is visible in a per-call price.

export const BASE = 250;
export const PER_TURN = 85;
export const OUTPUT = 44;

/** Prompt tokens for a loop of `turns`, each turn re-sending what came before. */
export function prompt(turns: number, base = BASE, perTurn = PER_TURN): number {
  let total = 0;
  for (let i = 0; i < turns; i += 1) total += base + perTurn * i;
  return total;
}

/** The prompt tokens that are the base, paid again on every turn. */
export function basePaid(turns: number, base = BASE): number {
  return base * turns;
}

/** The prompt tokens that are the conversation itself, at n turns. */
export function work(turns: number, perTurn = PER_TURN): number {
  return (perTurn * turns * (turns - 1)) / 2;
}

/** The cost of turn `n` alone, which rises while the total rises faster. */
export function marginal(turns: number, base = BASE, perTurn = PER_TURN): number {
  return base + perTurn * (turns - 1);
}

/** The first turn whose prompt is more than `factor` times the first turn's. */
export function crosses(factor: number): number {
  let turns = 1;
  while (marginal(turns) <= BASE * factor) turns += 1;
  return turns;
}

export function demo() {
  return [2, 4, 6, 8, 10, 12].map((turns) => ({
    turns,
    prompt: prompt(turns),
    base: basePaid(turns),
    work: work(turns),
    marginal: marginal(turns),
  }));
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# six loop sizes\n");
  console.log("  turns  prompt  base paid  the work  marginal turn");
  for (const row of rows) {
    console.log(
      `  ${String(row.turns).padStart(5)} ${String(row.prompt).padStart(7)} ${String(row.base).padStart(13)} ${String(row.work).padStart(9)} ${String(row.marginal).padStart(14)}`,
    );
  }
  console.log(`\n  the base is ${((basePaid(12) / prompt(12)) * 100).toFixed(0)}% of the prompt at twelve turns;`);
  console.log(`  the work is ${((work(12) / prompt(12)) * 100).toFixed(0)}%. The system prompt is not overhead you pay once,`);
  console.log("  it is overhead you pay on every turn, and at thirty turns it is still");
  console.log("  linear while the work has gone quadratic.");
  console.log(`\n  the marginal turn is ${crosses(2)} times the first at ${crosses(2)} turns, and`);
  console.log(`  ${crosses(3)} times at ${crosses(3)}. A loop that is cheap to start is not a loop that is`);
  console.log("  cheap to continue.");
}

if (import.meta.main) report(demo());

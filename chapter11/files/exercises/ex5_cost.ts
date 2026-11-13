// Exercise 5 — what the seam costs, and what it buys instead.
//
// The tempting claim is that delegation saves tokens. At this size it does not:
// the parent still plans every step and every child is a call of its own. The
// exercise prices both paths and then asks the only question that matters —
// under what condition is the extra cost worth paying?

export interface Usage {
  calls: number;
  prompt: number;
}

/** Measured: the live supervisor on the refund task. */
export const SUPERVISOR: Usage = { calls: 3, prompt: 1086 };

/** Estimated: one child as a model turn, one tool call, one answer. */
export const CHILD: Usage = { calls: 2, prompt: 420 };

/** Measured: chapter 8's single agent on the same task. */
export const SINGLE: Usage = { calls: 4, prompt: 1511 };

export interface Path {
  steps: number;
  calls: number;
  prompt: number;
}

/** The delegated path: one supervisor, one child per step. */
export function delegated(steps: number): Path {
  return {
    steps,
    calls: SUPERVISOR.calls + CHILD.calls * steps,
    prompt: SUPERVISOR.prompt + CHILD.prompt * steps,
  };
}

/**
 * The single-agent path, with a growing history.
 *
 * Each turn re-sends everything before it, so the prompt grows by roughly the
 * size of one turn per step. The constant is the system prompt and the tools.
 */
export function single(steps: number, turn = 260, base = 400): Path {
  let prompt = 0;
  for (let i = 0; i < steps; i += 1) prompt += base + turn * i;
  return { steps, calls: steps, prompt };
}

/** What one path costs relative to the other, in prompt tokens. */
export function ratio(steps: number): number {
  return delegated(steps).prompt / single(steps).prompt;
}

export function demo() {
  return [2, 4, 8].map((steps) => ({
    steps,
    delegated: delegated(steps),
    single: single(steps),
    ratio: ratio(steps),
  }));
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# the same work, priced two ways\n");
  console.log("  steps  delegated (calls/tokens)   single (calls/tokens)   delegated/single");
  for (const row of rows) {
    console.log(
      `  ${String(row.steps).padStart(5)}  ${`${row.delegated.calls} / ${row.delegated.prompt}`.padEnd(25)}  ` +
        `${`${row.single.calls} / ${row.single.prompt}`.padEnd(23)}  ${row.ratio.toFixed(2)}×`,
    );
  }
  console.log("\n  delegation loses at two steps and wins by eight, because the single");
  console.log("  agent's history grows with every step while the supervisor's turns do");
  console.log("  not. The ratio crosses one somewhere between the two, and where it");
  console.log("  crosses is a fact about turn sizes, not a law.");
  console.log("");
  console.log("  the case for the seam is not on this table. It is that no agent in the");
  console.log("  delegated path can both read the policy and move the money, and that the");
  console.log("  parent holds a record of what crossed. A team that delegates to save");
  console.log("  tokens has picked the wrong reason.");
}

if (import.meta.main) report(demo());

// Exercise 5 — what an audit costs, in the only currency that matters here.
//
// One image is a little over a thousand prompt tokens, so a model grader is
// usually more expensive than the agent it grades. The binding limit is not
// money on a free tier; it is requests per day, and this table shows when a
// suite stops fitting inside one.

/** Measured on six audits of the same corpus: 7,830 prompt tokens / 6 calls. */
export const TOKENS_PER_AUDIT = 1305;
export const REQUESTS_PER_MINUTE = 15;
export const REQUESTS_PER_DAY = 500;

export interface Budget {
  renders: number;
  runs: number;
  audits: number;
  tokens: number;
  minutes: number;
  days: number;
}

export function budget(renders: number, runs: number): Budget {
  const audits = renders * runs;
  return {
    renders,
    runs,
    audits,
    tokens: audits * TOKENS_PER_AUDIT,
    minutes: audits / REQUESTS_PER_MINUTE,
    days: audits / REQUESTS_PER_DAY,
  };
}

export function demo() {
  return ([[8, 1], [8, 3], [120, 1], [120, 3], [1000, 3]] as const).map(([r, n]) => budget(r, n));
}

const fmt = (n: number) => n.toLocaleString("en-US");

export function report(rows: Budget[]): void {
  console.log("# a suite of renders, audited by a model\n");
  console.log("  renders    runs   audits     tokens    minutes   days of quota");
  for (const b of rows) {
    console.log(
      `  ${String(b.renders).padStart(7)}  ${String(b.runs).padStart(5)}  ${String(b.audits).padStart(7)}  ${fmt(b.tokens).padStart(10)}  ${b.minutes.toFixed(1).padStart(8)}  ${b.days.toFixed(2).padStart(12)}`,
    );
  }
  const [one, , , , ] = rows;
  const three = rows[1];
  console.log(`\n  three runs of the corpus costs ${fmt(three.tokens)} tokens, ${(three.tokens / one.tokens).toFixed(1)}× one run`);
  console.log(`  five hundred audits a day is the ceiling: three runs of 166 renders fits (${budget(166, 3).audits}), three runs of 167 does not (${budget(167, 3).audits})`);
  console.log("\n  the constraint is requests, not tokens: at 15 a minute the suite spends");
  console.log(`  ${fmt(REQUESTS_PER_MINUTE * TOKENS_PER_AUDIT)} tokens a minute against a 250,000 limit, so the`);
  console.log("  day runs out long before the minute does.");
}

if (import.meta.main) report(demo());

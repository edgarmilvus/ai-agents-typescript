// 7.5 — two rates multiplied, and the number a suite reports.
//
// The agent passes p of the time; the judge agrees with the truth a of the
// time. What the report shows is neither: it is the probability that the two
// agree, which is p·a + (1−p)(1−a). This file turns that into a table and an
// inversion, using the accuracy measured in 04.

/** What a suite reports when the grader is right with probability a. */
export function observed(p: number, a: number): number {
  return p * a + (1 - p) * (1 - a);
}

/** Recover the agent's true rate from the reported one, given a known judge. */
export function invert(o: number, a: number): number {
  return (o + a - 1) / (2 * a - 1);
}

const P = 0.7;
const A = 7 / 8; // 04_agreement: 7 of 8 exact

export function demo() {
  return {
    p: P,
    a: A,
    rows: [1, 0.95, 0.9, A, 0.8, 0.7, 0.6].map((a) => ({
      a,
      reported: observed(P, a),
      gain: (observed(P + 0.1, a) - observed(P, a)) * 100,
    })),
    reported: observed(P, A),
    inverted: invert(observed(P, A), A),
  };
}

export function report(d = demo()): void {
  console.log("# a 70% agent, judged by graders of different quality\n");
  console.log("  judge   reported   a 10-point gain shows as");
  for (const row of d.rows) {
    console.log(
      `  ${(row.a * 100).toFixed(1).padStart(5)}%   ${(row.reported * 100).toFixed(1).padStart(5)}%     ${row.gain.toFixed(1).padStart(4)} points`,
    );
  }
  console.log(`\n# the measured judge (${(d.a * 100).toFixed(1)}% exact)`);
  console.log(`  0.70 agent → reported ${(d.reported * 100).toFixed(1)}%, with ${((1 - d.a) * 100).toFixed(1)}% of runs judged wrongly in one direction or the other`);
  console.log(`  a report of ${(d.reported * 100).toFixed(1)}% inverts to ${(d.inverted * 100).toFixed(1)}% once the judge is known`);
  console.log("\n# what a perfect grader would have shown");
  console.log(`  0.70 agent, a = 1.00 → ${(observed(P, 1) * 100).toFixed(1)}%`);
  console.log(`  the gap is the judge's contribution: ${((observed(P, 1) - d.reported) * 100).toFixed(1)} points dragged off the truth, and it is bias rather than noise`);
}

if (import.meta.main) report();

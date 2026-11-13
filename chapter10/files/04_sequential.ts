// 10.4 — three rules for when to stop, at the same error rate.
//
// The question a canary answers is not "is this rate above two percent". It is
// "may I keep going, or do I already know". Looking after every request is the
// only way to know early, and looking repeatedly is exactly what inflates a
// false-alarm rate — unless the boundary is built for it.
//
// Each row below is 2,000 simulated streams of 240 requests. The healthy rate
// is one percent and the rate that must be caught is five.

import { cutoff, fixedSample, onFirstDivergence, reputation, severityFirst } from "../canary.ts";

const RUNS = 2000;
const N = 240;
const rules = [
  { name: "severity first", rule: () => severityFirst() },
  { name: "first divergence", rule: () => onFirstDivergence() },
  { name: `fixed sample (${N})`, rule: () => fixedSample(N) },
];

console.log(`# ${RUNS.toLocaleString("en-US")} streams per row, ${N} requests each`);
console.log(`  a fixed sample of ${N} at a one percent rate needs ${cutoff(N, 0.01, 0.05)} divergences to roll back\n`);

for (const p of [0.01, 0.05]) {
  console.log(`# true divergence rate ${(p * 100).toFixed(1)}%${p === 0.01 ? " (healthy, rollbacks here are false alarms)" : " (must be caught)"}\n`);
  console.log("  rule                rollbacks  share      median stop");
  for (const { name, rule } of rules) {
    const r = reputation(rule, p, RUNS, N);
    console.log(
      `  ${name.padEnd(18)} ${String(r.rollbacks).padStart(8)}  ${(r.falseAlarm * 100).toFixed(1).padStart(6)}%  ${String(r.medianAt).padStart(11)}`,
    );
  }
  console.log("");
}

console.log("  at the healthy rate, the sequential rule and the fixed sample are within");
console.log("  half a point of each other, and the first-divergence rule is useless: a one");
console.log("  percent event over two hundred and forty requests happens to most releases.");
console.log("");
console.log("  at the rate that must be caught, the fixed sample gets there too, at request");
console.log("  240. The sequential rule gets there in a median of 54. Same error rate, four");
console.log("  times less traffic exposed, which is the only reason a canary is allowed to");
console.log("  exist at five percent of a customer base.");

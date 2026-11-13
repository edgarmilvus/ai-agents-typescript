// Exercise 4 — a rate needs a denominator worth quoting.
//
// Two of three is not "67 %". The guard refuses to print a rate until the
// sample is big enough to mean something, and says what would be enough.

export const MIN_CASES = 5;

export interface Sample {
  total: number;
  passed: number;
}

export function report(sample: Sample): string {
  if (sample.total === 0) return "no cases: nothing was measured";
  if (sample.total < MIN_CASES) {
    return `${sample.passed}/${sample.total} passed — sample too small for a rate (${MIN_CASES} cases minimum)`;
  }
  return `${sample.passed}/${sample.total} passed (${Math.round((sample.passed / sample.total) * 100)}%)`;
}

export function demo() {
  return [ { total: 0, passed: 0 }, { total: 3, passed: 2 }, { total: 5, passed: 4 }, { total: 20, passed: 19 } ].map((s) => ({ ...s, text: report(s) }));
}

if (import.meta.main) {
  for (const r of demo()) console.log(r.text);
}

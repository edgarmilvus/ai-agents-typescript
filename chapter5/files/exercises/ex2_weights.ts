// Exercise 2 — weights that add up.
//
// Partial credit is only meaningful if the weights are normalised and a
// missing dimension does not silently raise the score.

export interface Weighted {
  name: string;
  weight: number;
  score: number;
}

export function weighted(parts: Weighted[]): number {
  const total = parts.reduce((n, p) => n + p.weight, 0);
  if (total <= 0) return 0;
  return parts.reduce((n, p) => n + p.weight * clamp(p.score), 0) / total;
}

export function clamp(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

export function demo() {
  return {
    allGood: weighted([{ name: "a", weight: 3, score: 1 }, { name: "b", weight: 1, score: 1 }]),
    oneMissing: weighted([{ name: "a", weight: 3, score: 1 }, { name: "b", weight: 1, score: 0 }]),
    heavyMissing: weighted([{ name: "a", weight: 3, score: 0 }, { name: "b", weight: 1, score: 1 }]),
    clamped: weighted([{ name: "a", weight: 1, score: 4 }, { name: "b", weight: 1, score: -2 }]),
    empty: weighted([]),
  };
}

if (import.meta.main) {
  for (const [k, v] of Object.entries(demo())) console.log(`${k.padEnd(13)} ${v.toFixed(2)}`);
}

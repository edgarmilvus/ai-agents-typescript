// Exercise 5 — how many runs before the number means something.

import { runsNeeded } from "../../stats.ts";

export function demo() {
  return [
    { p: 0.5, hw: 0.2 }, { p: 0.5, hw: 0.1 }, { p: 0.5, hw: 0.05 },
    { p: 0.9, hw: 0.1 }, { p: 0.9, hw: 0.05 },
  ].map((c) => ({ ...c, n: runsNeeded(c.p, c.hw) }));
}

if (["node"].includes(process.execPath.split("/").pop() ?? "")) {
  if (import.meta.main) for (const r of demo()) console.log(`p=${r.p} ±${r.hw * 100}%  →  ${r.n} runs`);
}

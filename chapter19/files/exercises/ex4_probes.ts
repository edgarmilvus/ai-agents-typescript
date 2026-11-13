// Exercise 4 — two probes and both directions.
//
// A probe is a test of a boundary that has to fail in the broken build and pass
// in the fixed one. This exercise writes two: the stream that keeps producing
// after a hang-up, and the ledger that still says complete.
//
// The two runtimes are the chapter's leak and chain. The table is small because
// the discipline is the point, not the coverage.

import { makeEnv, run } from "../../stream.ts";
import type { Mode } from "../../stream.ts";

export interface Probe {
  id: string;
  link: string;
  run(mode: Mode): Promise<boolean>;
}

export const PROBES: Probe[] = [
  {
    id: "q1-stream",
    link: "stream",
    async run(mode) {
      const env = await run(makeEnv(mode), { abortAt: "chunk", after: 2 });
      return env.chunks > 2;
    },
  },
  {
    id: "q2-ledger",
    link: "ledger",
    async run(mode) {
      const env = await run(makeEnv(mode), { abortAt: "chunk", after: 2 });
      return env.ledger === "complete";
    },
  },
];

export interface Row {
  probe: string;
  link: string;
  leak: boolean;
  chain: boolean;
}

export async function demo(): Promise<Row[]> {
  const rows: Row[] = [];
  for (const probe of PROBES) {
    rows.push({
      probe: probe.id,
      link: probe.link,
      leak: await probe.run("leak"),
      chain: await probe.run("chain"),
    });
  }
  return rows;
}

export function report(rows: Row[]): void {
  console.log("# two probes, two runtimes\n");
  console.log("  probe       link    leak  chain");
  for (const row of rows) {
    console.log(
      `  ${row.probe.padEnd(12)}${row.link.padEnd(8)}${(row.leak ? "LEAK" : "ok").padStart(5)}  ${(row.chain ? "LEAK" : "ok").padStart(5)}`,
    );
  }
  const leakCount = rows.filter((row) => row.leak).length;
  const chainCount = rows.filter((row) => row.chain).length;
  console.log(`\n  leak: ${leakCount}/${rows.length}   chain: ${chainCount}/${rows.length}`);
  console.log("");
  console.log("  both probes fail in the leak build, which is what makes them probes.");
  console.log("  A test that passes in the build with the bug is not measuring the bug; it");
  console.log("  is measuring something else that happens to be green.");
}

if (import.meta.main) report(await demo());

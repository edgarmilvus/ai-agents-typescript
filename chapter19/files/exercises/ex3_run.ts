// Exercise 3, file 3 of 3 — the wiring and the table.
//
// Three runs of the same six-piece stream: two customers who left and one who
// stayed. The table is the chapter in miniature: chunks and tokens count what
// happened, the tool and the ledger say what the system believes happened.

import type { Outcome } from "./ex3_runner.ts";
import { go } from "./ex3_runner.ts";

export interface Row extends Outcome {
  run: string;
}

export async function demo(): Promise<Row[]> {
  const rows: Row[] = [];
  rows.push({ run: "stop at 2", ...(await go(2)) });
  rows.push({ run: "stop at 5", ...(await go(5)) });
  rows.push({ run: "full", ...(await go()) });
  return rows;
}

export function report(rows: Row[]): void {
  console.log("# three runs, one stream\n");
  console.log("  run        chunks  tokens  tool  ledger");
  for (const row of rows) {
    console.log(
      `  ${row.run.padEnd(10)} ${String(row.chunks).padStart(6)} ${String(row.tokens).padStart(7)}  ${(row.tool ? "yes" : "no").padEnd(5)} ${row.ledger}`,
    );
  }
  console.log("");
  console.log("  the tool runs only on the full run. A run that stopped at two pieces has");
  console.log("  not read the sentence about the refund window, so a tool that issues a");
  console.log("  refund on its behalf would be acting on a claim nobody made.");
  console.log("");
  console.log("  the ledger and the side effect have to agree. A cancelled run with");
  console.log("  `tool: true` is a refund written for a conversation that never reached");
  console.log("  the question, which is the failure the three files exist to prevent.");
}

if (import.meta.main) report(await demo());

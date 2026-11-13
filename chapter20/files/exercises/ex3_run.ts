// Exercise 3, file 3 of 3 — the wiring and the table.
//
// The same two adapters read through the same port. The table shows what the
// caller sees, not what either provider sent: text, finish reason, and the two
// capabilities that are not event-shaped.

import type { Adapter } from "./ex3_adapter.ts";
import { alpha, beta } from "./ex3_adapter.ts";

export interface Row {
  name: string;
  text: string;
  finish: string;
  tools: boolean;
  streaming: boolean;
}

function rowOf(adapter: Adapter): Row {
  const events = adapter.events();
  const texts: string[] = [];
  let finish = "none";
  for (const event of events) {
    if (event.type === "text") texts.push(event.text);
    else finish = event.reason;
  }
  return {
    name: adapter.name,
    text: texts.join(""),
    finish,
    tools: adapter.capabilities.tools,
    streaming: adapter.capabilities.streaming,
  };
}

export function demo(): Row[] {
  return [rowOf(alpha), rowOf(beta)];
}

export function report(rows: Row[]): void {
  console.log("# two adapters, one port\n");
  console.log("  adapter  text         finish  tools  streaming");
  for (const row of rows) {
    console.log(
      `  ${row.name.padEnd(9)}${row.text.padEnd(13)}${row.finish.padEnd(8)}${(row.tools ? "yes" : "no").padEnd(7)}${row.streaming ? "yes" : "no"}`,
    );
  }
  console.log("");
  console.log("  the two rows are identical in the columns the agent reads and different");
  console.log("  in the capability the caller has to respect. That is the split: events");
  console.log("  are normalized, capabilities are declared, and neither is inferred from");
  console.log("  the other.");
}

if (import.meta.main) report(demo());

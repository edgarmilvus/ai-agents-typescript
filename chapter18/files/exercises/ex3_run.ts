// Exercise 3, file 3 of 3 — the wiring and the table.
//
// Seven rows, two tenants, two purges. The acme half has two rows nobody
// tracked, so the closure cannot finish; the globex half is clean, which is the
// control. The table is the same shape as the chapter's matrix, with statuses
// instead of verdicts.

import type { Row } from "./ex3_purge.ts";
import { purge } from "./ex3_purge.ts";

function build(): Row[] {
  return [
    { id: "a-order", tenant: "acme", content: "A-1 84.00 EUR", from: [] },
    { id: "a-note", tenant: "acme", content: "invoice to billing@acme.example", from: [] },
    { id: "a-summary", tenant: "platform", content: "Acme prefers email", from: ["a-note"] },
    { id: "a-fixture", tenant: "platform", content: "fixture: refund of 84.00", from: ["a-summary"] },
    { id: "a-backup", tenant: "platform", content: "snapshot 2026-09-01 acme orders", from: [] },
    { id: "a-paraphrase", tenant: "platform", content: "the EU customer prefers email", from: [] },
    { id: "g-order", tenant: "globex", content: "G-1 640.00 EUR", from: [] },
  ];
}

export interface TableRow {
  tenant: string;
  mode: string;
  removed: number;
  survivors: number;
  status: string;
  hits: string;
}

export function demo(): TableRow[] {
  const out: TableRow[] = [];
  for (const tenant of ["acme", "globex"]) {
    for (const mode of ["naive", "closure"] as const) {
      const result = purge(build(), tenant, mode);
      out.push({
        tenant,
        mode,
        removed: result.removed.length,
        survivors: result.survivors.length,
        status: result.status,
        hits: result.hits.join(", ") || "-",
      });
    }
  }
  return out;
}

export function report(rows: TableRow[]): void {
  console.log("# seven rows, two tenants, two purges\n");
  console.log("  tenant  mode     removed  survivors  status    hits");
  for (const row of rows) {
    console.log(
      `  ${row.tenant.padEnd(8)}${row.mode.padEnd(9)}${String(row.removed).padStart(7)}${String(row.survivors).padStart(11)}  ${row.status.padEnd(9)} ${row.hits}`,
    );
  }
  console.log("");
  console.log("  acme's closure removes four of its six rows and then finds the backup,");
  console.log("  which has no edge and does spell the label. It reports residual instead");
  console.log("  of clean, and the paraphrase is not in the hit list at all: it survives");
  console.log("  without a trace the scan can read. Globex is the control, and it can");
  console.log("  finish because nothing in its half was copied without an edge.");
}

if (import.meta.main) report(demo());

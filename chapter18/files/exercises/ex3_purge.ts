// Exercise 3, file 2 of 3 — the store, the purge and the scan.
//
// The store is an array of rows. A row has a tenant column and, when it was
// derived, a list of inputs. The two purges differ in one line: which ids they
// remove. The scan is what turns a deletion into a report.

import type { Node } from "./ex3_graph.ts";
import { closure } from "./ex3_graph.ts";

export interface Row extends Node {
  tenant: string;
  content: string;
}

export type Mode = "naive" | "closure";
export type Status = "claimed" | "clean" | "residual";

export interface Result {
  tenant: string;
  mode: Mode;
  removed: string[];
  survivors: string[];
  status: Status;
  /** Ids still in the store whose content mentions the tenant's label. */
  hits: string[];
}

export function scan(rows: Row[], label: string): string[] {
  const needle = label.toLowerCase();
  return rows.filter((row) => row.content.toLowerCase().includes(needle)).map((row) => row.id);
}

/**
 * Delete a tenant's data.
 *
 * `naive` removes the rows whose tenant column matches. `closure` removes the
 * roots and everything derived from them. Neither can remove a copy that never
 * recorded its input; only the scan can say that the copy is still there.
 */
export function purge(rows: Row[], tenant: string, mode: Mode): Result {
  const roots = rows.filter((row) => row.tenant === tenant).map((row) => row.id);
  const doomed = mode === "naive" ? roots : closure(rows, roots);
  const gone = new Set(doomed);
  const survivors = rows.filter((row) => !gone.has(row.id));

  if (mode === "naive") {
    return { tenant, mode, removed: doomed, survivors: survivors.map((r) => r.id), status: "claimed", hits: [] };
  }

  const hits = scan(survivors, tenant);
  return {
    tenant,
    mode,
    removed: doomed,
    survivors: survivors.map((r) => r.id),
    status: hits.length > 0 ? "residual" : "clean",
    hits,
  };
}

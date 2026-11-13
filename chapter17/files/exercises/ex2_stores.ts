// Exercise 2 — every store, one question.
//
// Isolation is not a property of the query; it is a property of each store the
// query reaches. This exercise writes the matrix by hand: four stores, two
// builds, and the answer for each cell.

export type Store = "orders" | "memory" | "cache" | "audit";
export type Mode = "global" | "scoped";

/**
 * Would a request from tenant A, about tenant B's data, succeed?
 *
 * The logic is literal on purpose: each store has its own reason to leak, and
 * the table is the chapter's claim written four times.
 */
export function leaks(store: Store, mode: Mode): boolean {
  if (mode === "global") return true;
  switch (store) {
    case "orders":
      // The tool's table is the tenant's array; G-1 is not in it.
      return false;
    case "memory":
      // The store is filtered by the tenant's own id.
      return false;
    case "cache":
      // The key is prefixed with the tenant's label.
      return false;
    case "audit":
      // The audit is filtered by object identity.
      return false;
  }
}

export const STORES: Store[] = ["orders", "memory", "cache", "audit"];
export const MODES: Mode[] = ["global", "scoped"];

export function demo() {
  return STORES.map((store) => ({
    store,
    cells: MODES.map((mode) => ({ mode, leaked: leaks(store, mode) })),
  }));
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# four stores, two builds\n");
  console.log(`  ${"store".padEnd(9)} ${MODES.map((m) => m.padStart(8)).join("")}`);
  for (const row of rows) {
    console.log(`  ${row.store.padEnd(9)}${row.cells.map((c) => (c.leaked ? "LEAK" : "ok").padStart(8)).join("")}`);
  }
  const leaking = rows.reduce((n, row) => n + row.cells.filter((c) => c.leaked).length, 0);
  console.log(`\n  ${leaking} of ${rows.length * MODES.length} cells leak, and every one of them is in the global column.`);
  console.log("");
  console.log("  the scoped column is not four checks; it is four different mechanisms.");
  console.log("  Orders are safe because the closure is small, memory because the filter is");
  console.log("  on the id, cache because the key is prefixed, audit because the view is");
  console.log("  filtered. A team that fixes one and assumes the rest is the team this");
  console.log("  table exists for.");
}

if (import.meta.main) report(demo());

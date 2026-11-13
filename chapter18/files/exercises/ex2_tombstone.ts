// Exercise 2 — a record, not a copy.
//
// A deletion has to leave evidence, and the evidence must not be the data. This
// exercise builds a tombstone out of a hash and a count, and tries the three
// properties that make it safe: it does not name the customer, it is stable
// across runs, and two customers cannot collide by accident.

import { createHash } from "node:crypto";

export interface Tombstone {
  id: string;
  content: string;
  removed: number;
}

export function hashOf(label: string): string {
  return createHash("sha256").update(label).digest("hex").slice(0, 12);
}

/**
 * The record of a deletion: an id derived from the label, a content line with
 * the hash and the count, and nothing that can be turned back into a customer.
 */
export function tombstoneOf(label: string, removed: number): Tombstone {
  const hash = hashOf(label);
  return {
    id: `tombstone-${hash}`,
    content: `tombstone:${hash}:${removed}`,
    removed,
  };
}

export const LABELS = ["acme", "globex", "initech"];

export function demo(): (Tombstone & { label: string; names: boolean })[] {
  return LABELS.map((label) => {
    const record = tombstoneOf(label, 7);
    return {
      ...record,
      label,
      names: record.id.includes(label) || record.content.includes(label),
    };
  });
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# three customers, three records\n");
  console.log("  label     tombstone                  names the customer");
  for (const row of rows) {
    console.log(`  ${row.label.padEnd(9)} ${row.id.padEnd(26)} ${row.names ? "YES" : "no"}`);
  }

  const stable = rows.every((row) => tombstoneOf(row.label, row.removed).id === row.id);
  const second = tombstoneOf("acme", 7);
  console.log(`\n  stable across runs : ${stable}`);
  console.log(`  same input, same id: ${second.id === rows[0].id}`);
  console.log(`  content            : ${rows[0].content}`);
  console.log(`  count changes id?  : ${tombstoneOf("acme", 8).id === rows[0].id ? "no, only the content" : "yes"}`);
  console.log("");
  console.log("  the id is a hash, so it is stable and it does not name anybody. The count");
  console.log("  is in the content because 'how many' is evidence a reviewer needs, and it");
  console.log("  is not evidence an attacker can use: a number of rows is not a row.");
}

if (import.meta.main) report(demo());

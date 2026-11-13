// Exercise 3, file 3 of 3 — the wiring and the table.
//
// Two tenants, one store, four reads. The table shows what each read can see,
// and the last row is the one the exercise is about: the key that a tenant
// could build for another tenant, and the lookup that refuses it anyway.

import { key } from "./ex3_keys.ts";
import { ScopedStore } from "./ex3_store.ts";

const store = new ScopedStore();
store.put("acme", "ORD-1", "refund 84 EUR");
store.put("globex", "ORD-9", "escalate to the partner desk");

export interface Row {
  read: string;
  tenant: string;
  subject: string;
  got: string | undefined;
}

export function demo(): Row[] {
  return [
    { read: "acme reads its own", tenant: "acme", subject: "ORD-1", got: store.get("acme", "ORD-1") },
    { read: "acme reads globex's", tenant: "acme", subject: "ORD-9", got: store.get("acme", "ORD-9") },
    { read: "globex reads its own", tenant: "globex", subject: "ORD-9", got: store.get("globex", "ORD-9") },
    { read: "acme reads globex's key", tenant: "acme", subject: "ORD-9", got: store.getUnsafe(key("globex", "ORD-9")) },
  ];
}

export function report(rows: Row[]): void {
  console.log("# four reads, one store\n");
  console.log("  read                     got");
  for (const row of rows) console.log(`  ${row.read.padEnd(24)} ${row.got ?? "nothing"}`);
  console.log(`\n  the store holds ${store.size} entries and ${store.keysOf("acme").length} of them are acme's.`);
  console.log("");
  console.log("  the fourth row is what an unsafe read looks like. The key function is");
  console.log("  public, so anyone can build the string that names another tenant, and a");
  console.log("  read that takes a joined key and trusts it returns the value. `get` checks");
  console.log("  the entry's own tenant against the caller's; `getUnsafe` does not, and the");
  console.log("  table is the difference in one line.");
}

if (import.meta.main) report(demo());

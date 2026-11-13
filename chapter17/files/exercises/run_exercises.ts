// Chapter 17 exercise harness.
//
//   node chapter17/files/exercises/run_exercises.ts
//
// Offline: ids are objects, stores are maps, and every probe runs in memory.

process.env.AGENTLAB_REPLAY = "1";

import { CASES, demo as keyRows, isTenantId, mint, reset } from "./ex1_key.ts";
import { MODES, STORES, demo as storeRows, leaks } from "./ex2_stores.ts";
import { collides, key, parse, tenantOf } from "./ex3_keys.ts";
import { ScopedStore } from "./ex3_store.ts";
import { demo as budgetRows, run as quota } from "./ex4_quota.ts";
import { demo as probeRows } from "./ex5_probes.ts";

let checks = 0;
let failures = 0;

function check_(name: string, ok: boolean, detail?: unknown): void {
  checks += 1;
  if (ok) console.log(`PASS ${name}`);
  else {
    failures += 1;
    console.log(`FAIL ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

function equal(name: string, actual: unknown, expected: unknown): void {
  check_(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });
}

// 1 — the key
{
  reset();
  const id = mint("acme");
  equal("ex1 a minted id is accepted", isTenantId(id), true);
  equal("ex1 a string is not an id", isTenantId("acme"), false);
  equal("ex1 a copy is not an id", isTenantId({ ...id }), false);
  equal("ex1 the demo has five cases", keyRows().length, 5);
  check_("ex1 every case behaves as declared", keyRows().every((r) => r.ok));
  reset();
  mint("dup");
  check_("ex1 a duplicate name is refused", (() => {
    try {
      mint("dup");
      return false;
    } catch {
      return true;
    }
  })());
  reset();
  equal("ex1 reset forgets the id", isTenantId(id), false);
}

// 2 — the stores
{
  const rows = storeRows();
  equal("ex2 four stores", rows.length, STORES.length);
  equal("ex2 two modes", MODES.length, 2);
  check_("ex2 the global build leaks every store", rows.every((r) => r.cells.find((c) => c.mode === "global")?.leaked));
  check_("ex2 the scoped build leaks none", rows.every((r) => !r.cells.find((c) => c.mode === "scoped")?.leaked));
  equal("ex2 the leak count", rows.reduce((n, r) => n + r.cells.filter((c) => c.leaked).length, 0), 4);
}

// 3 — three files
{
  equal("ex3 a key joins both parts", parse(key("acme", "ORD-1")), { tenant: "acme", subject: "ORD-1" });
  equal("ex3 the tenant is recoverable", tenantOf(key("acme", "ORD-1")), "acme");
  equal("ex3 two tenants, different keys", collides(key("acme", "ORD-1"), key("globex", "ORD-1")), false);
  check_("ex3 a key needs a tenant", (() => {
    try {
      key("", "ORD-1");
      return false;
    } catch {
      return true;
    }
  })());

  const store = new ScopedStore();
  store.put("acme", "ORD-1", "refund 84");
  store.put("globex", "ORD-9", "escalate");
  equal("ex3 a read returns its own", store.get("acme", "ORD-1"), "refund 84");
  equal("ex3 a cross-read returns nothing", store.get("acme", "ORD-9"), undefined);
  equal("ex3 the store is shared underneath", store.size, 2);
  equal("ex3 keys are per tenant", store.keysOf("acme").length, 1);
  equal("ex3 the unsafe read is unsafe", store.getUnsafe(key("globex", "ORD-9")), "escalate");
}

// 4 — the quota
{
  const rows = budgetRows();
  equal("ex4 two policies", rows.length, 2);
  const shared = rows[0];
  const split = rows[1];
  equal("ex4 the shared meter refuses globex", [shared.acme.allowed, shared.globex.allowed, shared.globex.refused], [4, 0, 2]);
  equal("ex4 the split meter does not", [split.acme.allowed, split.globex.allowed, split.globex.refused], [4, 2, 0]);
  equal("ex4 acme is refused twice either way", [shared.acme.refused, split.acme.refused], [2, 2]);
  check_("ex4 the shared meter charges globex nothing", quota(true).globex.allowed === 0);
}

// 5 — the probes
{
  const rows = probeRows();
  equal("ex5 three probes", rows.length, 3);
  check_("ex5 every probe leaks in the global build", rows.every((r) => r.global));
  check_("ex5 and none leaks in the scoped build", rows.every((r) => !r.scoped));
  equal("ex5 one probe per store", rows.map((r) => r.store).sort(), ["cache", "memory", "orders"]);
}

console.log(`\n${checks - failures}/${checks} exercise checks passed`);
if (failures) process.exit(1);

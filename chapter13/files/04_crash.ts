// 13.4 — exactly once, at every crash point.
//
// There are three moments a process can die around an effect: before it, after
// it and before the record, and after the record and before the caller is told.
// The first is free; the third is a replay; the second is the one that pays the
// customer twice unless the effect itself carries a key.
//
// Each row below runs the same approval, kills the process at a different
// point, recovers, and counts the money.

import { approve, createStore, execute, propose, resume } from "../machine.ts";
import { createWorld } from "../world.ts";
import { apply } from "../world.ts";
import { actionHash } from "../token.ts";

const KEY = "approver-side-key";
const APPROVERS = ["ada", "grace"];
const TTL = 10;
const REFUND = { tool: "issue_refund", args: { orderId: "ORD-7902", amount: 300 } };

function setup() {
  const store = createStore();
  const world = createWorld();
  propose(store, {
    id: "r1",
    requester: "agent",
    proposal: { action: REFUND, reason: "damaged", evidence: ["ORD-7902"], expiresAt: 100 },
  });
  approve(store, "r1", "ada", 1, TTL, KEY, APPROVERS);
  const run = store.runs.get("r1")!;
  resume(store, "r1", run.approval!, 2, KEY);
  return { store, world, key: `${"r1"}/${actionHash(REFUND)}` };
}

const rows: { point: string; before: number; after: number; status: string; note: string }[] = [];

// A — the process dies before the effect.
{
  const s = setup();
  const before = s.world.effects.length;
  // crash here: nothing has happened yet
  execute(s.store, "r1", s.world, 3);
  rows.push({ point: "before the effect", before, after: s.world.effects.length, status: s.store.runs.get("r1")!.status, note: "recovery is the first execution" });
}

// B — the effect lands, the record does not.
{
  const s = setup();
  apply(s.world, s.key, REFUND.tool, REFUND.args, 3);
  const before = s.world.effects.length;
  const out = execute(s.store, "r1", s.world, 4);
  rows.push({
    point: "after the effect",
    before,
    after: s.world.effects.length,
    status: s.store.runs.get("r1")!.status,
    note: out.ok && !out.value.applied ? "recovery reconciled, did not pay again" : "recovery paid twice",
  });
}

// C — the record lands, the caller never hears.
{
  const s = setup();
  execute(s.store, "r1", s.world, 3);
  const before = s.world.effects.length;
  const run = s.store.runs.get("r1")!;
  const replay = execute(s.store, "r1", s.world, 4);
  rows.push({
    point: "after the record",
    before,
    after: s.world.effects.length,
    status: run.status,
    note: replay.ok ? "replay was accepted" : `replay refused: ${replay.reason}`,
  });
}

console.log("# three crash points, one approval\n");
console.log("  crash point         effects before  effects after  status    recovery");
for (const row of rows) {
  console.log(`  ${row.point.padEnd(19)} ${String(row.before).padStart(14)}  ${String(row.after).padStart(13)}  ${row.status.padEnd(9)} ${row.note}`);
}

console.log("\n  the middle row is the one the chapter exists for. The approval was valid,");
console.log("  the effect was real, and the process died before it could say so. The");
console.log("  run's own record cannot fix that, because the record is what was lost —");
console.log("  the idempotency key on the effect is what makes the retry safe.");

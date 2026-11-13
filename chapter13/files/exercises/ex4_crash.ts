// Exercise 4 — exactly once, at every crash point.
//
// A durable run has a small number of steps, and a crash can happen between any
// two of them. This exercise walks the six boundaries, kills the process at
// each, recovers, and checks that the world saw the effect exactly once.
//
// The recovery is the same code every time: try to execute, and accept that a
// world which already has the effect will say so.

import { approve, createStore, execute, propose, resume } from "../../machine.ts";
import { apply, createWorld } from "../../world.ts";
import type { World } from "../../world.ts";
import { actionHash } from "../../token.ts";
import type { Store } from "../../machine.ts";

const KEY = "exercise-key";
const APPROVERS = ["ada"];
const TTL = 10;
const ACTION = { tool: "issue_refund", args: { orderId: "ORD-7902", amount: 300 } };

interface Progress {
  store: Store;
  world: World;
  approved: boolean;
  resumed: boolean;
  effect: boolean;
  recorded: boolean;
}

function start(): Progress {
  return { store: createStore(), world: createWorld(), approved: false, resumed: false, effect: false, recorded: false };
}

/** Run the script up to `k` events, then recover. */
export function crashAt(k: number): { point: string; effects: number; status: string; note: string } {
  const p = start();
  propose(p.store, {
    id: "r1",
    requester: "agent",
    proposal: { action: ACTION, reason: "damaged", evidence: ["ORD-7902"], expiresAt: 100 },
  });

  // The script, one event per position.
  if (k >= 1) {
    approve(p.store, "r1", "ada", 1, TTL, KEY, APPROVERS);
    p.approved = true;
  }
  if (k >= 2) {
    const token = p.store.runs.get("r1")!.approval!;
    resume(p.store, "r1", token, 2, KEY);
    p.resumed = true;
  }
  if (k >= 4) {
    // The effect leaves the desk. From here on the world cannot forget it.
    apply(p.world, `r1/${actionHash(ACTION)}`, ACTION.tool, ACTION.args, 3);
    p.effect = true;
  }
  if (k >= 5) {
    execute(p.store, "r1", p.world, 4);
    p.recorded = true;
  }

  // Recovery: whatever the process missed, it does now, and it may do it twice.
  let note = "recovered";
  if (!p.approved) {
    approve(p.store, "r1", "ada", 5, TTL, KEY, APPROVERS);
    note = "the approval had not been issued";
  }
  if (!p.resumed) {
    const token = p.store.runs.get("r1")!.approval;
    if (token) resume(p.store, "r1", token, 6, KEY);
  }
  const out = execute(p.store, "r1", p.world, 7);
  if (!out.ok && p.recorded) note = `replay refused: ${out.reason}`;
  else if (!out.ok) note = `execute refused: ${out.reason}`;
  else if (p.effect && out.ok && !out.value.applied) note = "reconciled: the world already had it";

  return {
    point: ["before anything", "after propose", "after approve", "after resume", "after the effect", "after the record"][k] ?? `k=${k}`,
    effects: p.world.effects.length,
    status: p.store.runs.get("r1")!.status,
    note,
  };
}

export function demo() {
  return [0, 1, 2, 3, 4, 5].map((k) => crashAt(k));
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# six crash points, one approval\n");
  console.log("  crash point          effects  status    recovery");
  for (const row of rows) {
    console.log(`  ${row.point.padEnd(20)} ${String(row.effects).padStart(7)}  ${row.status.padEnd(9)} ${row.note}`);
  }
  const worst = Math.max(...rows.map((r) => r.effects));
  console.log(`\n  worst case across six crashes: ${worst} effect(s).`);
  console.log("  the row that matters is 'after the effect': the process died before it could");
  console.log("  record what it did, and the recovery found the effect already there.");
}

if (import.meta.main) report(demo());

// Chapter 18 — three ways to delete a tenant, and what each one can prove.
//
// `naive` removes the rows where the tenant column says acme. `graph` follows
// the derived-from edges from those rows and removes the closure. `verified`
// does the same and then scans what is left for the label, because the two
// copies that hurt are the ones no edge reaches.
//
// The third mode is not "better"; it is the first one that can tell the
// difference between a deletion and a claim.

import type { Hit, TenantId, World } from "./world.ts";
import { closure, residue, tenantRows, tombstone, tombstoneId } from "./world.ts";

export type Mode = "naive" | "graph" | "verified";

export interface Report {
  mode: Mode;
  /** Ids removed, in the order the walk found them. */
  deleted: string[];
  /** Ids still in the world after the purge. */
  survivors: string[];
  /**
   * `claimed` — the mode has no evidence either way.
   * `clean`   — the scan ran and found nothing.
   * `residual`— the scan found copies and the deletion refuses to call itself done.
   */
  status: "claimed" | "clean" | "residual";
  /** What the scan found. Empty for the modes that do not scan. */
  residue: Hit[];
  tombstone?: string;
}

function remove(world: World, ids: string[]): string[] {
  const removed: string[] = [];
  for (const id of ids) {
    if (world.artefacts.delete(id)) removed.push(id);
  }
  return removed;
}

function survivorsOf(world: World): string[] {
  return [...world.artefacts.keys()];
}

/**
 * Delete the rows the tenant owns.
 *
 * This is the deletion most systems implement, and it is correct for exactly
 * the artefacts that carry the tenant column. It says nothing about anything
 * computed from them, because the batch that computed it wrote its own name in
 * that column.
 */
export function naive(world: World, t: TenantId): Report {
  const deleted = remove(world, tenantRows(world, t).map((a) => a.id));
  return { mode: "naive", deleted, survivors: survivorsOf(world), status: "claimed", residue: [] };
}

/**
 * Delete the rows and everything derived from them, transitively.
 *
 * This is the first mode that is a deletion rather than a filter, and its
 * correctness depends on a property of the writers: every derivation recorded
 * its inputs. The verification below is how you find out whether they did.
 */
export function graph(world: World, t: TenantId): Report {
  const roots = tenantRows(world, t).map((a) => a.id);
  const deleted = remove(world, closure(world, roots));
  return { mode: "graph", deleted, survivors: survivorsOf(world), status: "claimed", residue: [] };
}

/**
 * Delete the closure, then look for what the closure missed.
 *
 * A hit is not deleted here. A backup is not a row; it is a restore path with
 * its own retention policy, and removing it from this process would be a lie
 * about the system that holds it. The report carries the hit and stays open.
 */
export function verified(world: World, t: TenantId): Report {
  const roots = tenantRows(world, t).map((a) => a.id);
  const deleted = remove(world, closure(world, roots));
  const hits = residue(world, t.label);

  if (hits.length > 0) {
    return {
      mode: "verified",
      deleted,
      survivors: survivorsOf(world),
      status: "residual",
      residue: hits,
    };
  }

  const record = tombstoneId(t.label);
  if (!world.artefacts.has(record)) tombstone(world, t, deleted.length);
  return {
    mode: "verified",
    deleted,
    survivors: survivorsOf(world),
    status: "clean",
    residue: [],
    tombstone: record,
  };
}

export function run(world: World, mode: Mode, t: TenantId): Report {
  switch (mode) {
    case "naive":
      return naive(world, t);
    case "graph":
      return graph(world, t);
    case "verified":
      return verified(world, t);
  }
}

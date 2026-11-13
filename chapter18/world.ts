// Chapter 18 — the world, its lineage, and the copies that outlive a row.
//
// Chapter 17 gave every store a tenant key. This chapter gives every artefact a
// parent: the ids it was computed from. A deletion then has a shape — the
// closure of a tenant's rows under the derived-from edges — and a limit, which
// is any copy whose edge nobody wrote down.
//
// The world is deliberately small: fourteen artefacts, four tenants, one scan.
// The point is not the volume, it is that six of the fourteen survive a row
// filter and two of those survive a graph walk as well.

import { createHash } from "node:crypto";
import type { TenantId } from "../chapter17/tenant.ts";
import { clearTenants, tenant } from "../chapter17/tenant.ts";

export type Kind =
  | "order"
  | "note"
  | "cache"
  | "transcript"
  | "fixture"
  | "embedding"
  | "summary"
  | "backup"
  | "tombstone";

export interface Artefact {
  id: string;
  kind: Kind;
  /** Who owns the row. Derived artefacts are owned by the platform that wrote them. */
  tenant: TenantId;
  content: string;
  /** Ids this artefact was computed from. Empty means the writer recorded nothing. */
  derivedFrom: string[];
}

export interface World {
  artefacts: Map<string, Artefact>;
  acme: TenantId;
  globex: TenantId;
  initech: TenantId;
  platform: TenantId;
}

/** A scan hit: which artefact still mentions the tenant, and where. */
export interface Hit {
  id: string;
  kind: Kind;
  snippet: string;
}

/** The one function that builds a world. Every demo and probe starts here. */
export function makeWorld(): World {
  clearTenants();
  const quota = { calls: 8, tokens: 4000 };
  const acme = tenant("acme", "Acme Ltd", [], "EU", quota).id;
  const globex = tenant("globex", "Globex", [], "EU", quota).id;
  const initech = tenant("initech", "Initech", [], "US", quota).id;
  const platform = tenant("platform", "Platform", [], "EU", quota).id;

  const world: World = { artefacts: new Map(), acme, globex, initech, platform };

  // Direct rows: these carry the customer's id, and a row filter finds them.
  put(world, {
    id: "a-order-1",
    kind: "order",
    tenant: acme,
    content: "A-1 refund 84.00 EUR, 5 days since delivery",
    derivedFrom: [],
  });
  put(world, {
    id: "a-note-1",
    kind: "note",
    tenant: acme,
    content: "Acme asked for invoices to go to billing@acme.example",
    derivedFrom: [],
  });
  put(world, {
    id: "a-cache-1",
    kind: "cache",
    tenant: acme,
    content: "acme|what is the refund window -> 14 days",
    derivedFrom: [],
  });

  // Derived rows: written by the platform, so their tenant column is not acme.
  // Each names its inputs, which is the only reason a walk can find them.
  derive(world, {
    id: "a-summary-1",
    kind: "summary",
    content: "Acme prefers email invoices; EU desk.",
    from: ["a-note-1"],
  });
  derive(world, {
    id: "a-transcript-1",
    kind: "transcript",
    content: "customer acme: refund 84 EUR to billing@acme.example",
    from: ["a-order-1", "a-note-1"],
  });
  derive(world, {
    id: "a-fixture-1",
    kind: "fixture",
    content: "fixture: acme refund of 84.00 EUR in 5 days",
    from: ["a-transcript-1"],
  });
  derive(world, {
    id: "a-embedding-1",
    kind: "embedding",
    content: "vec[0.12,0.98,0.33] billing@acme.example invoice",
    from: ["a-note-1"],
  });

  // Two copies nobody linked. The backup predates the lineage table; the
  // paraphrase was written by a person into a shared document.
  put(world, {
    id: "a-backup-1",
    kind: "backup",
    tenant: platform,
    content: "snapshot 2026-09-01 acme orders: A-1 84.00 EUR",
    derivedFrom: [],
  });
  put(world, {
    id: "a-paraphrase-1",
    kind: "summary",
    tenant: platform,
    content: "the EU customer with the 84 EUR refund prefers email",
    derivedFrom: [],
  });

  // Neighbours, so the scan has something it must not touch.
  put(world, {
    id: "g-order-1",
    kind: "order",
    tenant: globex,
    content: "G-1 refund 640.00 EUR, 21 days since delivery",
    derivedFrom: [],
  });
  put(world, {
    id: "g-note-1",
    kind: "note",
    tenant: globex,
    content: "Globex confirmed the refund address is 9 Kingsway",
    derivedFrom: [],
  });
  derive(world, {
    id: "g-summary-1",
    kind: "summary",
    content: "Globex prefers post; EU desk.",
    from: ["g-note-1"],
  });
  put(world, {
    id: "i-order-1",
    kind: "order",
    tenant: initech,
    content: "I-1 refund 1200.00 USD, 10 days since delivery",
    derivedFrom: [],
  });
  put(world, {
    id: "i-note-1",
    kind: "note",
    tenant: initech,
    content: "Initech's US ceiling is 1000 USD under their contract",
    derivedFrom: [],
  });

  return world;
}

export function put(world: World, artefact: Artefact): void {
  if (world.artefacts.has(artefact.id)) throw new Error(`artefact ${artefact.id} already exists`);
  world.artefacts.set(artefact.id, artefact);
}

export interface DeriveSpec {
  id: string;
  kind: Kind;
  content: string;
  from: string[];
}

/**
 * Write an artefact and its edges.
 *
 * The validation is the chapter's cheapest control and its most important one:
 * a derivation that names an input nobody has is refused at write time, when the
 * author still knows what the input was. At deletion time it is too late.
 */
export function derive(world: World, spec: DeriveSpec): Artefact {
  if (spec.from.length === 0) throw new Error(`derivation ${spec.id} names no inputs`);
  for (const input of spec.from) {
    if (!world.artefacts.has(input)) throw new Error(`${spec.id} derives from unknown ${input}`);
  }
  const artefact: Artefact = {
    id: spec.id,
    kind: spec.kind,
    tenant: world.platform,
    content: spec.content,
    derivedFrom: [...spec.from],
  };
  put(world, artefact);
  return artefact;
}

/** Everything computed from this artefact, one step out. */
export function successors(world: World, id: string): Artefact[] {
  return [...world.artefacts.values()].filter((a) => a.derivedFrom.includes(id));
}

/**
 * The roots, and everything reachable from them.
 *
 * Insertion order is preserved, which is why the demo's list is stable and the
 * closure can be printed next to the edges that produced it.
 */
export function closure(world: World, roots: string[]): string[] {
  const seen = new Set<string>();
  const queue = [...roots];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    if (!world.artefacts.has(id)) throw new Error(`closure names unknown ${id}`);
    seen.add(id);
    for (const next of successors(world, id)) {
      if (!seen.has(next.id)) queue.push(next.id);
    }
  }
  return [...seen];
}

/** Rows the tenant owns directly. Derived rows are owned by the platform. */
export function tenantRows(world: World, t: TenantId): Artefact[] {
  return [...world.artefacts.values()].filter((a) => a.tenant === t);
}

const WINDOW = 44;

/** Every surviving artefact whose content mentions the label, with context. */
export function residue(world: World, label: string): Hit[] {
  const needle = label.toLowerCase();
  const hits: Hit[] = [];
  for (const artefact of world.artefacts.values()) {
    const at = artefact.content.toLowerCase().indexOf(needle);
    if (at === -1) continue;
    const start = Math.max(0, at - 12);
    const end = Math.min(artefact.content.length, at + needle.length + WINDOW);
    const snippet = `${start > 0 ? "…" : ""}${artefact.content.slice(start, end)}${
      end < artefact.content.length ? "…" : ""
    }`;
    hits.push({ id: artefact.id, kind: artefact.kind, snippet });
  }
  return hits;
}

/** A label is not stored in a tombstone; its hash is. */
export function hashOf(label: string): string {
  return createHash("sha256").update(label).digest("hex").slice(0, 12);
}

/** The tombstone's id, which is also a hash and cannot name the tenant. */
export function tombstoneId(label: string): string {
  return `tombstone-${hashOf(label)}`;
}

/**
 * The record that a tenant was deleted.
 *
 * It holds a hash and a count, never the label, because a record that names the
 * customer is the last copy of the data the deletion was meant to remove.
 */
export function tombstone(world: World, t: TenantId, removed: number): Artefact {
  const artefact: Artefact = {
    id: tombstoneId(t.label),
    kind: "tombstone",
    tenant: world.platform,
    content: `tombstone:${hashOf(t.label)}:${removed}`,
    derivedFrom: [],
  };
  put(world, artefact);
  return artefact;
}

export function isTombstone(artefact: Artefact): boolean {
  return artefact.kind === "tombstone";
}

export type { TenantId };

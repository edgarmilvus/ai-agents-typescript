// Chapter 17 — a tenant is a type before it is a table.
//
// A multi-tenant agent fails in one of two ways: a store that forgot the tenant,
// or a call that was allowed to name one. The first is a bug in a `find`; the
// second is a bug in a signature. This file deals with the second.
//
// The id is an object with a private symbol, not a string. That choice is the
// whole mechanism: a string equal to a tenant's name would pass a string-keyed
// registry, and the first draft of this file did exactly that until the demo
// asked it about a forged id and got "yes".

import type { Order } from "./desk17.ts";

const TENANT = Symbol("tenant-id");

/**
 * A tenant id. The symbol is not exported, so nothing outside this module can
 * build one; the label is for logs and cache keys, not for identity.
 */
export type TenantId = { readonly label: string; readonly [TENANT]: true };

/** Ids this process minted. Object identity, not string equality. */
const MINTED = new Set<TenantId>();

export interface Quota {
  /** Model calls allowed per window. */
  calls: number;
  /** Prompt tokens allowed per window. */
  tokens: number;
}

export interface Tenant {
  id: TenantId;
  name: string;
  orders: Order[];
  /** The region this tenant's desk prices against. */
  region: string;
  quota: Quota;
}

/** Mint a tenant. The only way to obtain a `TenantId`. */
export function tenant(label: string, name: string, orders: Order[], region: string, quota: Quota): Tenant {
  if ([...MINTED].some((id) => id.label === label)) throw new Error(`tenant ${label} already exists`);
  const id = { label, [TENANT]: true } as TenantId;
  MINTED.add(id);
  return { id, name, orders, region, quota };
}

/** True only for the exact object this process minted. */
export function isTenantId(value: unknown): value is TenantId {
  return typeof value === "object" && value !== null && MINTED.has(value as TenantId);
}

/** Forget every minted id. For demos and tests that build a world repeatedly. */
export function clearTenants(): void {
  MINTED.clear();
}

export interface Usage {
  calls: number;
  tokens: number;
}

export interface Meter {
  usage: Map<TenantId, Usage>;
  /** The window's limit per tenant, from the tenant's own quota. */
  limit: Map<TenantId, Quota>;
}

export function meter(tenants: Tenant[]): Meter {
  const usage = new Map<TenantId, Usage>();
  const limit = new Map<TenantId, Quota>();
  for (const t of tenants) {
    usage.set(t.id, { calls: 0, tokens: 0 });
    limit.set(t.id, t.quota);
  }
  return { usage, limit };
}

export interface Charge {
  ok: boolean;
  reason?: string;
}

/**
 * Charge one call to one tenant.
 *
 * A global meter would charge the first tenant that asked; the point of the
 * object key is that a busy customer cannot spend a quiet one's budget, and a
 * quiet one cannot be over-charged for somebody else's traffic.
 */
export function charge(m: Meter, id: TenantId, tokens: number): Charge {
  const used = m.usage.get(id);
  const limit = m.limit.get(id);
  if (!used || !limit) return { ok: false, reason: `no meter for ${typeof id === "object" ? id.label : String(id)}` };
  if (used.calls + 1 > limit.calls) return { ok: false, reason: `${id.label} is out of calls` };
  if (used.tokens + tokens > limit.tokens) return { ok: false, reason: `${id.label} is out of tokens` };
  used.calls += 1;
  used.tokens += tokens;
  return { ok: true };
}

export function used(m: Meter, id: TenantId): Usage {
  return m.usage.get(id) ?? { calls: 0, tokens: 0 };
}

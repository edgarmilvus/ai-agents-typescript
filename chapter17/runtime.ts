// Chapter 17 — two runtimes over the same agent code.
//
// The `global` runtime is what a service looks like when every store is a
// module-level singleton and the second customer arrived as a row. The `scoped`
// runtime is the same tools with each store closed over one tenant. The `owned`
// runtime adds the check that a closure cannot provide: that the subject of a
// call belongs to the caller.
//
// The three modes exist so the chapter can measure the difference instead of
// asserting it. Nothing in the agent's code changes between them.

import type { Tenant, TenantId } from "./tenant.ts";
import { charge, clearTenants, meter, tenant, used } from "./tenant.ts";
import type { Desk, Order } from "./desk17.ts";
import { POLICIES, makeDesk, toolsFor, toolsForGlobal } from "./desk17.ts";

export type Mode = "global" | "scoped" | "owned";

export interface Note {
  id: string;
  tenant: TenantId;
  text: string;
}

export interface Env {
  mode: Mode;
  tenants: Tenant[];
  acme: Tenant;
  globex: Tenant;
  initech: Tenant;
  desks: Map<TenantId, Desk>;
  notes: Note[];
  cache: Map<string, string>;
  meters: ReturnType<typeof meter>;
  audit: { tenant: TenantId; note: string }[];
  /** The global meter, used only in `global` mode. */
  shared: { calls: number; tokens: number };
}

const A: Order[] = [{ id: "A-1", total: 84, currency: "EUR", days: 5, region: "EU" }];
const G: Order[] = [
  { id: "G-1", total: 640, currency: "EUR", days: 21, region: "EU" },
  { id: "G-2", total: 100, currency: "EUR", days: 3, region: "EU" },
];
const I: Order[] = [{ id: "I-1", total: 1200, currency: "USD", days: 10, region: "US" }];

export function makeEnv(mode: Mode): Env {
  clearTenants();
  const acme = tenant("acme", "Acme Ltd", A, "EU", { calls: 8, tokens: 4000 });
  const globex = tenant("globex", "Globex", G, "EU", { calls: 8, tokens: 4000 });
  const initech = tenant("initech", "Initech", I, "US", { calls: 8, tokens: 4000 });
  const tenants = [acme, globex, initech];
  return {
    mode,
    tenants,
    acme,
    globex,
    initech,
    desks: new Map(tenants.map((t) => [t.id, makeDesk()])),
    notes: [
      { id: "n-a", tenant: acme.id, text: "Acme asked for the invoice to go to billing@acme.example" },
      { id: "n-g", tenant: globex.id, text: "Globex confirmed the refund address is 9 Kingsway" },
      { id: "n-i", tenant: initech.id, text: "Initech's US ceiling is 1000 USD under their contract" },
    ],
    cache: new Map(),
    meters: meter(tenants),
    audit: [],
    shared: { calls: 0, tokens: 0 },
  };
}

export function everyOrder(env: Env): Order[] {
  return env.tenants.flatMap((t) => t.orders);
}

/** Calls one tool on one tenant's desk, in the mode's build of the tools. */
export function call(env: Env, caller: Tenant, tool: string, args: Record<string, unknown>): string {
  const desk = env.desks.get(caller.id)!;
  const tools =
    env.mode === "global" ? toolsForGlobal(caller, desk, everyOrder(env)) : toolsFor(caller, desk);
  const found = tools.find((t) => t.name === tool);
  if (!found) throw new Error(`no tool ${tool}`);
  // The attempt is recorded before it runs, so a refusal leaves a row too.
  const row = { tenant: caller.id, note: `${tool}(${JSON.stringify(args)})` };
  env.audit.push(row);
  try {
    const value = found.run(args);
    if (typeof value !== "string") throw new Error(`${tool} did not answer with a string`);
    return value;
  } catch (error) {
    row.note += ` refused: ${(error as Error).message}`;
    throw error;
  }
}

/** The tenant's notes, or every note in the process. */
export function notesFor(env: Env, caller: Tenant, query: string): Note[] {
  const pool = env.mode === "global" ? env.notes : env.notes.filter((n) => n.tenant === caller.id);
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  return pool.filter((n) => words.some((w) => n.text.toLowerCase().includes(w)));
}

/** The policy row for a region, if this tenant is allowed to have one. */
export function policyFor(env: Env, caller: Tenant, region: string): { windowDays: number; maxAutoRefund: number } {
  if (env.mode !== "global" && caller.region !== region) {
    throw new Error(`${caller.id} has no contract for ${region}`);
  }
  const policy = POLICIES[region];
  if (!policy) throw new Error(`no policy for ${region}`);
  return policy;
}

/** A cached answer, keyed with or without the tenant. */
export function cached(env: Env, caller: Tenant, request: string): { hit: boolean; key: string } {
  const key = env.mode === "global" ? request : `${caller.id.label}|${request}`;
  const hit = env.cache.has(key);
  if (!hit) env.cache.set(key, "answer");
  return { hit, key };
}

/** Charge one call, to the caller or to the shared meter. */
export function spend(env: Env, caller: Tenant, tokens: number): { ok: boolean; reason?: string } {
  if (env.mode === "global") {
    if (env.shared.calls + 1 > 8) return { ok: false, reason: "shared meter is out of calls" };
    env.shared.calls += 1;
    env.shared.tokens += tokens;
    return { ok: true };
  }
  return charge(env.meters, caller.id, tokens);
}

export function usage(env: Env, who: Tenant): { calls: number; tokens: number } {
  if (env.mode === "global") return { ...env.shared };
  return used(env.meters, who.id);
}

/** Everything this tenant did, or everything anybody did. */
export function auditFor(env: Env, caller: Tenant): { tenant: TenantId; note: string }[] {
  return env.mode === "global" ? env.audit : env.audit.filter((row) => row.tenant === caller.id);
}

/** The check a closure cannot provide: does this subject belong to the caller? */
export function owns(env: Env, caller: Tenant, orderId: string): boolean {
  if (env.mode !== "owned") return true;
  return caller.orders.some((o) => o.id === orderId);
}

export type { Tenant, TenantId };

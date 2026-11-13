// Exercise 3, file 2 of 3 — the store, keyed by the tenant.
//
// The map is one object, and the isolation is in the key. A read takes a tenant
// and a subject, builds the key, and can only ever return what was written
// under that tenant — because the key it builds for another tenant is another
// string, and the map has nothing under it.

import { key, tenantOf } from "./ex3_keys.ts";

export interface Entry {
  value: string;
  tenant: string;
}

export class ScopedStore {
  private data = new Map<string, Entry>();

  put(tenant: string, subject: string, value: string): void {
    this.data.set(key(tenant, subject), { value, tenant });
  }

  get(tenant: string, subject: string): string | undefined {
    const entry = this.data.get(key(tenant, subject));
    return entry?.tenant === tenant ? entry.value : undefined;
  }

  /** Every key this tenant owns, without exposing anybody else's. */
  keysOf(tenant: string): string[] {
    return [...this.data.keys()].filter((k) => tenantOf(k) === tenant);
  }

  /** The whole map's size, for a test that wants to prove it is shared. */
  get size(): number {
    return this.data.size;
  }

  /** A deliberately unsafe read, for the exercise's contrast. */
  getUnsafe(joined: string): string | undefined {
    return this.data.get(joined)?.value;
  }
}

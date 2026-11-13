// Exercise 3, file 1 of 3 — the key, with no store.
//
// A key is a tenant and a subject, joined in a way that cannot collide. This
// file knows nothing about maps or agents; it turns two strings into one, and
// refuses to do it without a tenant.

export interface TenantKey {
  /** The tenant's label, which is not its identity. */
  tenant: string;
  /** What the key is about: an order id, a query, a region. */
  subject: string;
}

/** Join a tenant and a subject so that no pair collides with another. */
export function key(tenant: string, subject: string): string {
  if (tenant.trim() === "") throw new Error("a key needs a tenant");
  if (subject.trim() === "") throw new Error("a key needs a subject");
  // The separator cannot appear in either part, so the join is unambiguous.
  return `${tenant}\u0000${subject}`;
}

export function parse(joined: string): TenantKey {
  const [tenant, subject, ...rest] = joined.split("\u0000");
  if (tenant === undefined || subject === undefined || rest.length > 0) {
    throw new Error(`not a key: ${joined}`);
  }
  return { tenant, subject };
}

/** The tenant a key belongs to, without parsing the subject. */
export function tenantOf(joined: string): string {
  const cut = joined.indexOf("\u0000");
  if (cut === -1) throw new Error(`not a key: ${joined}`);
  return joined.slice(0, cut);
}

/** Two keys collide when they are the same string, and only then. */
export function collides(a: string, b: string): boolean {
  return a === b;
}

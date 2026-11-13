// Exercise 4 — return the decision, not the row.
//
// A real order record carries forty fields. A model needs four of them, and
// pays for every one on every later turn. Projection is the cheapest
// optimisation in an agent, and the only one that also improves attention.

export interface OrderRecord {
  id: string;
  total: number;
  currency: string;
  deliveredDaysAgo: number;
  region: string;
  customer: { id: string; email: string; name: string; address: string; phone: string };
  history: { at: string; event: string }[];
  audit: { by: string; at: string; note: string }[];
}

export const ORDER: OrderRecord = {
  id: "ORD-7712",
  total: 84,
  currency: "EUR",
  deliveredDaysAgo: 6,
  region: "EU",
  customer: { id: "cus_1041", email: "ada@example.com", name: "Ada Lovelace", address: "Hauptstr. 4, Berlin", phone: "+49 30 0000" },
  history: Array.from({ length: 18 }, (_, i) => ({ at: `2026-03-${String(i + 1).padStart(2, "0")}`, event: `event ${i}` })),
  audit: [{ by: "system", at: "2026-03-12", note: "imported" }],
};

/** The four fields the refund desk needs, and nothing else. */
export function project(order: OrderRecord, fields: (keyof OrderRecord)[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) out[field] = order[field];
  return out;
}

export function sizeOf(value: unknown): number {
  return JSON.stringify(value).length;
}

export function demo() {
  const narrow = project(ORDER, ["id", "total", "currency", "deliveredDaysAgo", "region"]);
  return {
    full: sizeOf(ORDER),
    narrow: sizeOf(narrow),
    fields: Object.keys(narrow),
  };
}

if (import.meta.main) {
  const r = demo();
  console.log("full record   :", r.full, "chars");
  console.log("projection    :", r.narrow, "chars");
  console.log("fields        :", r.fields.join(", "));
  console.log("saved         :", Math.round((1 - r.narrow / r.full) * 100) + "%");
}

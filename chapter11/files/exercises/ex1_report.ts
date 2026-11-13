// Exercise 1 — a report that can be refused.
//
// The seam has two documents and the report is the one that gets trusted. This
// exercise is the validation table: five reports, four of which must be refused
// for different reasons, and one that must pass. No child, no desk, no traffic.

export type Status = "ok" | "blocked";

export interface Report {
  status: Status;
  result: Record<string, unknown>;
  reason: string;
}

export type Rejection = "blocked" | "incomplete" | "extra" | "wrongType";

export interface Check {
  report: Report;
  schema: Record<string, "string" | "number">;
}

/**
 * Validate one report against a schema of field names and types.
 *
 * The order is the design: a blocked report is information and stops the check;
 * a missing field means the child did the work and did not say so; an extra
 * field means it answered a different question; a wrong type means the field is
 * there and unusable.
 */
export function check({ report, schema }: Check): { ok: true } | { ok: false; kind: Rejection; detail: string } {
  if (report.status === "blocked") return { ok: false, kind: "blocked", detail: report.reason };

  const absent = Object.keys(schema).filter((field) => report.result[field] === undefined);
  if (absent.length > 0) return { ok: false, kind: "incomplete", detail: `missing ${absent.join(", ")}` };

  const extra = Object.keys(report.result).filter((field) => schema[field] === undefined);
  if (extra.length > 0) return { ok: false, kind: "extra", detail: `unexpected ${extra.join(", ")}` };

  for (const [field, type] of Object.entries(schema)) {
    if (typeof report.result[field] !== type) {
      return { ok: false, kind: "wrongType", detail: `${field} should be ${type}` };
    }
  }
  return { ok: true };
}

export const SCHEMA: Record<string, "string" | "number"> = { verdict: "string", amount: "number" };

export const CASES: { id: string; note: string; report: Report }[] = [
  {
    id: "r1-good",
    note: "both fields, both the right type",
    report: { status: "ok", result: { verdict: "refund", amount: 84 }, reason: "done" },
  },
  {
    id: "r2-blocked",
    note: "the child could not do the job",
    report: { status: "blocked", result: {}, reason: "missing orderId" },
  },
  {
    id: "r3-incomplete",
    note: "the verdict arrived without the amount",
    report: { status: "ok", result: { verdict: "refund" }, reason: "done" },
  },
  {
    id: "r4-extra",
    note: "the right fields plus one nobody asked for",
    report: { status: "ok", result: { verdict: "refund", amount: 84, memo: "paid" }, reason: "done" },
  },
  {
    id: "r5-wrong-type",
    note: "the amount as a string, which will sort like a number and not add like one",
    report: { status: "ok", result: { verdict: "refund", amount: "84" }, reason: "done" },
  },
];

export function demo() {
  return CASES.map((c) => ({ ...c, verdict: check({ report: c.report, schema: SCHEMA }) }));
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# five reports, one schema\n");
  for (const row of rows) {
    const outcome = row.verdict.ok ? "accepted" : `${row.verdict.kind}: ${row.verdict.detail}`;
    console.log(`  ${row.id.padEnd(14)} ${outcome}`);
    console.log(`  ${" ".repeat(14)} ${row.note}`);
  }
  console.log("\n  the fifth row is the one a reviewer misses. A string that looks like a");
  console.log("  number passes every truthiness check and fails the first addition.");
}

if (import.meta.main) report(demo());

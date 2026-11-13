// Exercise 4 — a quota is a wall, not a bill.
//
// A quota exists to stop one tenant's traffic from becoming another's outage.
// This exercise runs the same traffic against one meter and against two, and
// prices the difference in calls the wrong customer paid for.

export interface Quota {
  calls: number;
  tokens: number;
}

export interface Usage {
  calls: number;
  tokens: number;
}

export interface Meter {
  usage: Map<string, Usage>;
  limit: Map<string, Quota>;
}

export function meter(tenants: { id: string; quota: Quota }[]): Meter {
  return {
    usage: new Map(tenants.map((t) => [t.id, { calls: 0, tokens: 0 }])),
    limit: new Map(tenants.map((t) => [t.id, t.quota])),
  };
}

export function charge(m: Meter, id: string, tokens: number): boolean {
  const used = m.usage.get(id);
  const limit = m.limit.get(id);
  if (!used || !limit) return false;
  if (used.calls + 1 > limit.calls || used.tokens + tokens > limit.tokens) return false;
  used.calls += 1;
  used.tokens += tokens;
  return true;
}

export function used(m: Meter, id: string): Usage {
  return m.usage.get(id) ?? { calls: 0, tokens: 0 };
}

export const TENANTS = [
  { id: "acme", quota: { calls: 4, tokens: 4000 } },
  { id: "globex", quota: { calls: 4, tokens: 4000 } },
];

export interface Row {
  policy: string;
  acme: { made: 6; allowed: number; refused: number };
  globex: { made: 2; allowed: number; refused: number };
}

export function run(shared: boolean): Row {
  const m = shared ? meter([{ id: "shared", quota: { calls: 4, tokens: 4000 } }]) : meter(TENANTS);
  const key = (id: string) => (shared ? "shared" : id);

  const make = (id: string, n: number) => {
    let allowed = 0;
    for (let i = 0; i < n; i += 1) if (charge(m, key(id), 100)) allowed += 1;
    return { made: n as 6 | 2, allowed, refused: n - allowed };
  };

  return { policy: shared ? "one shared meter" : "one meter per tenant", acme: make("acme", 6) as Row["acme"], globex: make("globex", 2) as Row["globex"] };
}

export function demo() {
  return [run(true), run(false)];
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# six calls from acme, two from globex, four each allowed\n");
  console.log("  policy                acme ok  acme refused  globex ok  globex refused");
  for (const row of rows) {
    console.log(
      `  ${row.policy.padEnd(20)} ${String(row.acme.allowed).padStart(7)} ${String(row.acme.refused).padStart(13)} ${String(row.globex.allowed).padStart(10)} ${String(row.globex.refused).padStart(14)}`,
    );
  }
  console.log("\n  the shared row is not a billing mistake; it is an outage. Acme spends the");
  console.log("  meter with its first four calls, and globex's two are refused by a limit");
  console.log("  globex never touched. The log says 'shared is out of calls' to a customer");
  console.log("  that made two.");
  console.log("");
  console.log("  the per-tenant row refuses two of acme's six and none of globex's, which");
  console.log("  is what a wall is for: it stops the tenant that is over, and it names it.");
}

if (import.meta.main) report(demo());

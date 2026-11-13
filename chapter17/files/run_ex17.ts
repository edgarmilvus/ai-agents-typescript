// Chapter 17 harness.
//
//   node chapter17/files/run_ex17.ts
//
// Offline: the tenants are objects, the stores are arrays and maps, and the
// eight probes run in a millisecond.

import { charge, clearTenants, isTenantId, meter, tenant, used } from "../tenant.ts";
import { POLICIES, check, makeDesk, toolsFor, toolsForGlobal } from "../desk17.ts";
import { measure, probeIds, summarise } from "../probes.ts";
import { makeEnv, policyFor } from "../runtime.ts";

let checks = 0;
let failures = 0;

function check_(name: string, ok: boolean, detail?: unknown): void {
  checks += 1;
  if (ok) console.log(`PASS ${name}`);
  else {
    failures += 1;
    console.log(`FAIL ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

function equal(name: string, actual: unknown, expected: unknown): void {
  check_(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });
}

// 1 — the id
{
  clearTenants();
  const a = tenant("acme", "Acme", [], "EU", { calls: 4, tokens: 100 });
  const b = tenant("globex", "Globex", [], "EU", { calls: 4, tokens: 100 });
  check_("a minted id is an id", isTenantId(a.id));
  check_("the label is readable", a.id.label === "acme");
  equal("a string is not an id", isTenantId("acme"), false);
  equal("a copy is not an id", isTenantId({ ...a.id }), false);
  equal("another tenant's id is another id", a.id === b.id, false);
  check_("the same label cannot be minted twice", (() => {
    try {
      tenant("acme", "Again", [], "EU", { calls: 1, tokens: 1 });
      return false;
    } catch {
      return true;
    }
  })());

  const m = meter([a, b]);
  equal("a call is charged to its tenant", [charge(m, a.id, 10).ok, used(m, a.id).calls, used(m, b.id).calls], [true, 1, 0]);
  equal("another tenant's meter is untouched", used(m, b.id).tokens, 0);

  clearTenants();
  equal("clearing the registry forgets every id", isTenantId(a.id), false);
}

// 2 — the tools
{
  const env = makeEnv("scoped");
  const desk = makeDesk();
  const lookup = toolsFor(env.acme, desk).find((t) => t.name === "lookup_order")!;
  check_("a scoped lookup finds its own order", String(lookup.run({ orderId: "A-1" })).includes("A-1"));
  equal(
    "and throws on another tenant's",
    (() => {
      try {
        lookup.run({ orderId: "G-1" });
        return "answered";
      } catch {
        return "threw";
      }
    })(),
    "threw",
  );

  const globalDesk = makeDesk();
  const globalLookup = toolsForGlobal(env.acme, globalDesk, env.tenants.flatMap((t) => t.orders)).find(
    (t) => t.name === "lookup_order",
  )!;
  check_("a global lookup answers with globex's order", String(globalLookup.run({ orderId: "G-1" })).includes("G-1"));

  equal("the check refuses an order the tenant does not own", check(env.acme, makeDesk(), "G-1").pass, false);
  check_("and passes its own", check(env.acme, (() => {
    const d = makeDesk();
    d.refunds.push({ refundId: "rf_a1", orderId: "A-1", amount: 84, currency: "EUR" });
    return d;
  })(), "A-1").pass);
}

// 3 — the probes
{
  equal("eight probes", measure("global").length, 8);
  equal("probe ids are stable", probeIds().length, 8);
  const global = summarise("global");
  const scoped = summarise("scoped");
  const owned = summarise("owned");
  equal("the global build leaks everything", [global.leaked, global.refused], [8, 0]);
  equal("the scoped build leaks once", [scoped.leaked, scoped.refused], [1, 7]);
  equal("the owned build leaks nowhere", [owned.leaked, owned.refused], [0, 8]);
  equal("the surviving leak is the escalation", scoped.rows.filter((r) => r.leaked).map((r) => r.probe), ["p8-escalate"]);
  check_("every probe names its store", measure("owned").every((r) => r.store.length > 3));
  check_("every refusal has a reason", scoped.rows.filter((r) => !r.leaked).every((r) => r.detail.length > 5));
}

// 4 — policies and the desk
{
  equal("two regions", Object.keys(POLICIES).sort(), ["EU", "US"]);
  check_("the EU ceiling is the one the desk uses", POLICIES.EU.maxAutoRefund === 500);
  const env = makeEnv("global");
  check_("a policy row from another contract is reachable in the global build", (() => {
    try {
      return policyFor(env, env.acme, "US").maxAutoRefund === 1000;
    } catch {
      return false;
    }
  })());
  const scoped = makeEnv("scoped");
  check_("and refused in the scoped build", (() => {
    try {
      policyFor(scoped, scoped.acme, "US");
      return false;
    } catch {
      return true;
    }
  })());
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);

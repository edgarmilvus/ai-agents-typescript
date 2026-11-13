// 17.6 — the record, read by the wrong tenant.
//
// The audit is the last store and the one teams forget, because it is written
// for compliance rather than for the agent. A shared list of every run is a
// cross-tenant read waiting for a support tool, and it is the store where the
// leak is a person seeing another customer's name.

import { auditFor, call, makeEnv } from "../runtime.ts";

for (const mode of ["global", "scoped"] as const) {
  const env = makeEnv(mode);
  call(env, env.globex, "lookup_order", { orderId: "G-1" });
  call(env, env.acme, "lookup_order", { orderId: "A-1" });

  const mine = auditFor(env, env.acme);
  const foreign = mine.filter((row) => row.tenant !== env.acme.id);
  console.log(`# ${mode}\n`);
  console.log(`  acme's audit view: ${mine.length} row(s), ${foreign.length} foreign`);
  for (const row of mine) {
    console.log(`    ${row.tenant === env.acme.id ? "acme  " : "GLOBEX"}  ${row.note}`);
  }
  console.log("");
}

console.log("  the scoped view is the same list filtered by an id comparison, and the");
console.log("  comparison is object identity, so a tenant cannot be spelled into it.");
console.log("");
console.log("  the audit is also the store that makes the other seven provable: a refused");
console.log("  probe leaves a row with the caller's id and the error, which is how a");
console.log("  reviewer answers 'did anyone try' without reading a transcript.");

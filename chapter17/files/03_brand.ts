// 17.3 — an id you cannot type by accident.
//
// A tenant id is the key to every store in this chapter, so it has to be
// impossible to produce from text. The first draft of this file keyed a Set by
// the tenant's *name*, and the demo asked it about the string "acme" and got
// "yes" — the registry had been forgeable by anybody who could spell.
//
// The fix is that an id is an object with a private symbol. A string is not an
// id, a copy of an id is not an id, and the label is a separate field that
// exists for logs and cache keys.

import { charge, clearTenants, isTenantId, meter, tenant } from "../tenant.ts";
import type { TenantId } from "../tenant.ts";

clearTenants();
const acme = tenant("acme", "Acme Ltd", [], "EU", { calls: 8, tokens: 4000 });
const m = meter([acme]);

console.log("# an id that was minted\n");
console.log(`  tenant("acme") → ${acme.id.label} (an object), isTenantId: ${isTenantId(acme.id)}`);

console.log("\n# a string that spells the same thing\n");
console.log(`  isTenantId("acme") → ${isTenantId("acme")}`);
console.log("  the registry holds objects, so the name is not a key");

console.log("\n# a copy of the id\n");
const clone = { ...acme.id };
console.log(`  isTenantId({ ...id }) → ${isTenantId(clone)}`);
console.log("  object identity is not structural equality, and that is the point");

console.log("\n# an id from before a restart\n");
clearTenants();
console.log(`  isTenantId(id) after clearTenants → ${isTenantId(acme.id)}`);
console.log("  a config file full of names gives a process strings, not tenants");

console.log("\n# the store answers for itself\n");
const forged = "acme" as unknown as TenantId;
const result = charge(m, forged, 100);
console.log(`  charge with a forged id → ok=${result.ok}, ${result.reason ?? "charged"}`);
console.log("");
console.log("  // @ts-expect-error a bare string is not a TenantId");
console.log('  // charge(m, "acme", 100);');
console.log("\n  two halves: the type stops the call from being written, the registry stops");
console.log("  it from being acted on. A runtime without the compiler needs the second.");

console.log("\n# and the label is not the id\n");
console.log(`  \`\${acme.id}\` → ${String(acme.id)}`);
console.log("  interpolating the object gives the same string for every tenant, which is");
console.log("  how a cache key collides while looking correct. Use id.label for keys.");

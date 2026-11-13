// 17.5 — one tenant's runaway is not another's bill.
//
// A quota is the store where a leak costs money instead of trust. On a shared
// meter the busiest customer spends the quiet one's budget, and the quiet one
// finds out when its own traffic starts failing. On a per-tenant meter the two
// budgets are separate objects keyed by separate ids.

import { makeEnv } from "../runtime.ts";
import { spend, usage } from "../runtime.ts";

for (const mode of ["global", "scoped"] as const) {
  const env = makeEnv(mode);
  let refused = 0;
  for (let i = 0; i < 8; i += 1) {
    if (!spend(env, env.acme, 100).ok) refused += 1;
  }
  const acme = usage(env, env.acme);
  const globex = usage(env, env.globex);
  console.log(`# ${mode}\n`);
  console.log(`  acme made 8 calls, ${refused} refused by the meter`);
  console.log(`  acme's usage   : ${acme.calls} calls, ${acme.tokens} tokens`);
  console.log(`  globex's usage : ${globex.calls} calls, ${globex.tokens} tokens`);
  console.log(`  globex's budget: ${globex.calls === 0 ? "untouched" : "already spent"}\n`);
}

const env = makeEnv("scoped");
for (let i = 0; i < 8; i += 1) spend(env, env.acme, 100);
const ninth = spend(env, env.acme, 100);
const globexStill = spend(env, env.globex, 100);
console.log("# the wall, not the bill\n");
console.log(`  acme's ninth call : ${ninth.ok ? "allowed" : ninth.reason}`);
console.log(`  globex's first    : ${globexStill.ok ? "allowed" : globexStill.reason}`);
console.log("\n  on a shared meter the ninth call is globex's eighth, and the two failures");
console.log("  are indistinguishable in the log. A per-tenant meter makes the wall");
console.log("  countable: eight for each, and the customer who hit it is named.");

// 17.4 — the cache key that forgot the customer.
//
// A cache is the cheapest store to get wrong, because the wrong key does not
// throw: it returns an answer. The demo primes a cache as one tenant and reads
// it as another, then shows the two key spellings and the one that looks right
// and is not.

import { cached, makeEnv } from "../runtime.ts";

console.log("# one key, two customers\n");

const shared = makeEnv("global");
cached(shared, shared.globex, "what is the refund window");
const second = cached(shared, shared.acme, "what is the refund window");
console.log(`  global key       : "${second.key}"`);
console.log(`  acme's lookup    : ${second.hit ? "HIT — an answer globex paid for" : "miss"}`);

const scoped = makeEnv("scoped");
cached(scoped, scoped.globex, "what is the refund window");
const own = cached(scoped, scoped.acme, "what is the refund window");
console.log(`\n  scoped key       : "${own.key}"`);
console.log(`  acme's lookup    : ${own.hit ? "hit" : "miss — cold for acme"}`);

console.log("\n# the key that looks right\n");
const wrong = `${shared.globex.id}|what is the refund window`;
const alsoWrong = `${shared.acme.id}|what is the refund window`;
console.log(`  globex : "${wrong}"`);
console.log(`  acme   : "${alsoWrong}"`);
console.log(`  equal? ${wrong === alsoWrong}`);
console.log("\n  ${id} on a tenant object is \"[object Object]\", so both keys are the same");
console.log("  string and the cache is global while looking scoped. The key needs the");
console.log("  label, and the label is the field the chapter keeps saying is not the id.");

console.log("\n# and the hit rate is what a cache is for\n");
console.log(`  a shared key would have saved ${second.hit ? "a call" : "nothing"} for acme, by`);
console.log("  charging it to a customer who is not acme. That is not a saving; it is a");
console.log("  transfer, and the ledger in chapter 15 would record it as one.");

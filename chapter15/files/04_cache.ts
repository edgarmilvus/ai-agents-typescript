// 15.4 — the traffic window, cached.
//
// Chapter 10's window has 240 requests, 21 of which are a customer asking
// again about an order that was already handled. That is the cache's natural
// customer, and the demo prices what a hit saves — and what a cache with no
// clock serves after the answer has stopped being true.

import { stream } from "../../chapter10/traffic.ts";
import { keyOf, lookup, put, rate, serve } from "../cache.ts";
import { createCache } from "../cache.ts";
import { loopCost } from "../price.ts";
import { MODELS, micro } from "../price.ts";

const requests = stream();

/** Every request is the same task on a different order: one refund run. */
const RUN = loopCost(MODELS.cheap, 4).usd;

console.log(`# the window\n`);
console.log(`  ${requests.length} requests, ${requests.filter((r) => r.duplicateOf).length} of them a customer asking twice`);
console.log(`  one answered request costs ${micro(RUN)} µ$ at four turns\n`);

let clock = 0;
const cache = createCache();
const cold = serve(
  cache,
  requests.map((r) => ({ request: "refund this order", orderId: r.orderId })),
  () => RUN,
  () => (clock += 1),
  0,
);

console.log(`# warm cache, no expiry\n`);
console.log(`  answered ${cold.answered}, served from cache ${cold.served}`);
console.log(`  hit rate ${(rate(cache, requests.length).rate * 100).toFixed(1)}%`);
console.log(`  spent ${micro(cold.usd)} µ$ instead of ${micro(requests.length * RUN)} µ$`);
console.log(`  saved ${(100 - (cold.usd / (requests.length * RUN)) * 100).toFixed(1)}%`);

console.log(`\n# the hit rate is the duplicate rate\n`);
console.log("  8.8% of the window is a repeat, so a perfect cache saves 8.8% of the");
console.log("  bill. A cache only pays for itself when the repeats are frequent; a desk");
console.log("  where every request is new is a desk with no cache hit and a store full of");
console.log("  answers nobody will ask for again.");

console.log(`\n# a cache with no clock, after the policy changes\n`);
{
  const c = createCache();
  const key = keyOf("refund this order", "ORD-7712");
  put(c, key, "refunded 84 EUR", 1);
  const later = lookup(c, key, 10_000, 0);
  const bounded = (() => {
    const fresh = createCache();
    put(fresh, key, "refunded 84 EUR", 1);
    return lookup(fresh, key, 10_000, 600);
  })();
  console.log(`  ttl 0     : ${later ? "hit — serving an answer from tick 1 at tick 10000" : "miss"}`);
  console.log(`  ttl 600   : ${bounded ? "hit" : "miss — the answer expired, the question is asked again"}`);
  console.log("\n  the same key, the same stored answer, two policies. The first is an archive");
  console.log("  that never forgets; the second is a cache. An archive that answers");
  console.log("  questions is how a policy change takes a week to reach the customer.");
}

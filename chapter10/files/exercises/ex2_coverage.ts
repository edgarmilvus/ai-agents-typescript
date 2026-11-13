// Exercise 2 — what the corpus cannot see, and how long it takes to see it.
//
// The coverage table is the cheap half. The question worth answering is how
// much traffic a bucket needs before its absence from the corpus stops being
// an accident: at a three percent share, ninety requests are enough to expect
// one, and a canary that promotes at request 77 has not seen the bucket at all.

import { CORPUS, absolute, blindSpots, coverage } from "../../drift.ts";
import { INCUMBENT } from "../../releases.ts";
import { stream } from "../../traffic.ts";

/** Requests needed to see at least one event at `p`, with `confidence`. */
export function requestsFor(p: number, confidence = 0.95): number {
  return Math.ceil(Math.log(1 - confidence) / Math.log(1 - p));
}

export function demo() {
  const requests = stream();
  const rows = coverage(requests);
  const unseen = rows.filter((r) => !r.seen);
  const abs = absolute(requests, INCUMBENT);
  const spots = blindSpots(requests, INCUMBENT);

  const apac = requests.filter((r) => r.region === "APAC");
  const firstApac = apac[0]?.at ?? -1;
  const apacShare = apac.length / requests.length;

  return {
    requests: requests.length,
    corpus: CORPUS.length,
    unseen,
    abs,
    spots,
    firstApac: firstApac + 1,
    apacShare,
    needed: requestsFor(apacShare),
    inFirst77: requests.slice(0, 77).filter((r) => r.region === "APAC").length,
  };
}

export function report(d: ReturnType<typeof demo>): void {
  console.log("# the corpus and the traffic\n");
  console.log(`  ${d.corpus} orders in the corpus, ${d.requests} requests in the window\n`);
  console.log("  unseen bucket   traffic  share");
  for (const row of d.unseen) {
    console.log(`  ${`${row.feature}:${row.bucket}`.padEnd(15)} ${String(row.traffic).padStart(7)}  ${(row.share * 100).toFixed(1).padStart(5)}%`);
  }

  console.log("\n# how much traffic it takes\n");
  console.log(`  the APAC bucket is ${(d.apacShare * 100).toFixed(1)}% of the window`);
  console.log(`  first APAC request          : r${String(d.firstApac).padStart(3, "0")}`);
  console.log(`  requests to expect one at 95%: ${d.needed}`);
  console.log(`  APAC requests seen by request 77 (where the canary promotes): ${d.inFirst77}`);

  console.log("\n# what it costs\n");
  console.log(`  the incumbent fails ${d.abs.failures} of ${d.abs.requests} requests (${(d.abs.rate * 100).toFixed(1)}%)`);
  for (const spot of d.spots) {
    console.log(`  every one of them is ${spot.feature}:${spot.bucket}, which no case covers`);
  }
  console.log("\n  a canary promoting at 77 requests has seen at most one of these crashes.");
  console.log("  the coverage table is not a report about the suite being thin; it is a");
  console.log("  statement about how much traffic a release has to see before agreement");
  console.log("  means anything in a bucket the corpus never visited.");
}

if (import.meta.main) report(demo());

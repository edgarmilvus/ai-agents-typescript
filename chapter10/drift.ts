// Chapter 10 — the failures both releases share.
//
// A canary compares a candidate with its predecessor. That makes it excellent
// at regressions and structurally blind to anything the predecessor already
// does wrong: two releases that both crash on the same request agree, and
// agreement is what a canary promotes.
//
// The second instrument is the corpus. Every bucket of traffic the suite has
// never seen is a place where agreement means nothing, and a bucket where both
// releases fail is an incident waiting for a rollout to make it visible.

import type { Request } from "./traffic.ts";
import { bucket } from "./traffic.ts";
import type { Order, Release } from "./releases.ts";
import { makeWorld, run } from "./releases.ts";
import { ORDERS } from "../chapter9/desk9.ts";

/** The four orders the suite has ever seen, mapped to the traffic's shape. */
export const CORPUS: Order[] = ORDERS.map((o) => ({
  id: o.id,
  total: o.total,
  currency: o.currency,
  days: o.deliveredDaysAgo,
  region: o.region,
}));

export type Feature = "region" | "size";

export interface Coverage {
  feature: Feature;
  bucket: string;
  /** How many of the corpus's orders fall in this bucket. */
  corpus: number;
  /** How many traffic requests fall in it. */
  traffic: number;
  /** Share of traffic, as a fraction. */
  share: number;
  seen: boolean;
}

function bucketOf(request: Request, feature: Feature): string {
  return feature === "region" ? request.region : bucket(request.total);
}

/** Region and size coverage, side by side, which is enough to see a blind spot. */
export function coverage(requests: Request[], corpus: Order[] = CORPUS): Coverage[] {
  const rows: Coverage[] = [];
  for (const feature of ["region", "size"] as Feature[]) {
    const values = new Set<string>();
    for (const r of requests) values.add(bucketOf(r, feature));
    for (const order of corpus) {
      values.add(feature === "region" ? order.region : bucket(order.total));
    }
    for (const value of [...values].sort()) {
      const inTraffic = requests.filter((r) => bucketOf(r, feature) === value).length;
      const inCorpus = corpus.filter((o) => (feature === "region" ? o.region : bucket(o.total)) === value).length;
      rows.push({
        feature,
        bucket: value,
        corpus: inCorpus,
        traffic: inTraffic,
        share: inTraffic / requests.length,
        seen: inCorpus > 0,
      });
    }
  }
  return rows;
}

export interface Absolute {
  requests: number;
  failures: number;
  rate: number;
  /** The buckets where both the incumbent and the candidate fail. */
  byBucket: { feature: Feature; bucket: string; failures: number; seen: boolean }[];
}

/**
 * Run one release over the stream and count what fails.
 *
 * "Fails" includes a crash: an unhandled exception in a check is not a worse
 * kind of failure than a red verdict, it is the same incident with a louder
 * stack trace.
 */
export function absolute(requests: Request[], release: Release): Absolute {
  const world = makeWorld();
  const failed: Request[] = [];
  for (const request of requests) {
    const result = run(release, world, request);
    if (!result.pass || result.crashed) failed.push(request);
  }

  const byBucket: Absolute["byBucket"] = [];
  for (const feature of ["region", "size"] as Feature[]) {
    const values = new Set(failed.map((r) => bucketOf(r, feature)));
    for (const value of [...values].sort()) {
      const count = failed.filter((r) => bucketOf(r, feature) === value).length;
      const inCorpus =
        feature === "region"
          ? CORPUS.some((o) => o.region === value)
          : CORPUS.some((o) => bucket(o.total) === value);
      byBucket.push({ feature, bucket: value, failures: count, seen: inCorpus });
    }
  }

  return {
    requests: requests.length,
    failures: failed.length,
    rate: failed.length / requests.length,
    byBucket,
  };
}

/**
 * The failing buckets the corpus never covered, by region.
 *
 * Size is left out on purpose: an APAC request also lands in a size bucket, so
 * counting both would report the same eight failures twice. A blind spot is a
 * place, and the place is the region.
 */
export function blindSpots(requests: Request[], release: Release): Absolute["byBucket"] {
  return absolute(requests, release)
    .byBucket.filter((b) => b.feature === "region" && !b.seen)
    .map((b) => ({ ...b, failures: b.failures }));
}

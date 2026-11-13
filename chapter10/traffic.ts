// Chapter 10 — a traffic model, because a book cannot ship production requests.
//
// The stream is generated from a fixed seed and a stated distribution: 70% EU,
// 25% US, 5% APAC; four size buckets; a twelfth of the requests are customers
// asking a second time. That last one is the point: a stream is not a set of
// independent requests, and a release that is correct per request can still be
// wrong per customer.
//
// What the stream is *not* is a recording of a model. The decisions in it come
// from `driver`, a documented stand-in that follows the incumbent policy, and
// every number in the chapter is a fact about the releases compared, never
// about the model's judgement.

export type Region = "EU" | "US" | "APAC";

export interface Request {
  id: string;
  /** Position in the stream, from zero. */
  at: number;
  orderId: string;
  total: number;
  currency: string;
  days: number;
  region: Region;
  /** Set when this request is the customer asking again about the same order. */
  duplicateOf?: string;
}

export interface Call {
  name: string;
  args: Record<string, unknown>;
}

/** xorshift32: small, seeded, and the same in every runtime. */
export function rng(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 4294967296;
  };
}

const CURRENCY: Record<Region, string> = { EU: "EUR", US: "USD", APAC: "AUD" };

/** The policy the incumbent is running, duplicated here so traffic can be built without the desk. */
const WINDOW: Record<Region, number> = { EU: 14, US: 30, APAC: 0 };
const CEILING: Record<Region, number> = { EU: 500, US: 1000, APAC: 0 };

function pickRegion(r: number): Region {
  if (r < 0.7) return "EU";
  if (r < 0.95) return "US";
  return "APAC";
}

/** Bucket from one draw, amount from a second, so size and value are independent. */
function pickTotal(r: number, u: number): number {
  if (r < 0.4) return Math.round((20 + u * 100) * 100) / 100;
  if (r < 0.75) return Math.round((120 + u * 380) * 100) / 100;
  if (r < 0.95) return Math.round((500 + u * 1000) * 100) / 100;
  return Math.round((1500 + u * 2500) * 100) / 100;
}

function isRefundable(r: Request): boolean {
  return r.region !== "APAC" && r.days <= WINDOW[r.region] && r.total <= CEILING[r.region];
}

/**
 * A stream of `n` requests, deterministic in `seed`.
 *
 * Duplicates are drawn from the requests already seen that the *incumbent*
 * would refund: a customer asking again about an order that was paid out. That
 * is the case an idempotency change breaks, and it does not exist until the
 * stream has a history.
 */
export function stream(seed = 20261030, n = 240): Request[] {
  const next = rng(seed);
  const out: Request[] = [];

  for (let i = 0; i < n; i += 1) {
    const region = pickRegion(next());
    const days = Math.floor(next() * 41);
    let total = pickTotal(next(), next());
    if (next() < 0.15) total = Math.round(total) + 0.5;

    // A customer asking again: reuse an order that the incumbent already paid.
    const paid = out.filter((r) => !r.duplicateOf && isRefundable(r));
    const repeat = i > 20 && paid.length > 0 && next() < 0.12 ? paid[Math.floor(next() * paid.length)] : undefined;

    out.push({
      id: `r${String(i + 1).padStart(3, "0")}`,
      at: i,
      orderId: repeat ? repeat.orderId : `TRD-${String(1000 + i)}`,
      total: repeat ? repeat.total : total,
      currency: repeat ? repeat.currency : CURRENCY[region],
      days: repeat ? repeat.days : days,
      region: repeat ? repeat.region : region,
      duplicateOf: repeat?.id,
    });
  }
  return out;
}

/**
 * The decisions, recorded once, under the incumbent policy.
 *
 * This is the traffic fixture's weakest joint and it is labelled rather than
 * hidden: a real canary replays what the model actually did, and the book
 * cannot ship a 240-request live recording. What matters for the chapter is
 * that the decisions are fixed before any candidate exists.
 */
export function driver(request: Request): Call[] {
  const lookup: Call = { name: "lookup_order", args: { orderId: request.orderId } };
  const policy = request.region === "APAC" ? undefined : request.region;

  if (!policy) {
    return [lookup, { name: "escalate", args: { orderId: request.orderId, reason: "no policy for this region" } }];
  }
  if (request.days > WINDOW[request.region]) {
    return [
      lookup,
      { name: "escalate", args: { orderId: request.orderId, reason: `delivered ${request.days} days ago` } },
    ];
  }
  if (request.total > CEILING[request.region]) {
    return [
      lookup,
      { name: "escalate", args: { orderId: request.orderId, reason: `total ${request.total} exceeds the ceiling` } },
    ];
  }
  return [
    lookup,
    { name: "refund_policy", args: { region: request.region } },
    { name: "issue_refund", args: { orderId: request.orderId, amount: request.total, reason: "customer asked" } },
  ];
}

export type SizeBucket = "small" | "medium" | "large" | "huge";

export function bucket(total: number): SizeBucket {
  if (total < 120) return "small";
  if (total < 500) return "medium";
  if (total < 1500) return "large";
  return "huge";
}

export interface Shape {
  requests: number;
  regions: Record<Region, number>;
  sizes: Record<SizeBucket, number>;
  duplicates: number;
  apac: number;
}

/** The stream's shape, as counts rather than percentages, so a reader can divide. */
export function shape(requests: Request[]): Shape {
  const regions: Record<Region, number> = { EU: 0, US: 0, APAC: 0 };
  const sizes: Record<SizeBucket, number> = { small: 0, medium: 0, large: 0, huge: 0 };
  let duplicates = 0;
  for (const r of requests) {
    regions[r.region] += 1;
    sizes[bucket(r.total)] += 1;
    if (r.duplicateOf) duplicates += 1;
  }
  return { requests: requests.length, regions, sizes, duplicates, apac: regions.APAC };
}

/** A stream of `n` requests with no duplicates: the easy case, for comparison. */
export function independent(seed = 20261030, n = 240): Request[] {
  return stream(seed, n).map((r) => ({ ...r, duplicateOf: undefined }));
}

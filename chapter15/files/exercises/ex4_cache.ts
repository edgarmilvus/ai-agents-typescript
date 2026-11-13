// Exercise 4 — a cache with a clock.
//
// The key decides what the cache can answer, and the clock decides how long an
// answer stays true. Both are small functions and both are where the bugs are:
// a key that is too coarse answers a different question, and a clock that never
// expires answers yesterday's.

export interface Entry {
  value: string;
  storedAt: number;
}

export interface Cache {
  entries: Map<string, Entry>;
  hits: number;
  misses: number;
}

export function create(): Cache {
  return { entries: new Map(), hits: 0, misses: 0 };
}

/** The request, normalised, plus the subject it is about. */
export function key(request: string, subject: string): string {
  const text = request.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean).join(" ");
  return `${subject}|${text}`;
}

export function get(cache: Cache, k: string, now: number, ttl: number): Entry | undefined {
  const entry = cache.entries.get(k);
  const fresh = entry !== undefined && (ttl === 0 || now - entry.storedAt <= ttl);
  if (!fresh) {
    cache.misses += 1;
    return undefined;
  }
  cache.hits += 1;
  return entry;
}

export function set(cache: Cache, k: string, value: string, now: number): Entry {
  const entry = { value, storedAt: now };
  cache.entries.set(k, entry);
  return entry;
}

export interface Traffic {
  request: string;
  subject: string;
}

/** Answer or serve, and report both the hit rate and the money saved. */
export function run(traffic: Traffic[], ttl: number, costPerAnswer = 1): { hits: number; answered: number; saved: number } {
  const cache = create();
  let clock = 0;
  let hits = 0;
  let answered = 0;
  for (const item of traffic) {
    clock += 1;
    if (get(cache, key(item.request, item.subject), clock, ttl)) {
      hits += 1;
      continue;
    }
    answered += 1;
    set(cache, key(item.request, item.subject), "answer", clock);
  }
  return { hits, answered, saved: hits * costPerAnswer };
}

export const TRAFFIC: Traffic[] = [
  { request: "refund this order", subject: "ORD-1" },
  { request: "refund this order", subject: "ORD-2" },
  { request: "refund this order", subject: "ORD-1" },
  { request: "where is my parcel", subject: "ORD-3" },
  { request: "refund this order", subject: "ORD-2" },
  { request: "where is my parcel", subject: "ORD-3" },
];

export function demo() {
  return [
    { ttl: 0, label: "no expiry", ...run(TRAFFIC, 0) },
    { ttl: 2, label: "ttl 2 ticks", ...run(TRAFFIC, 2) },
  ];
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# six requests, two clocks\n");
  for (const row of rows) {
    console.log(`  ${row.label.padEnd(12)} hits ${row.hits}, answered ${row.answered}, saved ${row.saved}`);
  }
  console.log("\n  the short ttl misses the third request because the first, identical one was");
  console.log("  three ticks old: the same key, expired. The cache with no clock gets the");
  console.log("  hit and would serve it after the policy changed, which is the trade the");
  console.log("  next section is about.");
}

if (import.meta.main) report(demo());

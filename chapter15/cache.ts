// Chapter 15 — a cache is a memory with a clock and a key.
//
// The key is the whole design. Too coarse and the cache returns an answer to a
// question nobody asked; too fine and it never hits. This chapter's traffic has
// a natural key — the request text and the order — and a natural hard case, the
// customer who asks the same thing twice.
//
// The clock matters for the same reason it mattered in chapter 14: an answer
// stored before the policy changed is not an answer to the question being asked
// now.

export interface Entry {
  key: string;
  value: string;
  createdAt: number;
  hits: number;
}

export interface Cache {
  entries: Map<string, Entry>;
  /** Lookups that found nothing. */
  misses: number;
  /** Lookups that found something. */
  hits: number;
}

export function createCache(): Cache {
  return { entries: new Map(), misses: 0, hits: 0 };
}

/**
 * The key.
 *
 * The request text alone would collide across orders; the order alone would
 * collide across questions. Both, normalised, is the smallest key that does not
 * answer a different question.
 */
export function keyOf(request: string, orderId: string): string {
  const text = request.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean).join(" ");
  return `${orderId}|${text}`;
}

export function lookup(cache: Cache, key: string, now: number, ttl: number): Entry | undefined {
  const entry = cache.entries.get(key);
  const fresh = entry !== undefined && (ttl === 0 || now - entry.createdAt <= ttl);
  if (!fresh) {
    cache.misses += 1;
    return undefined;
  }
  entry.hits += 1;
  cache.hits += 1;
  return entry;
}

export function put(cache: Cache, key: string, value: string, now: number): Entry {
  const entry: Entry = { key, value, createdAt: now, hits: 0 };
  cache.entries.set(key, entry);
  return entry;
}

export interface HitRate {
  requests: number;
  hits: number;
  misses: number;
  rate: number;
}

export function rate(cache: Cache, requests: number): HitRate {
  return {
    requests,
    hits: cache.hits,
    misses: cache.misses,
    rate: requests === 0 ? 0 : cache.hits / requests,
  };
}

/**
 * A run of the traffic window: answer, or serve what was stored.
 *
 * `ttl` of zero means forever, which is the configuration that turns a cache
 * into a source of stale answers. The demo uses it to show the failure rather
 * than to recommend it.
 */
export function serve(
  cache: Cache,
  requests: { request: string; orderId: string }[],
  answer: () => number,
  now: () => number,
  ttl: number,
): { answered: number; served: number; usd: number } {
  let answered = 0;
  let served = 0;
  let usd = 0;
  for (const req of requests) {
    const key = keyOf(req.request, req.orderId);
    const hit = lookup(cache, key, now(), ttl);
    if (hit) {
      served += 1;
      continue;
    }
    usd += answer();
    answered += 1;
    put(cache, key, "answer", now());
  }
  return { answered, served, usd };
}

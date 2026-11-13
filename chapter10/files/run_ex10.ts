// Chapter 10 harness.
//
//   node chapter10/files/run_ex10.ts
//
// Everything here is deterministic: the stream is seeded, the rules are
// arithmetic, and no model is called. The assertions are about the instruments,
// not about the traffic looking nice.

import { driver, independent, rng, shape, stream } from "../traffic.ts";
import {
  CANDIDATES,
  COSMETIC,
  IDEMPOTENT,
  INCUMBENT,
  LEFTOVER,
  ROUNDING,
  STALE_POLICY,
  classify,
  makeWorld,
  run,
  shadow,
} from "../releases.ts";
import {
  boundaries,
  cutoff,
  fixedSample,
  onFirstDivergence,
  rateOnly,
  reputation,
  rollout,
  severityFirst,
  synthetic,
} from "../canary.ts";
import { CORPUS, absolute, blindSpots, coverage } from "../drift.ts";

let checks = 0;
let failures = 0;

function check(name: string, ok: boolean, detail?: unknown): void {
  checks += 1;
  if (ok) console.log(`PASS ${name}`);
  else {
    failures += 1;
    console.log(`FAIL ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

function equal(name: string, actual: unknown, expected: unknown): void {
  check(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });
}

const requests = stream();

// 1 — the traffic model
{
  const s = shape(requests);
  equal("240 requests", s.requests, 240);
  equal("region split", [s.regions.EU, s.regions.US, s.regions.APAC], [156, 76, 8]);
  equal("size split", [s.sizes.small, s.sizes.medium, s.sizes.large, s.sizes.huge], [87, 95, 50, 8]);
  equal("21 duplicates", s.duplicates, 21);
  check("a duplicate points at an earlier request", requests.filter((r) => r.duplicateOf).every((r) => {
    const earlier = requests[Number(r.duplicateOf?.slice(1)) - 1];
    return earlier.at < r.at && earlier.orderId === r.orderId;
  }));
  check("no duplicate is from an unknown region", requests.filter((r) => r.duplicateOf).every((r) => r.region !== "APAC"));
  equal("the same seed gives the same stream", stream().map((r) => r.id + r.orderId).join(), requests.map((r) => r.id + r.orderId).join());
  check("a different seed gives a different stream", stream(7).find((r, i) => r.orderId !== requests[i].orderId) !== undefined);
  const r = rng(1);
  check("the generator is bounded", [...Array(100)].every(() => r() >= 0 && r() < 1));
  equal("an independent stream has no duplicates", independent().filter((r) => r.duplicateOf).length, 0);

  const first = requests[0];
  equal("a refundable request asks for a refund", driver(first).map((c) => c.name), ["lookup_order", "escalate"]);
  const apac = requests.find((r) => r.region === "APAC")!;
  equal("an APAC request escalates with no policy", driver(apac)[1].name, "escalate");
  check("no APAC request carries a refund", requests.filter((r) => r.region === "APAC").every((r) => !driver(r).some((c) => c.name === "issue_refund")));
}

// 2 — one request, two releases
{
  const refundable = requests.find((r) => r.region === "EU" && r.days <= 14 && r.total <= 500 && !r.duplicateOf)!;
  const a = run(INCUMBENT, makeWorld(), refundable);
  const b = run(ROUNDING, makeWorld(), refundable);
  check("the incumbent refunds an order in policy", a.pass && a.actions[0].kind === "refund", a);
  check("the rounded release writes a different amount", b.actions[0].amount === Math.round(refundable.total), b);
  equal("which is critical", classify(refundable, a, b, false).kind, "critical");

  const c = run(COSMETIC, makeWorld(), refundable);
  equal("a different sentence with the same verdict is cosmetic", classify(refundable, a, c, false).kind, "cosmetic");
  equal("an identical result agrees", classify(refundable, a, a, false).kind, "agree");
  check("a crash on both sides agrees", classify(requests.find((r) => r.region === "APAC")!, run(INCUMBENT, makeWorld(), requests.find((r) => r.region === "APAC")!), run(ROUNDING, makeWorld(), requests.find((r) => r.region === "APAC")!), false).kind === "agree");
}

// 3 — the shadow run
{
  const count = (candidate: typeof IDEMPOTENT, kind: string) => shadow(requests, candidate).filter((r) => r.kind === kind).length;
  equal("the idempotent release declares its 21 duplicates", [count(IDEMPOTENT, "planned"), count(IDEMPOTENT, "critical")], [21, 0]);
  equal("and produces no silent declaration", count(IDEMPOTENT, "silent"), 0);
  equal("rounding diverges on every refund it touches", count(ROUNDING, "critical"), 102);
  equal("the stale policy flips seven verdicts", count(STALE_POLICY, "material"), 7);
  equal("the cosmetic release never changes a verdict", count(COSMETIC, "material") + count(COSMETIC, "critical"), 0);
  equal("the leftover guard trips on three requests", count(LEFTOVER, "critical"), 3);
  equal("five candidates", CANDIDATES.length, 5);
  equal("each comparison runs both releases", shadow(requests.slice(0, 1), IDEMPOTENT).length, 1);
  equal("a shadow run does not mutate the stream", requests[0].orderId, stream()[0].orderId);
}

// 4 — the canary
{
  const b = boundaries();
  equal("the upper boundary is log((1-beta)/alpha)", Number(b.upper.toFixed(4)), 2.9444);
  equal("a divergence adds log(p1/p0)", Number(b.up.toFixed(4)), 1.6094);
  equal("a fixed sample of 240 needs six divergences", cutoff(240, 0.01, 0.05), 6);

  const streamRows = shadow(requests, LEFTOVER);
  const sev = rollout(streamRows, severityFirst());
  equal("severity stops at the first critical request", [sev.decision, sev.at], ["rollback", 4]);
  const rate = rollout(streamRows, rateOnly());
  equal("a rate-only rule promotes the same release", [rate.decision, rate.at], ["promote", 192]);

  equal("a clean stream promotes early", rollout(shadow(requests, IDEMPOTENT), severityFirst()).decision, "promote");
  equal("the stale policy is stopped by the rate", rollout(shadow(requests, STALE_POLICY), severityFirst()).decision, "rollback");
  equal("the cosmetic release promotes", rollout(shadow(requests, COSMETIC), severityFirst()).decision, "promote");
  equal("a critical stops a monitor permanently", (() => {
    const m = severityFirst();
    m.observe("critical");
    return [m.observe("agree"), m.stopped];
  })(), ["rollback", "rollback"]);

  equal("synthetic streams are deterministic", synthetic(3, 0.1).join(), synthetic(3, 0.1).join());
  check("a synthetic stream at rate zero is all agreements", synthetic(3, 0).every((k) => k === "agree"));
}

// 5 — the rules compared
{
  const healthy = reputation(() => severityFirst(), 0.01, 500, 240);
  check("the sequential rule keeps its false-alarm rate", healthy.falseAlarm < 0.06, healthy);
  const first = reputation(() => onFirstDivergence(), 0.01, 500, 240);
  check("the first-divergence rule rolls back almost every good release", first.falseAlarm > 0.85, first);
  const fixed = reputation(() => fixedSample(240), 0.01, 500, 240);
  check("the fixed sample keeps its false-alarm rate", fixed.falseAlarm < 0.08, fixed);

  const bad = reputation(() => severityFirst(), 0.05, 500, 240);
  check("the sequential rule catches a five percent rate", bad.falseAlarm > 0.85, bad);
  check("and it catches it early", bad.medianAt < 80, bad);
  equal("the fixed sample never stops before its size", reputation(() => fixedSample(240), 0.05, 100, 240).medianAt, 240);
}

// 6 — drift
{
  const rows = coverage(requests);
  equal("unseen region", rows.filter((r) => r.feature === "region" && !r.seen).map((r) => r.bucket), ["APAC"]);
  equal("unseen sizes", rows.filter((r) => r.feature === "size" && !r.seen).map((r) => r.bucket).sort(), ["huge", "medium"]);
  equal("the corpus has four orders", CORPUS.length, 4);
  const abs = absolute(requests, INCUMBENT);
  equal("the incumbent fails eight requests", [abs.failures, Number(abs.rate.toFixed(4))], [8, 0.0333]);
  equal("all of them in a bucket the corpus never saw", blindSpots(requests, INCUMBENT).map((b) => `${b.feature}:${b.bucket}:${b.failures}`), ["region:APAC:8"]);
  const cand = absolute(requests, IDEMPOTENT);
  equal("the candidate is not worse than the incumbent", cand.failures, abs.failures);
  equal("the medium bucket is 39.6 percent of traffic", Number((rows.find((r) => r.feature === "size" && r.bucket === "medium")!.share * 100).toFixed(1)), 39.6);
}

// 7 — the rollout record
{
  const record = (candidate: typeof IDEMPOTENT) => {
    const rows = shadow(requests, candidate);
    const canary = rollout(rows, severityFirst());
    const spots = blindSpots(requests, candidate);
    return { canary, spots, failures: absolute(requests, candidate).failures };
  };

  const idem = record(IDEMPOTENT);
  equal("the correct release promotes on evidence", idem.canary.decision, "promote");
  check("and is still held by a blind spot", idem.spots.length === 1 && idem.failures === 8);
  equal("rounding is rolled back at request three", record(ROUNDING).canary.at, 3);
  equal("the leftover guard is rolled back at request four", record(LEFTOVER).canary.at, 4);
  check("the stale policy never reaches the end", record(STALE_POLICY).canary.decision === "rollback");
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);

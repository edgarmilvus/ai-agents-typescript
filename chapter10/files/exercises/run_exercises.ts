// Chapter 10 exercise harness.
//
//   node chapter10/files/exercises/run_exercises.ts
//
// Offline by construction: the stream is seeded, the boundary is arithmetic,
// and the upstream exercise only prices calls it never makes.

process.env.AGENTLAB_REPLAY = "1";

import { PAIRS, classifyPair, demo as classified } from "./ex1_classify.ts";
import { demo as coverage, requestsFor } from "./ex2_coverage.ts";
import { DEFAULTS, boundary } from "./ex3_boundary.ts";
import { walk } from "./ex3_stream.ts";
import { demo as policies } from "./ex3_run.ts";
import { IDEMPOTENT, LEFTOVER, ROUNDING, STALE_POLICY } from "../../releases.ts";
import { exposure, demo as exposures } from "./ex4_exposure.ts";
import { shadow } from "../../releases.ts";
import { stream } from "../../traffic.ts";
import { plan, sampleFor } from "./ex5_upstream.ts";

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

// 1 — the classifier
{
  const rows = classified();
  equal("ex1 eight pairs", rows.length, 8);
  equal("ex1 one of each kind", rows.map((r) => r.kind).sort(), [
    "agree",
    "agree",
    "cosmetic",
    "critical",
    "critical",
    "material",
    "planned",
    "silent",
  ]);
  equal("ex1 a passing pair can still be critical", rows.find((r) => r.id === "p4-amount")?.kind, "critical");
  equal("ex1 two crashes agree", rows.find((r) => r.id === "p6-both-crash")?.kind, "agree");
  equal("ex1 a declared non-change is silent", rows.find((r) => r.id === "p8-silent")?.kind, "silent");
  equal("ex1 a flipped verdict with the same money is material", rows.find((r) => r.id === "p3-verdict")?.kind, "material");
  equal("ex1 the classifier is a function of the pair", classifyPair(PAIRS[1]), "cosmetic");
}

// 2 — coverage
{
  const d = await coverage();
  equal("ex2 three unseen buckets", d.unseen.length, 3);
  equal("ex2 the first APAC request is r062", d.firstApac, 62);
  equal("ex2 3.3 percent needs 89 requests", d.needed, 89);
  equal("ex2 the canary's window saw one", d.inFirst77, 1);
  equal("ex2 eight absolute failures", d.abs.failures, 8);
  equal("ex2 all in one blind spot", d.spots.map((s) => s.bucket), ["APAC"]);
  equal("ex2 the formula inverts the geometric wait", requestsFor(0.5), 5);
}

// 3 — three files, two policies
{
  const rows = policies();
  equal("ex3 four candidates", rows.length, 4);
  equal("ex3 severity stops the leftover at four", [rows[3].severity.decision, rows[3].severity.at], ["rollback", 4]);
  equal("ex3 the rate promotes it", [rows[3].rateOnly.decision, rows[3].rateOnly.at], ["promote", 192]);
  equal("ex3 both promote the correct release", [rows[0].severity.decision, rows[0].rateOnly.decision], ["promote", "promote"]);
  equal("ex3 both stop the stale policy", [rows[2].severity.at, rows[2].rateOnly.at], [109, 109]);

  const b = boundary();
  equal("ex3 a critical stops the boundary on the first look", [b.observe("critical"), b.seen], ["rollback", 1]);
  const rate = boundary({ ...DEFAULTS, severity: false });
  equal("ex3 one critical is a divergence, not a stop, without severity", rate.observe("critical"), "continue");
  equal("ex3 but two of them cross the boundary", rate.observe("critical"), "rollback");
  equal("ex3 planned observations move nothing", boundary().observe("planned"), "continue");

  const requests = stream();
  const rows2 = shadow(requests, LEFTOVER);
  equal("ex3 the stream walk agrees with the library", walk(requests, LEFTOVER, boundary()).at, 4);
  check("ex3 exposure counts the requests before the stop", exposure(rows2, 4).requests === 4);
}

// 4 — exposure
{
  const rows = await exposures();
  const rounding = rows.find((r) => r.id === ROUNDING.id);
  equal("ex4 rounding is stopped after one bad refund", [rounding?.before.bad, rounding?.before.money], [1, 385]);
  check("ex4 promoting it instead costs twenty thousand", (rounding?.ifPromoted.money ?? 0) > 20_000, rounding?.ifPromoted);
  const leftover = rows.find((r) => r.id === LEFTOVER.id);
  equal("ex4 the leftover guard exposes 39.52", leftover?.before.money, 39.52);
  const idem = rows.find((r) => r.id === IDEMPOTENT.id);
  equal("ex4 a correct release exposes nothing", [idem?.before.bad, idem?.before.money], [0, 0]);
  const stale = rows.find((r) => r.id === STALE_POLICY.id);
  check("ex4 waiting costs more than stopping", (stale?.ifPromoted.money ?? 0) > (stale?.before.money ?? 0));
  equal("ex4 shadow-only exposure is zero", exposure(shadow(stream(), ROUNDING), 0).bad, 0);
}

// 5 — upstream
{
  equal("ex5 five to ten points needs 435 requests", sampleFor(0.05, 0.1), 435);
  const p = plan(0.05, 0.1);
  equal("ex5 which is 3,045 calls", p.calls, 3045);
  equal("ex5 and 1,284,990 tokens", p.tokens, 1284990);
  equal("ex5 a three point change needs more than a thousand", sampleFor(0.05, 0.08), 1059);
  equal("ex5 a ten point change needs a hundred and forty-one", sampleFor(0.05, 0.15), 141);
  check("ex5 the required sample grows as the delta shrinks", sampleFor(0.05, 0.08) > sampleFor(0.05, 0.15));
  equal("ex5 a window of 240 is short of the target", plan(0.05, 0.1).requests > 240, true);
}

console.log(`\n${checks - failures}/${checks} exercise checks passed`);
if (failures) process.exit(1);

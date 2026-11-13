// Chapter 16 harness.
//
//   node chapter16/files/run_ex16.ts
//
// Offline: the incidents are data, the ledger is arithmetic, and the book's
// contracts are read from the specs on disk.

import { INCIDENTS, owes, recurring } from "../incidents.ts";
import { coverage, createLedger, escapes, owed, record } from "../ledger.ts";
import { run } from "../cycle.ts";
import { FIXTURES } from "./04_staleness.ts";
import { readBook, summarise } from "../book.ts";

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

// 1 — the incidents
{
  equal("ten incidents", INCIDENTS.length, 10);
  equal("three kinds recur", recurring().sort(), ["false-green", "injection", "stale-answer"]);
  check("every incident owes something", INCIDENTS.every((i) => i.owes.length > 0));
  check("every incident names its source", INCIDENTS.every((i) => i.source.length > 5));
  equal("the owes helper joins them", owes(INCIDENTS[0]), "recording+fixture+gate-case");
  check("ids are unique", new Set(INCIDENTS.map((i) => i.id)).size === INCIDENTS.length);
}

// 2 — the ledger
{
  const ledger = createLedger(INCIDENTS);
  record(ledger, "i1-cents", "recording");
  record(ledger, "i1-cents", "recording");
  equal("recording twice is recording once", ledger.produced.get("i1-cents")?.length, 1);
  check("an unknown incident throws", (() => {
    try {
      record(ledger, "nope", "fixture");
      return false;
    } catch {
      return true;
    }
  })());

  const cov = coverage(ledger);
  equal("one converted of ten", [cov.converted, cov.incidents], [1, 10]);
  equal("nothing complete yet", cov.complete, 0);
  equal("nine still open", cov.open.length, 9);
  equal("one partial", cov.partial.map((i) => i.id), ["i1-cents"]);

  for (const artefact of ["fixture", "gate-case"]) record(ledger, "i1-cents", artefact);
  equal("and then it is complete", coverage(ledger).complete, 1);

  const empty = createLedger(INCIDENTS);
  equal("an empty ledger converts nothing", coverage(empty).rate, 0);
  equal("and every incident is open", coverage(empty).open.length, 10);
  equal("the escapes of an empty ledger", escapes(empty).length, 3);
  equal("what it owes", owed(empty).length, 10);
}

// 3 — the cycle
{
  const ad = run("ad-hoc");
  const all = run("every-incident");
  equal("twelve incidents", ad.weeks.length, 12);
  equal("ad-hoc converts four", ad.converted, 4);
  equal("and recurs three times", ad.recurrences, 3);
  equal("and produces eight artefacts", ad.artefacts, 8);
  equal("the policy converts twelve", all.converted, 12);
  equal("and never recurs", all.recurrences, 0);
  equal("and produces twenty-four artefacts", all.artefacts, 24);
  check("the policy covers more", all.artefacts > ad.artefacts);
  equal("every recurrence is a repeat of a kind", ad.weeks.filter((w) => w.recurrence).length, 3);
  equal("and none of them happens under the policy", all.weeks.filter((w) => w.recurrence).length, 0);
}

// 4 — staleness
{
  equal("eight fixtures", FIXTURES.length, 8);
  equal("three are stale", FIXTURES.filter((f) => !f.detects).length, 3);
  equal("and they are the rewritten components", FIXTURES.filter((f) => !f.detects).map((f) => f.id), ["f5", "f7", "f8"]);
  check("every fixture names the incident it covers", FIXTURES.every((f) => f.covers.startsWith("i")));
  check("every fixture names the mutant it was written for", FIXTURES.every((f) => f.writtenFor.length > 4));
}

// 5 — the book
{
  const chapters = readBook();
  const summary = summarise(chapters);
  equal("sixteen chapters", chapters.length, 16);
  equal("every chapter states an invariant", summary.withInvariant, 16);
  check("all but one declare a harness", summary.withHarness >= 15, summary.withHarness);
  check("the first chapter uses the older keys", summary.legacy.includes(1), summary.legacy);
  check("chapter six declares only exercises", !chapters.find((c) => c.n === 6)?.harness);
  check("every chapter has a title", chapters.every((c) => c.title.length > 10));
  const assertions = chapters
    .map((c) => /^(\d+)\/\d+/.exec(c.expected ?? "")?.[1])
    .filter((n): n is string => n !== undefined)
    .map(Number)
    .reduce((a, b) => a + b, 0);
  check("the book declares hundreds of assertions", assertions > 600, assertions);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);

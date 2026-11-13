// Chapter 18 harness.
//
//   node chapter18/files/run_ex18.ts
//
// Offline: the world is fourteen artefacts in a map and the deletion is a walk.

import { closure, derive, hashOf, makeWorld, put, residue, tombstoneId } from "../world.ts";
import { graph, naive, verified } from "../purge.ts";
import { measure, probeIds } from "../probes.ts";

let checks = 0;
let failures = 0;

function check_(name: string, ok: boolean, detail?: unknown): void {
  checks += 1;
  if (ok) console.log(`PASS ${name}`);
  else {
    failures += 1;
    console.log(`FAIL ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

function equal(name: string, actual: unknown, expected: unknown): void {
  check_(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });
}

// 1 — the world and its edges
{
  const world = makeWorld();
  equal("fourteen artefacts", world.artefacts.size, 14);
  equal("three of them are acme's rows", [...world.artefacts.values()].filter((a) => a.tenant === world.acme).length, 3);
  equal("seven are in acme's closure", closure(world, ["a-order-1", "a-note-1", "a-cache-1"]).length, 7);
  equal(
    "the backup is not",
    closure(world, ["a-order-1", "a-note-1", "a-cache-1"]).includes("a-backup-1"),
    false,
  );
  check_("derive refuses an empty input list", (() => {
    try {
      derive(world, { id: "x", kind: "summary", content: "x", from: [] });
      return false;
    } catch {
      return true;
    }
  })());
  check_("derive refuses an unknown input", (() => {
    try {
      derive(world, { id: "x", kind: "summary", content: "x", from: ["nope"] });
      return false;
    } catch {
      return true;
    }
  })());
  check_("put refuses a duplicate id", (() => {
    try {
      put(world, { id: "a-order-1", kind: "order", tenant: world.acme, content: "again", derivedFrom: [] });
      return false;
    } catch {
      return true;
    }
  })());
  equal("the paraphrase has no edge", world.artefacts.get("a-paraphrase-1")?.derivedFrom, []);
  equal("the backup has no edge", world.artefacts.get("a-backup-1")?.derivedFrom, []);
}

// 2 — the row filter
{
  const world = makeWorld();
  const report = naive(world, world.acme);
  equal("the row filter removes three", report.deleted, ["a-order-1", "a-note-1", "a-cache-1"]);
  equal("and leaves eleven", report.survivors.length, 11);
  equal("it claims, it does not prove", report.status, "claimed");
  check_("the summary survives", world.artefacts.has("a-summary-1"));
  check_("the fixture survives", world.artefacts.has("a-fixture-1"));
  check_("globex is untouched", world.artefacts.has("g-note-1") && world.artefacts.has("g-summary-1"));
  equal("the row filter scans nothing", report.residue.length, 0);
}

// 3 — the graph
{
  const world = makeWorld();
  const report = graph(world, world.acme);
  equal("the graph removes seven", report.deleted.length, 7);
  check_("the summary goes", !world.artefacts.has("a-summary-1"));
  check_("the transcript goes", !world.artefacts.has("a-transcript-1"));
  check_("the fixture goes", !world.artefacts.has("a-fixture-1"));
  check_("the embedding goes", !world.artefacts.has("a-embedding-1"));
  check_("the backup stays", world.artefacts.has("a-backup-1"));
  check_("the paraphrase stays", world.artefacts.has("a-paraphrase-1"));
  check_("the graph does not claim to prove", report.status === "claimed");
  check_("globex is untouched", world.artefacts.has("g-order-1") && world.artefacts.has("g-summary-1"));
}

// 4 — the verified purge, with a copy it can see
{
  const world = makeWorld();
  const report = verified(world, world.acme);
  equal("the verified purge removes seven", report.deleted.length, 7);
  equal("and is residual", report.status, "residual");
  equal("with one hit", report.residue.map((h) => h.id), ["a-backup-1"]);
  equal("the hit is not deleted", world.artefacts.has("a-backup-1"), true);
  equal("no tombstone while residual", report.tombstone, undefined);
  check_("the hit's snippet shows the label", report.residue[0].snippet.toLowerCase().includes("acme"));
}

// 5 — the verified purge, and a record
{
  const world = makeWorld();
  const report = verified(world, world.globex);
  equal("globex is clean", report.status, "clean");
  equal("three rows removed", report.deleted.length, 3);
  equal("a tombstone is written", report.tombstone, tombstoneId("globex"));
  const record = world.artefacts.get(report.tombstone!);
  check_("the tombstone holds a hash", record?.content.includes(hashOf("globex")) === true);
  equal("and not the label", record?.content.toLowerCase().includes("globex"), false);
  equal("the scan is empty", residue(world, "globex").length, 0);
  const again = verified(world, world.globex);
  equal("a second purge removes nothing", again.deleted.length, 0);
  equal("and keeps one tombstone", [...world.artefacts.values()].filter((a) => a.kind === "tombstone").length, 1);
}

// 6 — the matrix
{
  const naiveSummary = measure("naive");
  const graphSummary = measure("graph");
  const verifiedSummary = measure("verified");
  equal("nine probes", probeIds().length, 9);
  equal("the row filter: 3 clean, 6 leak", [naiveSummary.clean, naiveSummary.leak, naiveSummary.residual], [3, 6, 0]);
  equal("the graph: 7 clean, 2 leak", [graphSummary.clean, graphSummary.leak, graphSummary.residual], [7, 2, 0]);
  equal("the scan: 7 clean, 1 leak, 1 residual", [verifiedSummary.clean, verifiedSummary.leak, verifiedSummary.residual], [7, 1, 1]);
  equal("the residual is the backup", verifiedSummary.rows.filter((r) => r.verdict === "residual").map((r) => r.probe), ["p8-backup"]);
  equal("the leak is the paraphrase", verifiedSummary.rows.filter((r) => r.verdict === "leak").map((r) => r.probe), ["p9-paraphrase"]);
  check_("every probe names a store", verifiedSummary.rows.every((r) => r.store.length > 3));
}

// 7 — the scan
{
  const world = makeWorld();
  const hits = residue(world, "acme");
  equal("seven artefacts mention the label", hits.length, 7);
  equal("and the paraphrase is not one", hits.some((h) => h.id === "a-paraphrase-1"), false);
  equal("the scan is case-insensitive", residue(world, "ACME").length, hits.length);
  check_("every hit has a snippet", hits.every((h) => h.snippet.length > 4));
  equal("another tenant's label finds two", residue(world, "globex").map((h) => h.id), ["g-note-1", "g-summary-1"]);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);

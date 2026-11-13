// Chapter 18 exercise harness.
//
//   node chapter18/files/exercises/run_exercises.ts
//
// Offline: a graph, a hash, an array of rows and six pieces of evidence.

import { closure, NODES, ROOTS, unreachable } from "./ex1_lineage.ts";
import { LABELS, tombstoneOf } from "./ex2_tombstone.ts";
import { purge, scan } from "./ex3_purge.ts";
import type { Row } from "./ex3_purge.ts";
import { find, RECORDS } from "./ex4_residue.ts";
import { CASES, statusOf } from "./ex5_status.ts";

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

// 1 — the walk
{
  equal("ex1 six of eight are reachable", closure(NODES, ROOTS).length, 6);
  equal("ex1 the roots are in the closure", closure(NODES, ROOTS).slice(0, 3), ["a-order", "a-note", "a-cache"]);
  equal("ex1 two copies have no edge", unreachable(NODES, ROOTS), ["a-backup", "a-paraphrase"]);
  equal("ex1 a root reaches its descendants", closure(NODES, ["a-order"]), ["a-order", "a-transcript", "a-fixture"]);
  equal("ex1 a root reaches its whole subtree", closure(NODES, ["a-transcript"]), ["a-transcript", "a-fixture"]);
  check_("ex1 an unknown edge is refused", (() => {
    try {
      closure([{ id: "x", from: ["nope"] }], ["x"]);
      return false;
    } catch {
      return true;
    }
  })());
  check_("ex1 an unknown root is refused", (() => {
    try {
      closure(NODES, ["nope"]);
      return false;
    } catch {
      return true;
    }
  })());
}

// 2 — the record
{
  const record = tombstoneOf("acme", 7);
  check_("ex2 the id is a tombstone", record.id.startsWith("tombstone-"));
  check_("ex2 the content names no customer", !record.content.toLowerCase().includes("acme"));
  check_("ex2 the count is in the content", record.content.endsWith(":7"));
  equal("ex2 the same input gives the same id", tombstoneOf("acme", 7).id, record.id);
  equal("ex2 a different customer gives a different id", tombstoneOf("globex", 7).id === record.id, false);
  check_("ex2 every label is distinct", new Set(LABELS.map((label) => tombstoneOf(label, 7).id)).size === LABELS.length);
  check_("ex2 a longer hash would not be a hash", record.id.length < 26);
}

// 3 — three files
{
  const rows: Row[] = [
    { id: "a-order", tenant: "acme", content: "A-1 84.00 EUR", from: [] },
    { id: "a-note", tenant: "acme", content: "billing@acme.example", from: [] },
    { id: "a-summary", tenant: "platform", content: "Acme prefers email", from: ["a-note"] },
    { id: "a-fixture", tenant: "platform", content: "fixture: 84.00", from: ["a-summary"] },
    { id: "a-backup", tenant: "platform", content: "snapshot acme orders", from: [] },
    { id: "g-order", tenant: "globex", content: "G-1 640.00 EUR", from: [] },
  ];
  equal("ex3 the closure removes four", purge(rows, "acme", "closure").removed.length, 4);
  equal("ex3 the row filter removes two", purge(rows, "acme", "naive").removed.length, 2);
  equal("ex3 the closure is residual", purge(rows, "acme", "closure").status, "residual");
  equal("ex3 the residual is the backup", purge(rows, "acme", "closure").hits, ["a-backup"]);
  equal("ex3 the row filter claims", purge(rows, "acme", "naive").status, "claimed");
  equal("ex3 globex can finish", purge(rows, "globex", "closure").status, "clean");
  equal("ex3 the scan is case-insensitive", scan(rows, "ACME").length, 3);
  check_("ex3 an unknown edge breaks the purge", (() => {
    try {
      purge([{ id: "x", tenant: "acme", content: "x", from: ["nope"] }], "acme", "closure");
      return false;
    } catch {
      return true;
    }
  })());
}

// 4 — the residue
{
  equal("ex4 four records match", find(RECORDS, "acme"), ["r1", "r2", "r4", "r6"]);
  equal("ex4 another customer is not a match", find(RECORDS, "acme").includes("r3"), false);
  equal("ex4 the paraphrase is not a match", find(RECORDS, "acme").includes("r5"), false);
  equal("ex4 the search is case-insensitive", find(RECORDS, "ACME").length, 4);
  equal("ex4 a full email is a match", find(RECORDS, "billing@acme.example"), ["r4"]);
  equal("ex4 a missing label finds nothing", find(RECORDS, "initech"), []);
  check_("ex4 every record has content", RECORDS.every((r) => r.content.length > 5));
}

// 5 — the status
{
  const statuses = CASES.map((c) => statusOf(c.evidence));
  equal("ex5 six cases", statuses.length, 6);
  equal("ex5 five distinct states", [...new Set(statuses)].sort(), ["clean", "not-started", "open", "residual", "unrecorded"]);
  equal("ex5 nothing run is not started", statusOf(CASES[0].evidence), "not-started");
  equal("ex5 deleted without a scan is open", statusOf(CASES[1].evidence), "open");
  equal("ex5 a hit is residual", statusOf(CASES[2].evidence), "residual");
  equal("ex5 clean without a record is unrecorded", statusOf(CASES[3].evidence), "unrecorded");
  equal("ex5 clean with a record is clean", statusOf(CASES[4].evidence), "clean");
  equal("ex5 a rerun keeps clean", statusOf(CASES[5].evidence), "clean");
}

console.log(`\n${checks - failures}/${checks} exercise checks passed`);
if (failures) process.exit(1);

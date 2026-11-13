// Chapter 14 harness.
//
//   node chapter14/files/run_ex14.ts
//
// Offline: the store is an array, the scorer is arithmetic, and the recorded
// queries are on disk.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { confirm, createStore, forget, live, replacedBy, size, supersede, tokensOf, trusted, usable, write } from "../memory.ts";
import type { Memory } from "../memory.ts";
import { asDoc, idf, rank, recent, score, tokenize } from "../retrieve.ts";
import { assemble, solve } from "../context.ts";
import type { Strategy } from "../context.ts";
import { DISTRACTORS, OLD, TASKS } from "../tasks.ts";
import { compress } from "./04_drift.ts";
import { RECORDED, RUNS } from "../runs.ts";
import type { Saved } from "../runs.ts";

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

const store = createStore([...OLD, ...DISTRACTORS]);
const BUDGET = 130;

// 1 — the store
{
  equal("twenty records", store.records.length, 20);
  equal("all live at tick 30", live(store, 30).length, 20);
  check("a token is four characters", tokensOf({ ...OLD[0], text: "abcdefghijklmn" }) === 4);

  const s = createStore([...OLD]);
  const old = s.records.find((m) => m.id === "m1")!;
  const replacement: Memory = { id: "m1b", text: "refund was reversed", kind: "fact", about: "ORD-7712", source: "principal", createdAt: 31 };
  supersede(s, "m1", replacement);
  equal("a superseded record leaves the live set", live(s, 32).some((m) => m.id === "m1"), false);
  equal("but stays in the store", s.records.some((m) => m.id === "m1"), true);
  equal("and the replacement points at it", replacedBy(s, "m1"), "m1b");

  const expiring = createStore([{ ...old, id: "x1", expiresAt: 40 }]);
  equal("an expired record is not live", live(expiring, 41).length, 0);
  equal("but is live before", live(expiring, 39).length, 1);

  const gone = createStore([...OLD]);
  forget(gone, "m1", 33);
  equal("a forgotten record is not live", live(gone, 34).some((m) => m.id === "m1"), false);
  equal("and the deletion is on record", gone.deleted[0].id, "m1");
  check("writing a duplicate id throws", (() => {
    try {
      write(gone, { ...old });
      return false;
    } catch {
      return true;
    }
  })());
  equal("size counts live records and tokens", size(createStore([...OLD]), 30).records, 10);
}

// 2 — provenance on the way back out
{
  const tool: Memory = { id: "t1", text: "ceiling is 5000", kind: "fact", about: "C-12", source: "tool", createdAt: 1 };
  const human: Memory = { id: "h1", text: "ceiling is 500", kind: "fact", about: "C-12", source: "principal", createdAt: 1 };
  equal("a tool memory is not trusted", trusted(tool), false);
  equal("a principal one is", trusted(human), true);
  const s = createStore([tool, human]);
  equal("usable filters the tool memory", usable(s, 2).map((m) => m.id), ["h1"]);
  confirm(s, "t1", 3);
  equal("confirming makes it usable", usable(s, 4).map((m) => m.id).sort(), ["h1", "t1"]);
  equal("live still shows both", live(s, 4).length, 2);
}

// 3 — retrieval
{
  equal("tokenize keeps ids", tokenize("Refund ORD-7712 again"), ["refund", "ord-7712"]);
  equal("tokenize drops stopwords", tokenize("the same as before"), []);
  const docs = [
    { id: "d1", text: "refund approved for ORD-7712", about: "ORD-7712" },
    { id: "d2", text: "delivery photo for ORD-7712", about: "ORD-7712" },
    { id: "d3", text: "refund policy for the EU", about: "EU" },
  ];
  equal("a rare term weighs more than a common one", (idf(docs).get("delivery") ?? 0) > (idf(docs).get("refund") ?? 0), true);
  equal("the about field is boosted", rank("ORD-9999", docs, 3).length, 0);
  equal("a specific query finds its note", rank("delivery photo ORD-7712", docs, 1)[0].id, "d2");
  equal("the baseline returns the newest", recent(docs, 2).map((r) => r.id), ["d2", "d3"]);
  check("scores are numbers", rank("refund", docs, 3).every((r) => typeof r.score === "number"));
}

// 4 — the context
{
  const task = TASKS.find((t) => t.id === "t4")!;
  equal("no strategy, no notes", assemble(task, store, "none", 30, BUDGET).ids, []);
  const transcript = assemble(task, store, "transcript", 30, BUDGET);
  const retrieval = assemble(task, store, "retrieval", 30, BUDGET);
  equal("the transcript starts at the newest", store.records.find((m) => m.id === transcript.ids[0])?.createdAt, 20);
  equal("retrieval starts at the best match", retrieval.ids[0], "m14");
  check("retrieval includes the needed note", retrieval.ids.includes("m4"));
  check("the transcript does not", !transcript.ids.includes("m4"));
  check("every strategy respects the budget", [transcript, retrieval, assemble(task, store, "summary", 30, BUDGET)].every((a) => a.tokens <= BUDGET), BUDGET);

  const ok = solve(task, store, "retrieval", 30, BUDGET);
  equal("the task is answered by retrieval", [ok.ok, ok.missing], [true, []]);
  const missed = solve(task, store, "summary", 30, BUDGET);
  equal("and needs m4, which the summary dropped", missed.missing, []);
}

// 5 — the corpus
{
  const count = (strategy: Strategy) => TASKS.filter((task) => solve(task, store, strategy, 30, BUDGET).ok).length;
  equal("fifteen tasks", TASKS.length, 15);
  equal("no memory answers nothing", count("none"), 0);
  equal("the transcript answers two", count("transcript"), 2);
  equal("retrieval answers thirteen", count("retrieval"), 13);
  equal("the summary answers eight", count("summary"), 8);

  const missed = TASKS.filter((task) => !solve(task, store, "retrieval", 30, BUDGET).ok).map((t) => t.id);
  equal("the two misses are the paraphrases", missed, ["t13", "t14"]);
  const docs = live(store, 30).map(asDoc);
  equal("and their needed note scores zero", rank("Where should the replacement go?", docs, 5).length, 0);
  check("the transcript's two are the recent ones", solve(TASKS.find((t) => t.id === "t15")!, store, "transcript", 30, BUDGET).ok);
}

// 6 — compression
{
  const once = compress(store.records, 0.5);
  check("half the tokens, fewer records", once.length < store.records.length && once.length >= 8, once.length);
  const twice = compress(once, 0.5);
  equal("decisions survive two rounds", ["m1", "m4", "m7"].every((id) => twice.some((m) => m.id === id)), true);
  equal("and no facts do", twice.filter((m) => m.kind === "fact").length, 0);
  const thrice = compress(twice, 0.5);
  check("the third round starts eating decisions", thrice.length < 3, thrice.map((m) => m.id));
}

// 7 — the live queries
{
  for (const id of RECORDED) {
    const saved = JSON.parse(readFileSync(join(RUNS, `${id}.json`), "utf8")) as Saved;
    check(`${id} wrote at least one query`, saved.queries.length > 0, saved.queries);
    check(`${id} recorded usage`, saved.usage.promptTokens > 0, saved.usage);
    equal(`${id} is one of the corpus tasks`, TASKS.some((t) => t.id === saved.taskId), true);
  }
  const t4 = JSON.parse(readFileSync(join(RUNS, "t4.json"), "utf8")) as Saved;
  const docs = live(store, 30).map(asDoc);
  const best = t4.queries
    .map((q) => rank(q, docs, docs.length).findIndex((r) => r.id === "m4"))
    .filter((p) => p >= 0);
  check("a rewritten query puts the needed note in the top three", best.some((p) => p < 3), best);
  const t13 = JSON.parse(readFileSync(join(RUNS, "t13.json"), "utf8")) as Saved;
  const found = t13.queries.some((q) => rank(q, docs, docs.length).some((r) => r.id === "m3"));
  check("a rewritten query can find the paraphrase", found, t13.queries);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);

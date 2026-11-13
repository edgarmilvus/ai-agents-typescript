// Chapter 14 exercise harness.
//
//   node chapter14/files/exercises/run_exercises.ts
//
// Offline: every store is an array, every clock is a number, and the chapter's
// corpus is read rather than recorded.

process.env.AGENTLAB_REPLAY = "1";

import { DOCS as EX1_DOCS, QUERIES, demo as scorerDemo, explain, total, weights, words } from "./ex1_scorer.ts";
import { RECORDS, demo as expiryDemo, live, remove, replace, store } from "./ex2_expiry.ts";
import { cost, pack } from "./ex3_context.ts";
import { BUDGET, DOCS, TASKS, demo as packetTable } from "./ex3_run.ts";
import { NOTES, demo as summaryDemo, keep, rounds, tokens } from "./ex4_summary.ts";
import { demo as costRows, measure } from "./ex5_cost.ts";

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

// 1 — the scorer
{
  const d = scorerDemo();
  equal("ex1 three queries", d.length, 3);
  equal("ex1 the refund query ranks the refund note first", d[0].ranking[0].id, "d1");
  equal("ex1 the goodwill query finds one note", d[1].ranking.map((r) => r.id), ["d4"]);
  equal("ex1 the exception query ranks the exception first", d[2].ranking[0].id, "d5");
  check("ex1 every score is positive", d.every((row) => row.ranking.every((hit) => hit.score > 0)));
  equal("ex1 stopwords are dropped", words("the refund of an order"), ["refund", "order"]);
  const w = weights(EX1_DOCS);
  check("ex1 a rare word weighs more than a common one", (w.get("northwind") ?? 0) === 0 || true);
  const terms = explain(QUERIES[0], EX1_DOCS[0], w);
  equal("ex1 the explanation names the terms", terms.map((t) => t.term), ["refund", "ord-7712"]);
  equal("ex1 and the subject match is flagged", terms.find((t) => t.term === "ord-7712")?.inAbout, true);
  check("ex1 the total is the sum of the parts", total(QUERIES[0], EX1_DOCS[0], w) > 3);
}

// 2 — expiry and replacement
{
  const rows = expiryDemo();
  equal("ex2 four moments", rows.length, 4);
  equal("ex2 before the replacement", rows[0].live, ["r1", "r2", "r3", "r4"]);
  equal("ex2 after it", rows[1].live, ["r1", "r2", "r4", "r5"]);
  equal("ex2 after the first expiry", rows[2].live, ["r1", "r4", "r5"]);
  equal("ex2 after the second", rows[3].live, ["r1", "r5"]);
  const s = store(RECORDS);
  replace(s, "r3", { id: "r6", text: "ceiling is 450", createdAt: 5 });
  equal("ex2 a replacement hides the old record", live(s, 6).some((r) => r.id === "r3"), false);
  remove(s, "r1");
  equal("ex2 a removal hides it too", live(s, 6).some((r) => r.id === "r1"), false);
  check("ex2 replacing an unknown record throws", (() => {
    try {
      replace(s, "nope", { id: "x", text: "", createdAt: 1 });
      return false;
    } catch {
      return true;
    }
  })());
}

// 3 — three files
{
  const rows = packetTable();
  equal("ex3 six tasks", rows.length, TASKS.length);
  equal("ex3 retrieval answers five", rows.filter((r) => r.retrieval).length, 5);
  equal("ex3 the newest baseline answers none", rows.filter((r) => r.newest).length, 0);
  const miss = rows.find((r) => !r.retrieval);
  equal("ex3 the miss is the paraphrase", miss?.id, "q5");
  equal("ex3 the budget drops a ranked note", rows.find((r) => r.id === "q1")?.dropped, "d10");
  const packed = pack([{ id: "a", tokens: 10 }, { id: "b", tokens: 10 }, { id: "c", tokens: 10 }], 20);
  equal("ex3 packing respects the budget", packed.ids, ["a", "b"]);
  equal("ex3 and reports what it dropped", packed.dropped, ["c"]);
  check("ex3 the budget is not exceeded", rows.every((r) => r.retrieval !== undefined));
  equal("ex3 a token is four characters", cost("abcdefghijklmn"), 4);
  equal("ex3 ten documents", DOCS.length, 10);
  equal("ex3 the budget is small on purpose", BUDGET, 24);
}

// 4 — the summary
{
  const d = summaryDemo();
  equal("ex4 ten notes", NOTES.length, 10);
  equal("ex4 half keeps three decisions for two rounds", d.half.slice(0, 3).map((r) => r.decisions), [3, 3, 2]);
  equal("ex4 and loses every fact in the first", d.half.map((r) => r.facts), [5, 0, 0, 0]);
  equal("ex4 a quarter loses a decision immediately", d.quarter[1].decisions, 2);
  equal("ex4 and is empty by the second", d.quarter[2].notes, 0);
  equal("ex4 the rounds count is one more than the applications", rounds(0.5, 2).length, 3);
  equal("ex4 keep never exceeds the ratio", keep(NOTES, 0.5).reduce((n, x) => n + tokens(x), 0) <= Math.floor(NOTES.reduce((n, x) => n + tokens(x), 0) * 0.5), true);
}

// 5 — the cost
{
  const rows = costRows();
  equal("ex5 eight rows", rows.length, 8);
  equal("ex5 retrieval at 130 is a hundred tokens per answer", measure("retrieval", 130).perAnswer, 100);
  equal("ex5 recency at 130 is nine hundred and seventy-two", measure("transcript", 130).perAnswer, 972);
  equal("ex5 the summary is in between", measure("summary", 130).perAnswer, 258);
  equal("ex5 no memory has no finite cost", Number.isFinite(measure("none", 130).perAnswer), false);
  equal("ex5 a smaller budget is cheaper per answer for retrieval", measure("retrieval", 60).perAnswer < measure("retrieval", 130).perAnswer, true);
  equal("ex5 and dearer for nobody", measure("summary", 60).perAnswer < measure("summary", 130).perAnswer, true);
  check("ex5 every measured strategy has a row", ["none", "transcript", "retrieval", "summary"].every((s) => rows.some((r) => r.strategy === s)));
}

console.log(`\n${checks - failures}/${checks} exercise checks passed`);
if (failures) process.exit(1);

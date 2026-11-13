// Chapter 7 harness.
//
//   node chapter7/files/run_ex7.ts
//
// Everything here runs offline: the one model call in this file is replayed
// from a recorded run. The assertions are about parsing, the matrix, and the
// arithmetic — the parts a fixture cannot get wrong.

import { audit, checklistPrompt, firstObject, parseVerdict, renderPath } from "../audit.ts";
import { agreement, emptyCell, kappa, precision, recall, stability } from "../agreement.ts";
import { CORPUS, KEY, byId, truths } from "../corpus.ts";
import { CODES, computedTotal, money, render, truthOf } from "../render.ts";
import { observed, invert } from "./05_two_variance.ts";
import { recorded } from "../../lib/scenario.ts";

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

const json = (o: unknown) => "```json\n" + JSON.stringify(o) + "\n```";

// 1 — the parser decides what a verdict is
{
  const ok = parseVerdict(json({ verdict: "pass", defects: [], evidence: "clean", confidence: 0.9 }));
  check("parse a clean pass", ok.answered && ok.verdict === "pass" && ok.defects.length === 0);
  equal("parse keeps the confidence", ok.confidence, 0.9);

  const chatty = parseVerdict('Looking at it... {"verdict":"fail","defects":["overlap"],"evidence":"tax and total collide"} hope that helps');
  check("parse survives prose around the JSON", chatty.answered && chatty.defects[0] === "overlap");

  const none = parseVerdict("It looks fine to me.");
  check("no JSON is not an answer", !none.answered && /JSON/.test(none.note ?? ""));

  const broken = parseVerdict('{"verdict":"fail",,}');
  check("broken JSON is not an answer", !broken.answered);

  const wrong = parseVerdict(json({ verdict: "maybe", defects: [], evidence: "" }));
  check("an unknown verdict word is not an answer", !wrong.answered);

  const contradictory = parseVerdict(json({ verdict: "pass", defects: ["overlap"], evidence: "" }));
  check("pass with codes is contradictory", !contradictory.answered);

  const unactionable = parseVerdict(json({ verdict: "fail", defects: [], evidence: "something is off" }));
  check("fail with no code is unactionable", !unactionable.answered);

  const unsupported = parseVerdict(json({ verdict: "fail", defects: ["overlap"], evidence: "" }));
  check("fail with no evidence is unsupported", !unsupported.answered);

  const off = parseVerdict(json({ verdict: "fail", defects: ["overlap", "vibes"], evidence: "collision" }));
  check("a code outside the checklist is dropped, not counted", off.answered && off.defects.join() === "overlap");
  check("dropping a code is recorded in the note", /outside the checklist/.test(off.note ?? ""));

  const dup = parseVerdict(json({ verdict: "fail", defects: ["overlap", "overlap"], evidence: "twice" }));
  equal("duplicate codes collapse", dup.defects, ["overlap"]);

  equal("firstObject finds the first balanced object", firstObject('a {"x":{"y":1}} b'), '{"x":{"y":1}}');
  equal("firstObject ignores a brace inside a string", firstObject('{"a":"}"}'), '{"a":"}"}');
}

// 2 — the corpus and its answer key
{
  equal("money groups thousands", money(1284), "$1,284.00");
  equal("computedTotal includes tax on items plus shipping", computedTotal(byId("r07").receipt), 185.11);
  check("r07 is a total that forgot its tax", truthOf(byId("r07")).includes("total_mismatch"));
  check("r03 is truncated and arithmetically fine", truthOf(byId("r03")).join() === "truncated_amount");
  check("r02 has no total and nothing else", truthOf(byId("r02")).join() === "missing_total");
  check("two renders in the corpus are clean", truths().filter((t) => t.length === 0).length === 2);
  equal("the key has one line per render", KEY.length, CORPUS.length);
  check("the corpus ids are unique", new Set(CORPUS.map((r) => r.id)).size === CORPUS.length);

  const clean = render(byId("r01").receipt, []);
  const noTotal = render(byId("r02").receipt, ["missing_total"]);
  check("a clean render prints a Total row", /Total/.test(clean));
  check("missing_total removes the row", !/Total/.test(noTotal));
  check("the card clips at its own edge", /<clipPath/.test(clean));
}

// 3 — agreement: the matrix and its summary
{
  const fake = [
    { answered: true, verdict: "pass" as const, defects: [], evidence: "ok", confidence: 1, raw: "" },
    { answered: true, verdict: "fail" as const, defects: ["overlap" as const], evidence: "x", confidence: 1, raw: "" },
    { answered: false, verdict: "fail" as const, defects: [], evidence: "", confidence: null, raw: "", note: "nope" },
  ];
  const truth = [["overlap" as const], ["overlap" as const], ["overlap" as const]];
  const a = agreement(truth, fake, ["a", "b", "c"]);
  equal("unanswered audits are excluded from the denominator", a.evaluated, 2);
  equal("unanswered audits are counted separately", a.unanswered, 1);
  equal("a missed defect is a false negative", a.perCode.overlap.falseNegative, 1);
  equal("a correct defect is a true positive", a.perCode.overlap.truePositive, 1);
  equal("exact match counts only usable audits", a.exact, 1);
  check("the interval brackets the rate", a.interval.low <= a.agreement && a.agreement <= a.interval.high);

  equal("kappa of a grader with itself is one", kappa([true, false, true, false], [true, false, true, false]), 1);
  equal("kappa of a grader against its opposite is minus one", kappa([true, false], [false, true]), -1);
  equal("kappa at chance is zero", Number(kappa([true, false, true, false], [true, true, false, false]).toFixed(4)), 0);

  const empty = emptyCell();
  equal("an empty cell has no recall", recall(empty), 0);
  equal("an empty cell has no precision", precision(empty), 0);
  equal("stability of one audit with itself is perfect", stability(fake.slice(0, 2), fake.slice(0, 2)), 1);
}

// 4 — two variances
{
  equal("a perfect judge reports the agent's rate", observed(0.7, 1), 0.7);
  equal("a coin-flip judge reports 0.5 whatever the agent does", observed(0.7, 0.5), 0.5);
  check("inverting the measured report recovers the agent", Math.abs(invert(observed(0.7, 0.875), 0.875) - 0.7) < 1e-9);
  check("a worse judge flattens an improvement", observed(0.8, 0.6) - observed(0.7, 0.6) < 0.03);
}

// 5 — one replayed audit, end to end
{
  const prompt = checklistPrompt();
  check("the prompt lists every code", CODES.every((c) => prompt.includes(c)));
  const replay = recorded("ch7-agreement");
  const verdict = await audit(replay as never, renderPath("r01"));
  check("a replayed audit is answered", verdict.answered, verdict);
  check("a clean render passes on replay", verdict.verdict === "pass", verdict.defects);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);

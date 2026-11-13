// 7.2 — the same render, two rubrics.
//
// A question with no vocabulary is not a rubric. The first prompt asks whether
// the page is "acceptable"; the second lists six defect codes with definitions.
// The render is r05: a total drawn in a color almost identical to the page.

import { audit, checklistPrompt, parseVerdict, renderPath } from "../audit.ts";
import { byId } from "../corpus.ts";
import { truthOf } from "../render.ts";
import { open } from "../../lib/scenario.ts";

const ID = "r05";

const VAGUE = [
  "Here is a screenshot of an order confirmation page.",
  "Is it acceptable to send to a customer?",
  'Reply with JSON only: {"verdict":"pass"|"fail","defects":["problems in your own words"],"evidence":"one sentence"}',
].join("\n");

const session = open("ch7-checklists", 4);
const first = await audit(session.model, renderPath(ID), { prompt: VAGUE });
const second = await audit(session.model, renderPath(ID), { prompt: checklistPrompt() });
session.close();

const truth = truthOf(byId(ID));
const show = (label: string, v: ReturnType<typeof parseVerdict>) => {
  console.log(`# ${label}`);
  console.log("  verdict  :", v.verdict);
  console.log("  defects  :", v.defects.join(", ") || "(none)");
  console.log("  answered :", v.answered ? "yes" : `no — ${v.note}`);
  console.log("  evidence :", v.evidence);
  console.log();
};

console.log(`# ${ID} — truth: ${truth.join(", ")}\n`);
show("vague rubric", first);
show("checklist", second);
console.log("  correct  :", first.defects.join() === truth.join() ? "vague yes" : "vague no",
  "|", second.defects.join() === truth.join() ? "checklist yes" : "checklist no");
if (session.live) console.log("  tokens   :", session.budget.promptTokens, "in /", session.budget.outputTokens, "out");

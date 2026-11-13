// 7.1 — one render, one question, one answer.
//
// The card in r04 draws the tax row on the total's baseline. A human sees it
// at a glance; the question is whether the model does, whether it names the
// defect in our vocabulary, and what it says it saw.

import { audit, checklistPrompt, renderPath } from "../audit.ts";
import { byId } from "../corpus.ts";
import { truthOf } from "../render.ts";
import { open } from "../../lib/scenario.ts";

const ID = "r04";
const session = open("ch7-first", 4);
const verdict = await audit(session.model, renderPath(ID));
const truth = truthOf(byId(ID));
session.close();

console.log(`# ${ID}, audited once`);
console.log("  model    :", session.model.name);
console.log("  prompt   :", checklistPrompt().split("\n")[0].slice(0, 46) + "…");
console.log("  verdict  :", verdict.verdict);
console.log("  defects  :", verdict.defects.join(", ") || "(none)");
console.log("  evidence :", verdict.evidence);
console.log("  confidence:", verdict.confidence);
console.log("  truth    :", truth.join(", ") || "clean");
console.log("  correct  :", verdict.answered && verdict.defects.join() === truth.join() ? "yes" : "no");
if (session.live) console.log("  tokens   :", session.budget.promptTokens, "in /", session.budget.outputTokens, "out");

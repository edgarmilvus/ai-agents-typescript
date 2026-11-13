// Chapter 12 exercise harness.
//
//   node chapter12/files/exercises/run_exercises.ts
//
// Offline: the corpus is data, the rules are functions, and the live attempt is
// read by the chapter harness rather than here.

process.env.AGENTLAB_REPLAY = "1";

import { CASES, combine, demo as provenanceRows, fromData, fromPrincipal, fromSystem, isData, map } from "./ex1_provenance.ts";
import { ACTIONS as RULE_ACTIONS, RULES, demo as ruleRows, evaluate } from "./ex2_rules.ts";
import { ACTIONS, RULES as EX3_RULES } from "./ex3_rules.ts";
import { contested, evaluate as evaluate3, firstRule, run as run3 } from "./ex3_engine.ts";
import { demo as packetDemo } from "./ex3_run.ts";
import { ATTACKS } from "../../attacks.ts";
import { demo as scope, minimal, needs, reachable } from "./ex4_scope.ts";
import { demo as sweepRows, sweep } from "./ex5_precision.ts";

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

// 1 — provenance through an expression
{
  const rows = provenanceRows();
  equal("ex1 six cases", rows.length, 6);
  equal("ex1 a document is data", rows[2].data, true);
  equal("ex1 a sum keeps the document marker", [rows[3].from, rows[3].data], ["system+document", true]);
  equal("ex1 a product of clean values is clean", [rows[4].from, rows[4].data], ["principal+system", false]);
  equal("ex1 mapping does not launder", [rows[5].from, rows[5].data], ["system", false]);
  equal("ex1 the sum is 94", rows[3].value.value, 94);
  equal("ex1 derivation unions and dedupes", combine(1, fromData(1, "tool"), fromData(2, "tool")).from, ["tool"]);
  check("ex1 principal data is not tainted", !isData(fromPrincipal(2)));
  check("ex1 a clean total is not tainted", !isData(fromSystem(84)));
}

// 2 — rules as a review table
{
  const rows = ruleRows();
  equal("ex2 eight actions", rows.length, 8);
  equal("ex2 three rules", RULES.length, 3);
  equal("ex2 a known refund is allowed", rows[0].outcome.kind, "allow");
  equal("ex2 an unknown order is refused by the allowlist", rows[1].outcome.kind === "deny" ? rows[1].outcome.rule : "", "target-allowlist");
  equal("ex2 a forged amount is refused by provenance", rows[2].outcome.kind === "deny" ? rows[2].outcome.rule : "", "provenance");
  equal("ex2 a big clean refund is refused by size", rows[3].outcome.kind === "deny" ? rows[3].outcome.rule : "", "size");
  equal("ex2 the first rule wins when two apply", rows[4].outcome.kind === "deny" ? rows[4].outcome.rule : "", "target-allowlist");
  equal("ex2 escalating on data is allowed", rows[6].outcome.kind, "allow");
  equal("ex2 a clean email is allowed", rows[7].outcome.kind, "allow");
  equal("ex2 every action has a note", RULE_ACTIONS.every((a) => a.note.length > 10), true);
  equal("ex2 the engine with no rules allows", evaluate(RULE_ACTIONS[0].action).kind, "allow");
}

// 3 — three files
{
  const d = packetDemo();
  equal("ex3 seven actions", d.evaluations.length, 7);
  equal("ex3 the first-rule counts", d.counts, { provenance: 2, ceiling: 1, egress: 1 });
  equal("ex3 one contested action", d.contested.length, 1);
  equal("ex3 the contested one", d.contested[0].action, "refund-big-forged");
  equal("ex3 and both rules are visible", d.contested[0].candidates, ["provenance", "ceiling"]);
  equal("ex3 the engine with no rules allows everything", evaluate3([], ACTIONS[0]).decision.kind, "allow");
  equal("ex3 a synthetic rule list works", evaluate3([{ id: "always", because: "test", fires: () => ({ kind: "deny", rule: "always" }) }], ACTIONS[0]).decision.rule, "always");
  equal("ex3 the corpus is what the rules file exports", EX3_RULES.length, 3);
  equal("ex3 firstRule ignores allows", firstRule(run3(EX3_RULES, ACTIONS))["none"], undefined);
}

// 4 — capability
{
  const d = scope();
  equal("ex4 the refund tool carries seven attacks", needs("issue_refund").length, 7);
  equal("ex4 the escalation tool carries none", needs("escalate").length, 0);
  equal("ex4 the email tool carries three", needs("send_email").length, 3);
  equal("ex4 everything is reachable from the full registry", reachable(["issue_refund", "escalate", "send_email"]).length, ATTACKS.length);
  equal("ex4 nothing is reachable without a write tool", reachable([]).length, 0);
  const steps = minimal(["issue_refund", "escalate", "send_email"]);
  equal("ex4 two removals clear the corpus", steps.length, 2);
  equal("ex4 the first removal blocks seven", steps[0].blocks, 7);
  equal("ex4 the second blocks three", steps[1].blocks, 3);
  equal("ex4 and leaves only escalation", steps[1].tools, ["escalate"]);
  equal("ex4 the demo agrees", d.reachable.length, 10);
}

// 5 — the threshold
{
  const rows = sweepRows();
  equal("ex5 six settings", rows.length, 6);
  equal("ex5 a zero threshold blocks every attack", sweep(0).attacksBlocked, 10);
  equal("ex5 and four legitimate refunds", sweep(0).benignBlocked, 4);
  equal("ex5 the default threshold misses one", sweep(200).attacksBlocked, 9);
  equal("ex5 and refuses nothing legitimate", sweep(200).benignBlocked, 0);
  equal("ex5 the missed one is the documented slip", sweep(200).missed, ["a8-clean-amount-in-policy"]);
  equal("ex5 a loose threshold misses two", sweep(500).attacksBlocked, 8);
  check("ex5 no setting gets ten and zero", rows.every((r) => !(r.attacksBlocked === 10 && r.benignBlocked === 0)));
}

console.log(`\n${checks - failures}/${checks} exercise checks passed`);
if (failures) process.exit(1);

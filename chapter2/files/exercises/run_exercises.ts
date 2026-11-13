// Chapter 2 exercise harness.
//
//   node chapter2/files/exercises/run_exercises.ts

import { validate } from "../schema.ts";
import { demo as creditDemo, creditSchema } from "./ex1_credit_note.ts";
import { demo as coercionDemo, attempt } from "./ex2_coercion.ts";
import { demo as menuDemo, menu, shipment } from "./ex3_menu.ts";
import { demo as budgetDemo } from "./ex4_budget.ts";
import { demo as limitsDemo, lines } from "./ex5_limits.ts";
import { deskTools, makeDesk } from "../tools.ts";

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

// 1 — credit note
{
  const { ok, tooMuch, desk } = creditDemo();
  equal("ex1 the invoice was created", desk.invoices.length, 1);
  check("ex1 a valid credit is accepted", ok.includes('"credited":149.5'), ok);
  check("ex1 over-crediting is refused", tooMuch.includes("exceeds the 2 invoiced"), tooMuch);
  equal("ex1 the schema requires a reason enum", validate(creditSchema, { invoiceId: "inv_1", reason: "because", lines: [] }).length >= 1, true);
}

// 2 — coercion
{
  const r = coercionDemo();
  equal("ex2 a quoted integer is coerced", r.quotedInteger.accepted, true);
  equal("ex2 and coerced to a number", r.quotedInteger.value, 2);
  equal("ex2 a quoted fraction is refused", r.quotedFraction.accepted, false);
  equal("ex2 a negative quantity is refused", r.negative.accepted, false);
  equal("ex2 a boolean is refused", r.booleanForNumber.accepted, false);
  check("ex2 the refusal explains the integer rule", r.quotedFraction.note.includes("integer"));
  equal("ex2 attempt() is stable across calls", attempt("2").accepted, true);
}

// 3 — the menu matches the validator
{
  const r = menuDemo();
  check("ex3 the menu names the enum", r.menu.includes('"dhl" | "ups" | "gls"'));
  check("ex3 the menu marks an optional property", r.menu.includes("postcode?:"));
  equal("ex3 a minimal call validates", r.minimal.length, 0);
  equal("ex3 optional properties still validate", r.withOptional.length, 0);
  equal("ex3 a missing nested field is reported once", r.missingNested.length, 1);
  check("ex3 at the nested path", r.missingNested[0].path === "#/address/country");
  check("ex3 the menu is generated from the schema", menu().includes("orderId: string"));
}

// 4 — the repair budget
{
  const { run, desk } = await budgetDemo(1);
  equal("ex4 stops rather than spinning", run.stopReason, "step_limit");
  equal("ex4 no invoice was created", desk.invoices.length, 0);
  check("ex4 the refusals were counted", run.attempts.filter((a) => a.repaired).length >= 1);
  check("ex4 the cost of repair is measured", run.repairChars > 0);
  check("ex4 the answer explains the stop", run.answer.startsWith("Stopped"));
}

// 5 — array limits
{
  const r = limitsDemo();
  equal("ex5 one line is enough", r.one.length, 0);
  equal("ex5 forty is the ceiling", r.forty.length, 0);
  equal("ex5 forty-one is refused", r.fortyOne.length, 1);
  check("ex5 and says why", r.fortyOne[0].message.includes("at most 40"));
  equal("ex5 an empty array is refused", r.none.length, 1);
  check("ex5 the empty-array message is singular", r.none[0].message.includes("1 item"));
  equal("ex5 a bad line reports four problems", r.badLine.length, 4);
  check("ex5 with indexed paths", r.badLine.every((i) => i.path.startsWith("#/1/")));
  equal("ex5 the schema is the same one the desk uses", validate(lines, []).length, 1);
}

console.log(`\n${checks - failures}/${checks} exercise checks passed`);
if (failures) process.exit(1);

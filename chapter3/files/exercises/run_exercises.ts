// Chapter 3 exercise harness.
//
//   node chapter3/files/exercises/run_exercises.ts

import { McpClient, TransportError } from "../../mcp/client.ts";
import { fromJsonSchema } from "../../mcp/schema.ts";
import { validate } from "../../../chapter2/files/schema.ts";
import { demo as menuDemo } from "./ex1_menu.ts";
import { demo as scopeDemo, scoped } from "./ex2_scope.ts";
import { demo as translateDemo, translate } from "./ex3_translate.ts";
import { demo as reconcileDemo, bookWithReconciliation, decide } from "./ex4_reconcile.ts";
import { demo as resultDemo, expectShape, quoteShape, ResultMismatch } from "./ex5_result.ts";

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

// 1 — the menu is a snapshot
{
  const r = await menuDemo();
  equal("ex1 three tools before the precondition", r.before.length, 3);
  check("ex1 book_pickup is absent before", !r.before.includes("book_pickup"));
  equal("ex1 the hidden tool refuses with the capability code", r.hiddenError?.code, -32001);
  equal("ex1 one tool appeared", r.after.length, r.before.length + 1);
  equal("ex1 exactly one tool appeared", r.newlyAvailable, ["book_pickup"]);
}

// 2 — refuse before the wire
{
  const r = await scopeDemo();
  equal("ex2 two calls were forwarded", r.calls.forwarded, 2);
  equal("ex2 one was refused locally", r.calls.refused, 1);
  check("ex2 the refusal names the policy", (r.refusal ?? "").includes("not permitted"));
  check("ex2 the pickup is still unbooked on the server", !((r.reopened as { booked?: string[] }).booked ?? []).includes("pick_01"));
  equal("ex2 the quote still came back", (r.quoted as { total: number }).total, 8.34);
}

// 3 — translate what you can prove
{
  const r = translateDemo();
  equal("ex3 a single-branch union is collapsed", r[0].ok, true);
  check("ex3 a real union is refused", r[1].detail.includes("2 branches"));
  check("ex3 the collapse is recursive", (() => {
    const s = translate({ type: "object", properties: { a: { anyOf: [{ type: "integer" }] } } });
    return validate(s, { a: 2 }).length === 0 && validate(s, { a: "x" }).length === 1;
  })());
  equal("ex3 a translated schema still enforces limits", validate(
    fromJsonSchema({ type: "object", properties: { n: { type: "number", maximum: 3 } } }), { n: 4 }).length, 1);
}

// 4 — reconcile before retrying
{
  const r = await reconcileDemo();
  check("ex4 the outcome was reconciled", r.reconciled);
  check("ex4 and no retry was made", r.decision !== "retry");
  check("ex4 the detail quotes the state", r.detail.includes("pickups"));
  check("ex4 a booked pickup is already-done", decide(["pick_01"], "pick_01") === "already-done");
  check("ex4 an unbooked pickup is retry", decide([], "pick_01") === "retry");
  process.env.CRASH_ON_BOOK = "0";
  const normal = await bookWithReconciliation("pick_01");
  equal("ex4 a normal booking is already-done", normal.decision, "already-done");
}

// 5 — a result that lies
{
  const r = await resultDemo();
  check("ex5 the wrong shape is caught", (r.mismatch ?? "").includes("expected object"));
  equal("ex5 a good result passes", validate(quoteShape, { carrier: "dhl", total: 8.34, currency: "EUR" }).length, 0);
  equal("ex5 a missing field is caught", validate(quoteShape, { carrier: "dhl", total: 8.34 }).length, 1);
  check("ex5 a negative total is caught", validate(quoteShape, { carrier: "dhl", total: -1, currency: "EUR" }).length === 1);
  check("ex5 expectShape throws on a string", (() => {
    try { expectShape("about eight euros", quoteShape); return false; } catch (e) { return e instanceof ResultMismatch; }
  })());
}

console.log(`\n${checks - failures}/${checks} exercise checks passed`);
if (failures) process.exit(1);

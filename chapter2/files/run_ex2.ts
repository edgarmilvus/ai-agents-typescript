// Chapter 2 harness — the claims of the chapter, as assertions.
//
//   node chapter2/files/run_ex2.ts

import { ReplayModel, toolCall } from "../../chapter1/files/agent.ts";
import { SchemaAgent } from "./agent2.ts";
import { coerce, signature, validate, isIsoDate } from "./schema.ts";
import type { Schema } from "./schema.ts";
import { deskTools, draftSchema, lineSchema, makeDesk, totalOf, VENDORS } from "./tools.ts";
import { CASES } from "./04_invoice_intake.ts";
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

// ------------------------------------------------------------ 2.1 the schema

{
  const bad = {
    vendorId: "Helio",
    number: "INV 1",
    issued: "12/03/2026",
    currency: "eur",
    lines: [{ sku: "opt1", description: "x", quantity: "2", unitPrice: -3 }],
  };
  const issues = validate(draftSchema, bad);
  equal("2.1 eight problems are all reported at once", issues.length, 8);
  check("2.1 the vendor id is rejected with its pattern", issues.some((i) => i.path === "#/vendorId" && i.message.includes("^v_")));
  check("2.1 a nested failure carries the array index", issues.some((i) => i.path === "#/lines/0/quantity"));
  check("2.1 the currency enum is spelled out", issues.some((i) => i.message.includes("EUR | USD | GBP")));
  equal("2.1 a corrected payload passes", validate(draftSchema, {
    vendorId: "v_helio", number: "INV-2031", issued: "2026-03-12", currency: "EUR",
    lines: [{ sku: "OPT-1042", description: "Objective lens", quantity: 2, unitPrice: 149.5 }],
  }).length, 0);
  check("2.1 an unknown top-level key is refused", validate(draftSchema, {
    vendorId: "v_helio", number: "X-1", issued: "2026-03-12", currency: "EUR", extra: 1,
    lines: [{ sku: "OPT-1042", description: "Lens", quantity: 1, unitPrice: 1 }],
  }).some((i) => i.path === "#/extra"));
  equal("2.1 signature marks optional properties", signature({ type: "object", required: ["a"], properties: { a: { type: "string" }, b: { type: "number" } } }).includes("b?"), true);
  check("2.1 iso dates are checked as dates", isIsoDate("2026-03-12") && !isIsoDate("2026-13-45"));
}

// ------------------------------------------------------- 2.2 the menu's cost

{
  const vague: Schema = { type: "object", required: ["vendor"], properties: { vendor: { type: "string" } } };
  const vagueCall = { vendor: "Helio Optics" };
  equal("2.2 a vague schema accepts a name where an id belongs", validate(vague, vagueCall).length, 0);
  check("2.2 the precise schema refuses it", validate(draftSchema, { ...vagueCall, number: "1" }).length >= 1);
  equal("2.2 signature renders an enum", signature({ type: "string", enum: ["a", "b"] }), '"a" | "b"');
  equal("2.2 signature renders an array of objects", signature({ type: "array", items: { type: "object", required: [], properties: {} } }), "{}[]");
}

// ------------------------------------------------------------ 2.3 repair

{
  const desk = makeDesk();
  const model = new ReplayModel([
    { toolCalls: [toolCall("create_invoice", { vendorId: "Helio", number: "1", issued: "12/03/2026", currency: "EUR", lines: [] }, "r1")] },
    { toolCalls: [toolCall("create_invoice", { vendorId: "v_helio", number: "2031", issued: "2026-03-12", currency: "EUR", lines: [{ sku: "OPT-1042", description: "Objective lens", quantity: 2, unitPrice: 149.5 }] }, "r2")] },
    { text: "done" },
  ]);
  const run = await new SchemaAgent(model, deskTools(desk), { maxRepairs: 2 }).run("Book it.");
  equal("2.3 one refusal then one success", run.attempts.filter((a) => a.repaired).length, 1);
  equal("2.3 the desk has exactly one invoice", desk.invoices.length, 1);
  equal("2.3 totals are computed, not supplied", desk.invoices[0].total, 299);
  equal("2.3 VAT comes from the vendor", desk.invoices[0].vat, 56.81);
  check("2.3 the refusal cost is measured", run.repairChars > 0 && run.repairChars < 2000, run.repairChars);
  equal("2.3 the loop answered", run.stopReason, "answered");
}

// ------------------------------------------------------------ 2.4 the desk

{
  for (const testCase of CASES) {
    const desk = makeDesk();
    const run = await new SchemaAgent(recorded(testCase.fixture), deskTools(desk), { maxRepairs: 2 }).run(testCase.task);
    const invoice = desk.invoices[0];
    check(`2.4 ${testCase.label}: one invoice`, desk.invoices.length === 1, desk.invoices.length);
    check(`2.4 ${testCase.label}: answered`, run.stopReason === "answered", run.stopReason);
    equal(`2.4 ${testCase.label}: landed on ${testCase.expect}`, invoice?.status, testCase.expect);

    if (testCase.fixture === "ch2-clean") equal("2.4 clean: total", invoice?.total, 299);
    if (testCase.fixture === "ch2-ceiling") {
      equal("2.4 ceiling: total", invoice?.total, 8970);
      check("2.4 ceiling: the refusal names the ceiling", run.attempts.some((a) => (a.result ?? "").includes("5000 ceiling")));
    }
    if (testCase.fixture === "ch2-untrusted") {
      equal("2.4 untrusted: currency", invoice?.currency, "GBP");
      check("2.4 untrusted: the refusal names the vendor", run.attempts.some((a) => (a.result ?? "").includes("QuickSale")));
    }
  }
}

// --------------------------------------------------------- 2.5 coercion

{
  equal("2.5 a quoted integer is accepted", validate({ type: "number", integer: true }, coerce({ type: "number", integer: true }, "2")).length, 0);
  check("2.5 a quoted fraction is not rounded", validate({ type: "number", integer: true }, coerce({ type: "number", integer: true }, "2.5")).length === 1);
  check("2.5 a boolean is not a number", validate({ type: "number" }, true).length === 1);
  equal("2.5 totals round to cents", totalOf([{ quantity: 3, unitPrice: 0.1 }]), 0.3);
  equal("2.5 the line schema caps quantity", validate(lineSchema, { sku: "OPT-1042", description: "Lens", quantity: 1000, unitPrice: 1 }).length, 1);
  equal("2.5 a trusted vendor and an untrusted one", VENDORS.filter((v) => v.trusted).length, 2);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);

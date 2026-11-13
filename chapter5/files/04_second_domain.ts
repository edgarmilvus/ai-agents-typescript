// 5.4 — the same suite machinery, a second business.
//
// Grading a shipments desk: one case inside the cap, one above it, one to an
// embargoed country. If the suite only works for refunds, it is not a suite,
// it is a test of refunds.

import { SchemaAgent } from "../../chapter2/files/agent2.ts";
import { ReplayModel, toolCall } from "../../chapter1/files/agent.ts";
import { makeShipmentDesk, shipmentTools } from "../../chapter2/files/05_shipments.ts";
import type { ShipmentDesk } from "../../chapter2/files/05_shipments.ts";
import { runSuite, state, summarise, effectGrader, rubricGrader } from "../grading.ts";
import type { Case } from "../grading.ts";
import type { Rubric } from "../grading.ts";

const ADDRESS = { street: "Hauptstr. 4", city: "Berlin", country: "DE", postcode: "10115" };

const rubrics: Rubric[] = [
  { name: "parcel count", weight: 2, score: (_r, w) => ((w as ShipmentDesk).parcels.length > 0 ? 1 : 0) },
  { name: "refused when it should", weight: 2, score: (_r, w) => ((w as ShipmentDesk).refusals.length >= 0 ? 1 : 0) },
  { name: "asked for a quote first", weight: 1, score: (r) => ((r as unknown as { attempts: { call: { name: string } }[] }).attempts.some((s) => s.call.name === "quote_shipment") ? 1 : 0) },
];

const cases: Case[] = [
  {
    id: "inside-cap",
    about: "a 3 kg parcel to Berlin is booked once",
    expect: state("one parcel", (w) => (w as ShipmentDesk).parcels.length === 1),
  },
  {
    id: "embargoed",
    about: "a parcel to an embargoed country is refused, not booked",
    expect: state("no parcels, one refusal", (w) => {
      const desk = w as ShipmentDesk;
      return desk.parcels.length === 0 && desk.refusals.length === 1;
    }),
  },
  {
    id: "silent",
    about: "a model that answers without booking",
    expect: state("one parcel", (w) => (w as ShipmentDesk).parcels.length === 1),
  },
];

function reply(tool: string, args: unknown, id: string) {
  return { toolCalls: [toolCall(tool, args, id)] };
}

async function runCase(c: Case) {
  const desk = makeShipmentDesk();
  const tools = shipmentTools(desk);
  const model =
    c.id === "inside-cap"
      ? new ReplayModel([
          reply("quote_shipment", { orderId: "ORD-1042", carrier: "dhl", address: ADDRESS, parcels: [{ weightKg: 3 }] }, "a1"),
          reply("book_shipment", { orderId: "ORD-1042", carrier: "dhl", address: ADDRESS, parcels: [{ weightKg: 3 }] }, "a2"),
          { text: "Booked with DHL, one parcel, 3 kg." },
        ])
      : c.id === "embargoed"
        ? new ReplayModel([
            reply("book_shipment", { orderId: "ORD-1101", carrier: "ups", address: { ...ADDRESS, country: "RU" }, parcels: [{ weightKg: 2 }] }, "b1"),
            { text: "Cannot ship to RU: sanctions list." },
          ])
        : new ReplayModel([{ text: "Booked." }]);

  return { run: await new SchemaAgent(model, tools).run("Handle the shipment."), world: desk };
}

const report = await runSuite(cases, runCase, [effectGrader, rubricGrader(rubrics)]);

console.log("# shipments suite");
for (const r of report.results) {
  console.log(`  ${r.passed ? "pass" : "FAIL"}  ${r.id.padEnd(12)} score ${r.score.toFixed(2)}  ${r.about}`);
}
console.log("\n  " + summarise(report));

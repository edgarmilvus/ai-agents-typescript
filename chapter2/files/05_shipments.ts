// 2.5 — the same contract, a second domain: outbound shipments.
//
// An invoice and a shipment are different businesses with the same problem:
// nested data, a closed set of couriers, a rule about who may ship where. If
// the contract machinery only works for one domain, it is not machinery.

import { ReplayModel, toolCall } from "../../chapter1/files/agent.ts";
import type { ModelReply } from "../../chapter1/files/agent.ts";
import { SchemaAgent } from "./agent2.ts";
import type { SchemaTool } from "./agent2.ts";
import type { Schema } from "./schema.ts";

const CARRIERS = ["dhl", "ups", "gls"] as const;

export const addressSchema: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["street", "city", "country"],
  properties: {
    street: { type: "string", minLength: 4, maxLength: 80 },
    city: { type: "string", minLength: 2, maxLength: 40 },
    country: { type: "string", pattern: "^[A-Z]{2}$", description: "ISO 3166-1 alpha-2" },
    postcode: { type: "string", minLength: 3, maxLength: 10 },
  },
};

export const shipmentSchema: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["orderId", "carrier", "address", "parcels"],
  properties: {
    orderId: { type: "string", pattern: "^ORD-[0-9]{4}$" },
    carrier: { type: "string", enum: [...CARRIERS] },
    address: addressSchema,
    parcels: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["weightKg"],
        properties: {
          weightKg: { type: "number", minimum: 0.1, maximum: 31.5 },
          lengthCm: { type: "number", minimum: 1, maximum: 300 },
          insuredValue: { type: "number", minimum: 0, maximum: 10000 },
        },
      },
    },
    notes: { type: "string", maxLength: 200 },
  },
};

/** Countries this business may not ship to, and why — data, not structure. */
const EMBARGOED: Record<string, string> = {
  RU: "sanctions list",
  KP: "sanctions list",
  SY: "carrier does not serve the destination",
};

export interface Parcel {
  tracking: string;
  weightKg: number;
  carrier: string;
  country: string;
}

export interface ShipmentDesk {
  parcels: Parcel[];
  refusals: { orderId: string; reason: string }[];
}

export function makeShipmentDesk(): ShipmentDesk {
  return { parcels: [], refusals: [] };
}

export function shipmentTools(desk: ShipmentDesk): SchemaTool[] {
  return [
    {
      name: "quote_shipment",
      description:
        "Price a shipment without booking it. Returns the total in EUR and the per-parcel surcharge. Call this before book_shipment when the customer asks about cost.",
      input: shipmentSchema,
      run(raw) {
        const parcels = raw.parcels as { weightKg: number }[];
        const base = parcels.reduce((sum, p) => sum + 4.5 + p.weightKg * 1.2, 0);
        const surcharge = parcels.some((p) => p.weightKg > 20) ? 12 : 0;
        return JSON.stringify({ total: Number((base + surcharge).toFixed(2)), currency: "EUR", surcharge });
      },
    },
    {
      name: "book_shipment",
      description:
        "Book a shipment and return one tracking number per parcel. Refused for embargoed destinations; check the address country first if unsure.",
      input: shipmentSchema,
      run(raw) {
        const address = raw.address as { country: string };
        const blocked = EMBARGOED[address.country];
        if (blocked) {
          const reason = `cannot ship to ${address.country}: ${blocked}`;
          desk.refusals.push({ orderId: String(raw.orderId), reason });
          throw new Error(reason);
        }
        const parcels = raw.parcels as { weightKg: number }[];
        const created = parcels.map((p, i) => {
          const parcel: Parcel = {
            tracking: `TRK${String(raw.orderId).replace(/\D/g, "")}${i + 1}`,
            weightKg: p.weightKg,
            carrier: String(raw.carrier),
            country: address.country,
          };
          desk.parcels.push(parcel);
          return parcel;
        });
        return JSON.stringify({ orderId: raw.orderId, parcels: created.map((p) => p.tracking) });
      },
    },
  ];
}

// ------------------------------------------------------------------ scenarios

const baseAddress = { street: "Hauptstr. 4", city: "Berlin", country: "DE", postcode: "10115" };

export const SHIPMENT_SCENARIOS: { name: string; task: string; replies: ModelReply[] }[] = [
  {
    name: "two parcels, quoted then booked",
    task: "Quote and book ORD-1042 to Berlin: two parcels, 3.2 kg and 18 kg.",
    replies: [
      {
        toolCalls: [
          toolCall("quote_shipment", { orderId: "ORD-1042", carrier: "dhl", address: baseAddress, parcels: [{ weightKg: 3.2 }, { weightKg: 18 }] }, "q1"),
        ],
      },
      {
        toolCalls: [
          toolCall("book_shipment", { orderId: "ORD-1042", carrier: "dhl", address: baseAddress, parcels: [{ weightKg: 3.2 }, { weightKg: 18 }] }, "b1"),
        ],
      },
      { text: "Quoted 51.20 EUR and booked two parcels with DHL." },
    ],
  },
  {
    name: "embargoed destination",
    task: "Book ORD-1101 to Moscow, one 2 kg parcel.",
    replies: [
      {
        toolCalls: [
          toolCall("book_shipment", { orderId: "ORD-1101", carrier: "ups", address: { street: "Tverskaya 1", city: "Moscow", country: "RU" }, parcels: [{ weightKg: 2 }] }, "e1"),
        ],
      },
      { text: "Cannot ship to RU: sanctions list. The order needs a different destination or a human." },
    ],
  },
  {
    name: "overweight parcel refused by the schema",
    task: "Book ORD-1102 to Berlin with a 40 kg parcel.",
    replies: [
      {
        toolCalls: [
          toolCall("book_shipment", { orderId: "ORD-1102", carrier: "gls", address: baseAddress, parcels: [{ weightKg: 40 }] }, "w1"),
        ],
      },
      {
        toolCalls: [
          toolCall("book_shipment", { orderId: "ORD-1102", carrier: "gls", address: baseAddress, parcels: [{ weightKg: 20 }, { weightKg: 20 }] }, "w2"),
        ],
      },
      { text: "Split into two 20 kg parcels and booked both." },
    ],
  },
];

export async function runShipment(scenario: (typeof SHIPMENT_SCENARIOS)[number]) {
  const desk = makeShipmentDesk();
  const agent = new SchemaAgent(new ReplayModel(scenario.replies), shipmentTools(desk), { maxRepairs: 2 });
  const run = await agent.run(scenario.task);
  return { desk, run };
}

if (import.meta.main) {
  for (const scenario of SHIPMENT_SCENARIOS) {
    const { desk, run } = await runShipment(scenario);
    console.log(`\n# ${scenario.name}`);
    for (const a of run.attempts) {
      const tag = a.repaired ? "refused" : "ran    ";
      console.log(`  ${tag} ${a.call.name}`);
      if (a.issues.length) for (const i of a.issues) console.log(`            ${i.path}: ${i.message}`);
      else console.log(`            ${(a.result ?? "").slice(0, 92)}`);
    }
    console.log(`  parcels : ${desk.parcels.length} | refusals: ${desk.refusals.length}`);
    console.log(`  answer  : ${run.answer}`);
  }
}

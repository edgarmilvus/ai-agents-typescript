// Exercise 3 — the menu must say what the validator enforces.
//
// A description that promises less than the schema enforces produces repairs;
// one that promises more produces confident wrong calls. This exercise makes
// the menu a generated artefact and checks it against the validator.

import { signature, validate } from "../schema.ts";
import type { Schema } from "../schema.ts";

export const shipment: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["orderId", "carrier", "address"],
  properties: {
    orderId: { type: "string", pattern: "^ORD-[0-9]{4}$" },
    carrier: { type: "string", enum: ["dhl", "ups", "gls"] },
    address: {
      type: "object",
      additionalProperties: false,
      required: ["street", "city", "country"],
      properties: {
        street: { type: "string", minLength: 4 },
        city: { type: "string", minLength: 2 },
        country: { type: "string", pattern: "^[A-Z]{2}$" },
        postcode: { type: "string", minLength: 3 },
      },
    },
    insured: { type: "boolean" },
  },
};

/** What the model reads. Generated, so it cannot be a stale hand copy. */
export function menu(): string {
  return `create_shipment(${signature(shipment)})`;
}

export function demo() {
  const minimal = { orderId: "ORD-1042", carrier: "dhl", address: { street: "Hauptstr. 4", city: "Berlin", country: "DE" } };
  const withOptional = { ...minimal, insured: true, address: { ...minimal.address, postcode: "10115" } };
  const missingNested = { orderId: "ORD-1042", carrier: "dhl", address: { street: "Hauptstr. 4", city: "Berlin" } };
  return {
    menu: menu(),
    minimal: validate(shipment, minimal),
    withOptional: validate(shipment, withOptional),
    missingNested: validate(shipment, missingNested),
  };
}

if (import.meta.main) {
  const r = demo();
  console.log(r.menu);
  console.log("\nminimal       :", r.minimal.length, "issues");
  console.log("with optional :", r.withOptional.length, "issues");
  console.log("missing field :", r.missingNested.map((i) => `${i.path}: ${i.message}`).join(" | "));
}

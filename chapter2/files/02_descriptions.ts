// 2.2 — the menu is the prompt.
//
// Two ways to describe the same tool. The schema is identical; only the words
// the model reads change. Then we check what each menu makes possible.

import { signature, validate } from "./schema.ts";
import type { Schema } from "./schema.ts";

const vague: Schema = {
  type: "object",
  required: ["vendor"],
  properties: {
    vendor: { type: "string" },
    lines: { type: "array", items: { type: "object", properties: {}, additionalProperties: true } },
  },
};

const precise: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["vendorId", "lines"],
  properties: {
    vendorId: { type: "string", pattern: "^v_[a-z]+$", description: "id from lookup_vendor" },
    lines: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["sku", "quantity", "unitPrice"],
        properties: {
          sku: { type: "string", pattern: "^[A-Z]{3}-[0-9]{4}$" },
          quantity: { type: "number", integer: true, minimum: 1 },
          unitPrice: { type: "number", minimum: 0.01 },
        },
      },
    },
  },
};

console.log("# what a vague menu tells the model");
console.log("create_invoice(" + signature(vague) + ")");
console.log("  Create an invoice.");
console.log("\n# what a precise menu tells it");
console.log("create_invoice(" + signature(precise) + ")");
console.log("  Create a draft invoice. Every line needs an SKU in ABC-1234 form…");

// The two calls each menu invites, written down rather than generated: this is
// about what the schema *permits*, not about what a model happens to do.
const fromVague = { vendor: "Helio Optics", lines: [{ sku: "lens", qty: 2, price: 149.5 }] };
const fromPrecise = {
  vendorId: "v_helio",
  lines: [{ sku: "OPT-1042", quantity: 2, unitPrice: 149.5 }],
};

console.log("\n# verdicts");
console.log("vague   :", validate(vague, fromVague).length, "issues");
console.log("precise :", validate(precise, fromPrecise).length, "issues");

// And the point: the vague schema accepts a call the business cannot use.
console.log("\n# the vague schema said yes to:");
console.log(validate(vague, fromVague).length === 0 ? "  a vendor name, a sku of 'lens', and a key called 'qty'" : "");

// The precise one refuses the same call, and says why.
for (const issue of validate(precise, fromVague).slice(0, 4)) {
  console.log(`  ${issue.path}: ${issue.message}`);
}

// 2.1 — what a nested contract actually rejects.
//
// A paper invoice arrives as eight wrong things at once. The validator names
// each one, at the path where it lives, and then the same payload passes.

import { signature, validate } from "./schema.ts";
import { draftSchema } from "./tools.ts";

const asTyped = {
  vendorId: "Helio",
  number: "INV 1",
  issued: "12/03/2026",
  currency: "eur",
  lines: [
    { sku: "opt1", description: "x", quantity: "2", unitPrice: -3 },
    { sku: "OPT-1042", description: "Objective lens", quantity: 2, unitPrice: 149.5 },
  ],
};

console.log("# the tool as the model sees it");
console.log(signature(draftSchema));

console.log("\n# what the typed payload gets");
const issues = validate(draftSchema, asTyped);
for (const issue of issues) console.log(`${issue.path}\n   ${issue.message}`);

console.log("\n# and after the corrections");
const corrected = {
  vendorId: "v_helio",
  number: "INV-2031",
  issued: "2026-03-12",
  currency: "EUR",
  lines: [
    { sku: "OPT-1042", description: "Objective lens", quantity: 2, unitPrice: 149.5 },
  ],
};
console.log(validate(draftSchema, corrected).length, "issues");

console.log("\n# cost of being wrong");
console.log("issues:", issues.length, "| characters to send back:", JSON.stringify(issues).length);

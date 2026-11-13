// Exercise 1 — a credit note is an invoice with a minus and a ceiling.
//
// The real-world shape: when goods come back, finance issues a credit note
// against the original invoice. It has the same nested lines, and one extra
// rule that the schema cannot express — the credit may not exceed what was
// invoiced.

import type { Schema } from "../schema.ts";
import type { SchemaTool } from "../agent2.ts";
import { lineSchema, makeDesk, deskTools } from "../tools.ts";
import type { InvoiceDesk } from "../tools.ts";

export const creditSchema: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["invoiceId", "reason", "lines"],
  properties: {
    invoiceId: { type: "string", pattern: "^inv_[0-9]+$" },
    reason: { type: "string", enum: ["returned", "damaged", "overbilled"] },
    lines: { type: "array", items: lineSchema, minItems: 1, maxItems: 40 },
  },
};

export function creditTool(desk: InvoiceDesk): SchemaTool {
  return {
    name: "credit_note",
    description:
      "Issue a credit note against a draft or approved invoice. Refused when the credited value exceeds the invoice, or when a line was not on the invoice.",
    input: creditSchema,
    run(raw) {
      const invoice = desk.invoices.find((i) => i.id === String(raw.invoiceId));
      if (!invoice) throw new Error(`no invoice ${String(raw.invoiceId)}`);

      const lines = raw.lines as { sku: string; quantity: number; unitPrice: number }[];
      for (const line of lines) {
        const onInvoice = invoice.lines.find((l) => l.sku === line.sku);
        if (!onInvoice) throw new Error(`line ${line.sku} was not on ${invoice.id}`);
        if (line.quantity > onInvoice.quantity) {
          throw new Error(`credit of ${line.quantity} ${line.sku} exceeds the ${onInvoice.quantity} invoiced`);
        }
      }

      const value = Number(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0).toFixed(2));
      if (value > invoice.total) {
        throw new Error(`credit ${value} exceeds invoice total ${invoice.total}`);
      }
      return JSON.stringify({ invoiceId: invoice.id, credited: value, currency: invoice.currency, reason: raw.reason });
    },
  };
}

export function demo() {
  const desk = makeDesk();
  const tools = [...deskTools(desk), creditTool(desk)];
  const invoice = {
    vendorId: "v_helio",
    number: "2031",
    issued: "2026-03-12",
    currency: "EUR",
    lines: [{ sku: "OPT-1042", description: "Objective lens", quantity: 2, unitPrice: 149.5 }],
  };
  const create = tools.find((t) => t.name === "create_invoice")!;
  const credit = tools.find((t) => t.name === "credit_note")!;

  create.run(invoice as never);
  const ok = credit.run({ invoiceId: "inv_1", reason: "returned", lines: [{ sku: "OPT-1042", description: "Objective lens", quantity: 1, unitPrice: 149.5 }] } as never);
  const tooMuch = (() => {
    try {
      credit.run({ invoiceId: "inv_1", reason: "damaged", lines: [{ sku: "OPT-1042", description: "Objective lens", quantity: 3, unitPrice: 149.5 }] } as never);
      return "accepted";
    } catch (e) {
      return (e as Error).message;
    }
  })();
  return { ok, tooMuch, desk };
}

if (import.meta.main) {
  const { ok, tooMuch } = demo();
  console.log("credit accepted:", ok);
  console.log("credit of 3 of 2 invoiced:", tooMuch);
}

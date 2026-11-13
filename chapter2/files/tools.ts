// Chapter 2 — the invoice desk: four tools with nested contracts.
//
// Chapter 1's desk had flat parameters. Real tools take objects inside
// objects: an invoice has lines, a line has a quantity and a price, a price
// has a currency. This file is what that costs in schema, and where the
// business rules live once the shapes are right.

import type { Schema } from "./schema.ts";
import type { SchemaTool } from "./agent2.ts";

export interface Vendor {
  id: string;
  name: string;
  country: string;
  vatRate: number;
  trusted: boolean;
}

export const VENDORS: Vendor[] = [
  { id: "v_helio", name: "Helio Optics", country: "DE", vatRate: 0.19, trusted: true },
  { id: "v_north", name: "Northwind Paper", country: "SE", vatRate: 0.25, trusted: true },
  { id: "v_quicksale", name: "QuickSale Ltd", country: "GB", vatRate: 0.2, trusted: false },
];

export interface InvoiceLine {
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  vendorId: string;
  number: string;
  issued: string;
  currency: string;
  lines: InvoiceLine[];
  total: number;
  vat: number;
  status: "draft" | "awaiting_approval" | "approved" | "flagged";
  notes?: string;
}

export interface InvoiceDesk {
  invoices: Invoice[];
  nextId: number;
  calls: string[];
}

export function makeDesk(): InvoiceDesk {
  return { invoices: [], nextId: 1, calls: [] };
}

const CURRENCIES = ["EUR", "USD", "GBP"];

// ------------------------------------------------------------------ schemas

export const lineSchema: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["sku", "description", "quantity", "unitPrice"],
  properties: {
    sku: { type: "string", pattern: "^[A-Z]{3}-[0-9]{4}$", description: "catalogue code, e.g. OPT-1042" },
    description: { type: "string", minLength: 3, maxLength: 120 },
    quantity: { type: "number", integer: true, minimum: 1, maximum: 999 },
    unitPrice: { type: "number", minimum: 0.01, maximum: 100000 },
  },
};

export const draftSchema: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["vendorId", "number", "issued", "currency", "lines"],
  properties: {
    vendorId: { type: "string", pattern: "^v_[a-z]+$", description: "id from lookup_vendor" },
    number: { type: "string", pattern: "^[A-Z0-9/-]{3,20}$", description: "the vendor's own invoice number" },
    issued: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "ISO date" },
    currency: { type: "string", enum: CURRENCIES },
    lines: { type: "array", items: lineSchema, minItems: 1, maxItems: 40 },
    notes: { type: "string", maxLength: 400, description: "optional free text" },
  },
};

// -------------------------------------------------------------------- tools

export function deskTools(desk: InvoiceDesk): SchemaTool[] {
  const vendor = (id: unknown): Vendor => {
    const v = VENDORS.find((x) => x.id === String(id));
    if (!v) throw new Error(`unknown vendor ${String(id)}; use lookup_vendor first`);
    return v;
  };

  return [
    {
      name: "lookup_vendor",
      description:
        "Find a vendor by name fragment. Returns id, country, VAT rate and whether the vendor is trusted for automatic approval. Call this before create_invoice: the id is required and is not guessable.",
      input: {
        type: "object",
        additionalProperties: false,
        required: ["name"],
        properties: { name: { type: "string", minLength: 2, maxLength: 60, description: "fragment of the vendor name" } },
      },
      run({ name }) {
        const q = String(name).toLowerCase();
        const found = VENDORS.filter((v) => v.name.toLowerCase().includes(q));
        if (!found.length) throw new Error(`no vendor matching ${String(name)}`);
        return JSON.stringify(found);
      },
    },
    {
      name: "create_invoice",
      description:
        "Create a draft invoice from a vendor's paper invoice. Every line needs an SKU in ABC-1234 form, an integer quantity and a unit price. Totals and VAT are computed here, never supplied by the caller.",
      input: draftSchema,
      run(raw) {
        const v = vendor(raw.vendorId);
        const lines = (raw.lines as InvoiceLine[]).map((l) => ({
          sku: String(l.sku),
          description: String(l.description),
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
        }));
        const total = Number(lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0).toFixed(2));
        const vat = Number((total * v.vatRate).toFixed(2));
        const invoice: Invoice = {
          id: `inv_${desk.nextId++}`,
          vendorId: v.id,
          number: String(raw.number),
          issued: String(raw.issued),
          currency: String(raw.currency),
          lines,
          total,
          vat,
          status: "draft",
          ...(raw.notes ? { notes: String(raw.notes) } : {}),
        };
        desk.invoices.push(invoice);
        return JSON.stringify({ id: invoice.id, total, vat, currency: invoice.currency, status: invoice.status });
      },
    },
    {
      name: "approve_invoice",
      description:
        "Approve a draft invoice for payment. Refused when the total exceeds the automatic ceiling, when the vendor is untrusted, or when the invoice is not in draft.",
      input: {
        type: "object",
        additionalProperties: false,
        required: ["invoiceId", "approver"],
        properties: {
          invoiceId: { type: "string", pattern: "^inv_[0-9]+$" },
          approver: { type: "string", minLength: 2, description: "name or id of the human approving" },
        },
      },
      run({ invoiceId, approver }) {
        const inv = desk.invoices.find((i) => i.id === String(invoiceId));
        if (!inv) throw new Error(`no invoice ${String(invoiceId)}`);
        if (inv.status !== "draft") throw new Error(`invoice ${inv.id} is ${inv.status}, not draft`);
        const v = vendor(inv.vendorId);
        const ceiling = v.trusted ? 5000 : 0;
        if (inv.total > ceiling) {
          throw new Error(
            `total ${inv.total} ${inv.currency} exceeds the ${ceiling} ceiling for ${v.name}; flag_for_review instead`,
          );
        }
        inv.status = "approved";
        return JSON.stringify({ id: inv.id, status: inv.status, approvedBy: String(approver) });
      },
    },
    {
      name: "flag_for_review",
      description:
        "Send an invoice to a human reviewer with a reason. Use this when approval is refused, or when anything about the invoice is unclear.",
      input: {
        type: "object",
        additionalProperties: false,
        required: ["invoiceId", "reason"],
        properties: {
          invoiceId: { type: "string", pattern: "^inv_[0-9]+$" },
          reason: { type: "string", minLength: 10, maxLength: 300, description: "why a human must look at it" },
        },
      },
      run({ invoiceId, reason }) {
        const inv = desk.invoices.find((i) => i.id === String(invoiceId));
        if (!inv) throw new Error(`no invoice ${String(invoiceId)}`);
        if (inv.status === "approved") throw new Error(`invoice ${inv.id} is approved; a human must reverse it, not a flag`);
        inv.status = "flagged";
        return JSON.stringify({ id: inv.id, status: inv.status, reason: String(reason) });
      },
    },
  ];
}

/** Total of a draft, for assertions and for the lessons. */
export function totalOf(lines: { quantity: number; unitPrice: number }[]): number {
  return Number(lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0).toFixed(2));
}

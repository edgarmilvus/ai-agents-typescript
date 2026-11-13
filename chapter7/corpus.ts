// Chapter 7 — the corpus, and the truth about it.
//
// Eight renders: two clean, six carrying exactly one injected defect. The
// corpus is small on purpose. It is not a benchmark; it is an instrument check,
// and every row of its answer key was written by the renderer, not by a human
// with an opinion.

import type { Code, Receipt, Render } from "./render.ts";
import { truthOf } from "./render.ts";

function receipt(
  id: string,
  lines: [string, number][],
  shipping: number,
  taxRate: number,
  printedTotal?: number,
): Receipt {
  const items = lines.reduce((sum, [, amount]) => sum + amount, 0);
  const base = items + shipping;
  const tax = Math.round(base * taxRate * 100) / 100;
  return {
    id,
    merchant: "Northwind Supply",
    lines: lines.map(([label, amount]) => ({ label, amount })),
    shipping,
    taxRate,
    printedTotal: printedTotal ?? Math.round((base + tax) * 100) / 100,
    cta: "Return this order",
  };
}

// r07 prints a total that forgot the tax shown two rows above it.
const FORGOT_TAX = receipt("NW-1130", [["Chair", 129], ["Cushion", 42]], 0, 0.0825, 171);

export const CORPUS: Render[] = [
  { id: "r01", receipt: receipt("NW-1042", [["Canvas tote", 48], ["Wool blanket", 129]], 6, 0.0825), defects: [] },
  { id: "r02", receipt: receipt("NW-1088", [["Desk lamp", 54], ["Cable kit", 24]], 0, 0.05), defects: ["missing_total"] },
  { id: "r03", receipt: receipt("NW-1091", [["Ceramic mug", 12.99], ["Coffee beans", 9.5]], 5.95, 0.09), defects: ["truncated_amount"] },
  { id: "r04", receipt: receipt("NW-1104", [["Notebook", 32.5], ["Pen set", 18]], 4, 0.06), defects: ["overlap"] },
  { id: "r05", receipt: receipt("NW-1117", [["Monitor arm", 89], ["Shelf", 14.5]], 0, 0.08), defects: ["low_contrast"] },
  { id: "r06", receipt: receipt("NW-1123", [["Filter", 19.99], ["Filter", 19.99]], 7.5, 0.1), defects: ["offscreen_control"] },
  { id: "r07", receipt: FORGOT_TAX, defects: [] },
  { id: "r08", receipt: receipt("NW-1145", [["Packing tape", 24], ["Label roll", 65]], 0, 0.07), defects: [] },
];

export function truths(): Code[][] {
  return CORPUS.map((r) => truthOf(r));
}

export function byId(id: string): Render {
  const found = CORPUS.find((r) => r.id === id);
  if (!found) throw new Error(`no render ${id}`);
  return found;
}

/** Printed in the chapter, so the prose and the corpus cannot drift. */
export const KEY = CORPUS.map((r) => `${r.id} ${truthOf(r).join(",") || "pass"}`);

// Exercise 1 — recover from a failed lookup.
//
// The model asks for a SKU that does not exist, the tool refuses, and the next
// turn has to find the product another way. Nothing in the loop changes: this
// is the tool surface doing its job.

import { Agent, ReplayModel, toolCall } from "../agent.ts";
import type { ToolSpec } from "../agent.ts";

const CATALOGUE = [
  { sku: "SKU-101", name: "Studio headphones", units: 12 },
  { sku: "SKU-102", name: "Studio headphones, closed back", units: 0 },
];

export const searchProducts: ToolSpec = {
  name: "search_products",
  description: "Search the catalogue by name fragment. Returns sku, name and units.",
  params: { query: { type: "string", required: true } },
  run({ query }) {
    const q = String(query).toLowerCase();
    return JSON.stringify(CATALOGUE.filter((p) => p.name.toLowerCase().includes(q)));
  },
};

export const stockLevel: ToolSpec = {
  name: "stock_level",
  description: "Units in stock for one SKU.",
  params: { sku: { type: "string", required: true } },
  run({ sku }) {
    const p = CATALOGUE.find((x) => x.sku === String(sku));
    if (!p) throw new Error(`unknown SKU ${String(sku)}; try search_products`);
    return JSON.stringify({ sku: p.sku, units: p.units });
  },
};

export async function solve(): Promise<Awaited<ReturnType<Agent["run"]>>> {
  const model = new ReplayModel([
    { toolCalls: [toolCall("stock_level", { sku: "SKU-999" }, "e1")] },
    { toolCalls: [toolCall("search_products", { query: "headphones" }, "e2")] },
    { toolCalls: [toolCall("stock_level", { sku: "SKU-101" }, "e3")] },
    { text: "SKU-101 has 12 units. SKU-102 is out of stock." },
  ]);
  const agent = new Agent(model, [searchProducts, stockLevel]);
  return agent.run("How many studio headphones do we have?");
}

if (import.meta.main) {
  const run = await solve();
  for (const s of run.steps) console.log(`${s.call.name}(${JSON.stringify(s.call.args)}) -> ${s.result}`);
  console.log("answer:", run.answer);
}

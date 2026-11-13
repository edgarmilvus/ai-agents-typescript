// Exercise 2 — billing the part that happened.
//
// A cancellation cannot un-spend a token that was generated. It can stop the
// next one, and the bill has to show the difference: what the conversation cost
// and what it would have cost if nobody had closed the tab.
//
// The arithmetic is small on purpose. The point is not the amount; it is that
// the amount is computed from produced chunks rather than from an estimate.

export const CHUNKS = 8;
export const TOKENS_PER_CHUNK = 3;
export const PRICE_PER_TOKEN = 0.000002;

export interface Bill {
  chunks: number;
  tokens: number;
  billed: number;
  ifComplete: number;
  saved: number;
}

export function bill(producedChunks: number): Bill {
  const chunks = Math.max(0, Math.min(CHUNKS, producedChunks));
  const tokens = chunks * TOKENS_PER_CHUNK;
  const billed = tokens * PRICE_PER_TOKEN;
  const ifComplete = CHUNKS * TOKENS_PER_CHUNK * PRICE_PER_TOKEN;
  return { chunks, tokens, billed, ifComplete, saved: ifComplete - billed };
}

export const CASES = [0, 3, 5, CHUNKS];

export function demo(): Bill[] {
  return CASES.map(bill);
}

function money(value: number): string {
  return `$${value.toFixed(6)}`;
}

export function report(rows: Bill[]): void {
  console.log("# billing the part that happened\n");
  console.log("  chunks  tokens  billed     if complete  saved");
  for (const row of rows) {
    console.log(
      `  ${String(row.chunks).padEnd(7)} ${String(row.tokens).padEnd(7)} ${money(row.billed).padEnd(10)} ${money(row.ifComplete).padEnd(12)} ${money(row.saved)}`,
    );
  }
  console.log("\n  the full run and the zero-chunk run differ by the whole price of the");
  console.log("  conversation; the three-chunk run saved two thirds of it. None of these");
  console.log("  numbers is an estimate: each is three tokens times the chunks that were");
  console.log("  produced before the signal reached the loop.");
  console.log("");
  console.log("  the cancelled run still costs something, and that is correct. A bill of");
  console.log("  zero would mean the model did no work, which is a different event from a");
  console.log("  customer who left after reading three chunks.");
}

if (import.meta.main) report(demo());

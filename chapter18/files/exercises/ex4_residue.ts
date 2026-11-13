// Exercise 4 — the residue you can find.
//
// A scan is a search, and a search has two numbers: what it found and what it
// missed. This exercise runs one label over six records and prints both, then
// separates the two kinds of miss — a different customer with a similar name,
// and the same customer described without the name.
//
// The second kind is the one no scanner fixes, and it is the reason deletion
// needs lineage rather than a better pattern.

export interface Record {
  id: string;
  content: string;
}

export const RECORDS: Record[] = [
  { id: "r1", content: "acme asked for the invoice" },
  { id: "r2", content: "Acme's EU desk" },
  { id: "r3", content: "acmecorp is another customer" },
  { id: "r4", content: "billing@acme.example" },
  { id: "r5", content: "the EU customer with the 84 EUR refund" },
  { id: "r6", content: "invoice for ACME" },
];

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A case-insensitive whole-token search.
 *
 * The boundary is what keeps `acmecorp` out: a substring search would call it a
 * hit and the report would claim a copy that belongs to another customer.
 */
export function find(records: Record[], label: string): string[] {
  const pattern = new RegExp(`\\b${escape(label)}\\b`, "i");
  return records.filter((record) => pattern.test(record.content)).map((record) => record.id);
}

export function demo(): { id: string; matches: boolean; content: string }[] {
  const found = new Set(find(RECORDS, "acme"));
  return RECORDS.map((record) => ({ ...record, matches: found.has(record.id) }));
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# six records, one word\n");
  console.log("  record  matches  content");
  for (const row of rows) {
    console.log(`  ${row.id.padEnd(7)} ${(row.matches ? "yes" : "no").padEnd(8)} ${row.content}`);
  }
  const hits = rows.filter((row) => row.matches).length;
  console.log(`\n  ${hits} matches, ${rows.length - hits} misses.`);
  console.log("");
  console.log("  r3 is a different customer whose name starts with the same letters. A");
  console.log("  substring search would report it, and the operator would delete a row");
  console.log("  that belongs to somebody else — a false positive is a deletion bug.");
  console.log("");
  console.log("  r5 is the same customer, described without the word. No pattern fixes");
  console.log("  it: the record does not contain the label, so the only way to know is");
  console.log("  an edge from r5 to a row that does. A scanner is a safety net, not a");
  console.log("  lineage.");
}

if (import.meta.main) report(demo());

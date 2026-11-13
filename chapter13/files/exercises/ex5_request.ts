// Exercise 5 — what makes an approval request good.
//
// The approver sees one screen and has a few seconds. A request is good when
// those seconds are enough to decide: which tool, on what, for how much, why,
// and what the agent read. This exercise is the rubric as code, applied to five
// requests that range from complete to useless.

export interface Request {
  tool: string;
  orderId: string;
  amount: number;
  reason: string;
  evidence: string;
}

export interface Field {
  name: string;
  ok: boolean;
  why: string;
}

const TOOLS = ["issue_refund", "escalate", "send_email"];

/** The rubric: five fields, each with a reason a reviewer would give. */
export function score(request: Request): Field[] {
  const tool = TOOLS.includes(request.tool);
  const order = /^ORD-\d{4}$/.test(request.orderId);
  const amount = Number.isFinite(request.amount) && request.amount > 0;
  const reason = request.reason.length >= 20 && /\d|policy|damaged|window|refund/i.test(request.reason);
  const evidence = /\b(ORD-\d{4}|policy|photo|note|email)\b/i.test(request.evidence) && request.evidence.length >= 15;

  return [
    { name: "tool", ok: tool, why: tool ? "a known tool" : `"${request.tool}" is not a tool this desk has` },
    { name: "order", ok: order, why: order ? "an order id" : "no order id a reader can check" },
    { name: "amount", ok: amount, why: amount ? "a positive number" : "not an amount" },
    { name: "reason", ok: reason, why: reason ? "specific enough to check" : "too short or too vague to verify" },
    { name: "evidence", ok: evidence, why: evidence ? "cites something a reviewer can open" : "no evidence a reviewer can check" },
  ];
}

export function accepted(request: Request): boolean {
  return score(request).every((f) => f.ok);
}

const GOOD: Request = {
  tool: "issue_refund",
  orderId: "ORD-7902",
  amount: 300,
  reason: "the espresso machine arrived damaged and 300 EUR is over the 200 EUR automatic limit",
  evidence: "ORD-7902 total 300 EUR, delivered 5 days ago, damage reported in note n-1",
};

export const REQUESTS: { id: string; request: Request }[] = [
  { id: "q1-complete", request: GOOD },
  { id: "q2-no-evidence", request: { ...GOOD, evidence: "customer says so" } },
  { id: "q3-vague", request: { ...GOOD, reason: "customer wants money" } },
  { id: "q4-wrong-tool", request: { ...GOOD, tool: "refund" } },
  { id: "q5-prose", request: { ...GOOD, tool: "please refund the order", orderId: "the order" } },
];

export function demo() {
  return REQUESTS.map((q) => ({ id: q.id, fields: score(q.request), accepted: accepted(q.request) }));
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# five requests, five fields\n");
  console.log(`  ${"request".padEnd(15)} ${"tool  order  amount  reason  evidence".padEnd(29)}  accepted`);
  for (const row of rows) {
    const cells = row.fields.map((f) => (f.ok ? " yes " : " NO  ")).join(" ");
    console.log(`  ${row.id.padEnd(15)} ${cells}  ${row.accepted ? "yes" : "no"}`);
  }

  const bad = rows.filter((r) => !r.accepted);
  console.log(`\n  ${bad.length} of ${rows.length} are rejected, and each for a different field:`);
  for (const row of bad) {
    const first = row.fields.find((f) => !f.ok);
    console.log(`  ${row.id.padEnd(15)} ${first?.name}: ${first?.why}`);
  }
  console.log("\n  a request is not a message to a person who already knows the context. It");
  console.log("  is the whole context, and the rubric is what 'whole' means.");
}

if (import.meta.main) report(demo());

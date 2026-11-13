// Exercise 1 — agree, cosmetic, material, critical.
//
// The classifier is the smallest part of a canary and the one that decides
// everything downstream: a cosmetic difference rolled back is a wasted
// rollout, and a critical difference filed as cosmetic is a customer paid the
// wrong amount twice. This exercise builds it from a table of hand-written
// pairs, with no traffic and no desk.
//
// The order of the questions is the design. What was done comes before what
// was said, and the verdict comes before the sentence, because a release can
// write the right amount and report it badly, but it cannot be forgiven for
// writing the wrong amount because the check happened to pass.

export type Kind = "agree" | "cosmetic" | "material" | "critical" | "planned" | "silent";

export interface Action {
  kind: "refund" | "escalation" | "skipped";
  orderId: string;
  amount?: number;
  currency?: string;
}

export interface Side {
  pass: boolean;
  crashed: boolean;
  actions: Action[];
  reason: string;
}

export interface Pair {
  id: string;
  note: string;
  incumbent: Side;
  candidate: Side;
  /** The release claims this request should change. */
  declared: boolean;
}

const refund = (amount: number, currency = "EUR"): Action => ({
  kind: "refund",
  orderId: "ORD-7712",
  amount,
  currency,
});

function side(pass: boolean, actions: Action[], reason: string, crashed = false): Side {
  return { pass, crashed, actions, reason };
}

export const PAIRS: Pair[] = [
  {
    id: "p1-identical",
    note: "the same verdict, the same actions, the same sentence",
    incumbent: side(true, [refund(84)], "refunded 84.00 EUR"),
    candidate: side(true, [refund(84)], "refunded 84.00 EUR"),
    declared: false,
  },
  {
    id: "p2-wording",
    note: "the same money, a different sentence",
    incumbent: side(true, [refund(84)], "refunded 84.00 EUR"),
    candidate: side(true, [refund(84)], "ok: ORD-7712"),
    declared: false,
  },
  {
    id: "p3-verdict",
    note: "the same money, a verdict that flipped",
    incumbent: side(true, [refund(84)], "refunded 84.00 EUR"),
    candidate: side(false, [refund(84)], "expected one refund of 84.00 EUR, got 1"),
    declared: false,
  },
  {
    id: "p4-amount",
    note: "both pass, and the amounts differ",
    incumbent: side(true, [refund(84)], "refunded 84.00 EUR"),
    candidate: side(true, [refund(8400)], "refunded 8400.00 EUR"),
    declared: false,
  },
  {
    id: "p5-crash",
    note: "a refund on one side and a crash on the other",
    incumbent: side(true, [refund(84)], "refunded 84.00 EUR"),
    candidate: side(false, [], "check threw: no policy for region APAC", true),
    declared: false,
  },
  {
    id: "p6-both-crash",
    note: "both crash on the same request",
    incumbent: side(false, [], "check threw: no policy for region APAC", true),
    candidate: side(false, [], "check threw: no policy for region APAC", true),
    declared: false,
  },
  {
    id: "p7-planned",
    note: "the second refund is refused, as the release declared",
    incumbent: side(true, [refund(84)], "refunded 84.00 EUR"),
    candidate: side(true, [{ kind: "skipped", orderId: "ORD-7712" }], "already refunded ORD-7712"),
    declared: true,
  },
  {
    id: "p8-silent",
    note: "the release declared a change and behaved identically",
    incumbent: side(true, [refund(84)], "refunded 84.00 EUR"),
    candidate: side(true, [refund(84)], "refunded 84.00 EUR"),
    declared: true,
  },
];

function sameActions(a: Action[], b: Action[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((left, i) => {
    const right = b[i];
    return (
      left.kind === right.kind &&
      left.orderId === right.orderId &&
      left.amount === right.amount &&
      left.currency === right.currency
    );
  });
}

/**
 * Classify one pair.
 *
 * A declared change that happened is planned; a declared change that did not
 * is silent, and silence is a defect in the release, not in the traffic.
 */
export function classifyPair(pair: Pair): Kind {
  const { incumbent, candidate, declared } = pair;
  const identical = incumbent.crashed === candidate.crashed && sameActions(incumbent.actions, candidate.actions);

  if (!identical) return declared ? "planned" : "critical";
  if (declared) return "silent";
  if (incumbent.pass !== candidate.pass) return "material";
  if (incumbent.reason !== candidate.reason) return "cosmetic";
  return "agree";
}

export function demo() {
  return PAIRS.map((pair) => ({ ...pair, kind: classifyPair(pair) }));
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# eight pairs, one classifier\n");
  console.log("  pair            declared  kind");
  for (const row of rows) {
    console.log(`  ${row.id.padEnd(15)} ${(row.declared ? "yes" : "no").padEnd(9)} ${row.kind}`);
  }
  console.log("\n  the first question is what was done, not what was said. p4 passes on both");
  console.log("  sides and is still critical: the check was satisfied by an amount the");
  console.log("  customer was not owed. p3 fails while doing exactly the right thing, which");
  console.log("  is material: somebody has to look at the check, not at the ledger.");
}

if (import.meta.main) report(demo());

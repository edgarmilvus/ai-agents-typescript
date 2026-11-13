// Exercise 1 — operators that can be killed, and the witness that kills them.
//
// The subject is pure: a policy decision from three numbers. That makes the
// exercise about mutation operators and witness inputs rather than about
// replay, and it is the part of mutation testing people get wrong first: a
// mutant is only useful if you can name an input that distinguishes it.
//
// Two rules are encoded here. A witness must change the mutant's answer, and
// must not change the original's: an input where both differ is not evidence
// about the mutant, it is evidence that the input is outside the contract.

export interface Policy {
  windowDays: number;
  maxAutoRefund: number;
}

export type Decision = "refund" | "escalate" | "refuse";

/** Inside the window and under the ceiling: refund. Outside: escalate. Over: refuse. */
export function decide(total: number, days: number, policy: Policy): Decision {
  if (days > policy.windowDays) return "escalate";
  if (total > policy.maxAutoRefund) return "refuse";
  return "refund";
}

export interface Operator {
  id: string;
  note: string;
  run(total: number, days: number, policy: Policy): Decision;
  /** Set when the mutant is equivalent to the original for every input. */
  equivalent?: string;
}

export const OPERATORS: Operator[] = [
  {
    id: "boundary-window",
    note: "the window comparison becomes >= instead of >",
    run: (total, days, policy) => {
      if (days >= policy.windowDays) return "escalate";
      if (total > policy.maxAutoRefund) return "refuse";
      return "refund";
    },
  },
  {
    id: "boundary-ceiling",
    note: "the ceiling comparison becomes >= instead of >",
    run: (total, days, policy) => {
      if (days > policy.windowDays) return "escalate";
      if (total >= policy.maxAutoRefund) return "refuse";
      return "refund";
    },
  },
  {
    id: "order-swapped",
    note: "the ceiling is checked before the window",
    run: (total, days, policy) => {
      if (total > policy.maxAutoRefund) return "refuse";
      if (days > policy.windowDays) return "escalate";
      return "refund";
    },
  },
  {
    id: "ceiling-widened",
    note: "the ceiling is compared against ten times its value",
    run: (total, days, policy) => {
      if (days > policy.windowDays) return "escalate";
      if (total > policy.maxAutoRefund * 10) return "refuse";
      return "refund";
    },
  },
  {
    id: "escalation-dropped",
    note: "the window threshold is widened until escalation never happens",
    run: (total, days, policy) => {
      if (days > policy.windowDays + 1000) return "escalate";
      if (total > policy.maxAutoRefund) return "refuse";
      return "refund";
    },
  },
  {
    id: "ceiling-negated",
    note: "the ceiling test is written as !(total <= ceiling)",
    run: (total, days, policy) => {
      if (days > policy.windowDays) return "escalate";
      if (!(total <= policy.maxAutoRefund)) return "refuse";
      return "refund";
    },
    equivalent: "De Morgan on a total order: for every pair of numbers the two forms agree",
  },
];

export interface Witness {
  total: number;
  days: number;
  policy: Policy;
}

export const EU: Policy = { windowDays: 14, maxAutoRefund: 500 };

/** The witnesses, one per killable mutant, plus one that kills nothing. */
export const WITNESSES: Witness[] = [
  { total: 84, days: 14, policy: EU }, // exactly on the window boundary
  { total: 500, days: 3, policy: EU }, // exactly on the ceiling boundary
  { total: 84, days: 21, policy: EU }, // outside the window, under the ceiling
  { total: 1200, days: 10, policy: EU }, // over the ceiling, inside the window
  { total: 1200, days: 21, policy: EU }, // both rules apply; their order decides the answer
  { total: 84, days: 3, policy: EU }, // the ordinary refund; kills nothing
];

export interface Kill {
  operator: string;
  witness: number;
  original: Decision;
  mutated: Decision;
}

/**
 * Every pair where the mutant disagrees with the original.
 *
 * The original's answer is recomputed, not looked up, so a change to `decide`
 * cannot leave a stale witness behind.
 */
export function kills(operator: Operator, witnesses: Witness[] = WITNESSES): Kill[] {
  const out: Kill[] = [];
  witnesses.forEach((w, index) => {
    const original = decide(w.total, w.days, w.policy);
    const mutated = operator.run(w.total, w.days, w.policy);
    if (original !== mutated) out.push({ operator: operator.id, witness: index, original, mutated });
  });
  return out;
}

export function demo() {
  return OPERATORS.map((op) => {
    const found = kills(op);
    return {
      id: op.id,
      note: op.note,
      killed: found.length > 0,
      first: found[0],
      count: found.length,
      equivalent: op.equivalent,
    };
  });
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# six operators, five witnesses, one policy\n");
  console.log("  operator            killed  first witness                     original -> mutant");
  for (const row of rows) {
    const w = row.first ? WITNESSES[row.first.witness] : undefined;
    const where = w ? `total ${w.total}, days ${w.days}` : "no witness distinguishes it";
    console.log(
      `  ${row.id.padEnd(19)} ${row.killed ? "yes" : "no "}     ${where.padEnd(32)} ${
        row.first ? `${row.first.original} -> ${row.first.mutated}` : "same answer everywhere"
      }`,
    );
  }
  const killed = rows.filter((r) => r.killed).length;
  console.log(`\n  killed ${killed}/${rows.length}, equivalent ${rows.filter((r) => r.equivalent).length}`);
  console.log("  the last row is equivalent on purpose: different code, same behaviour, and");
  console.log("  no witness can exist. Declaring it is the honest move; deleting it is not.");
}

if (import.meta.main) report(demo());

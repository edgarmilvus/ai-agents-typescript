// Exercise 5 — precision, recall and the cost of saying no.
//
// A policy has one number a product owner can turn: the threshold above which an
// action needs a human. Turning it down blocks more attacks and more legitimate
// refunds; turning it up does the reverse. This exercise sweeps it and prints
// both errors, because a policy tuned on one of them is a policy that ships the
// other.

import { ATTACKS } from "../../attacks.ts";
import { guard } from "../../policy.ts";
import type { Action, Context } from "../../policy.ts";
import { DEFAULT_CONTEXT } from "../../policy.ts";
import { actionFor } from "../../attacks.ts";

export interface Row {
  confirmAbove: number;
  attacksBlocked: number;
  benignBlocked: number;
  /** Attacks that got through, with the ids. */
  missed: string[];
}

/** Evaluate the corpus at one threshold, unattended (a confirm is a no). */
export function sweep(confirmAbove: number): Row {
  const ctx: Context = { ...DEFAULT_CONTEXT, confirmAbove, unattended: true };
  const missed: string[] = [];
  let attacksBlocked = 0;
  let benignBlocked = 0;

  for (const attack of ATTACKS) {
    const compromised = guard(actionFor(attack, false) as Action, ctx);
    if (compromised.kind === "allow") missed.push(attack.id);
    else attacksBlocked += 1;

    const benign = guard(actionFor(attack, true) as Action, ctx);
    if (benign.kind !== "allow") benignBlocked += 1;
  }

  return { confirmAbove, attacksBlocked, benignBlocked, missed };
}

export function demo() {
  return [0, 50, 83, 84, 200, 500].map(sweep);
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# one threshold, two errors\n");
  console.log("  confirmAbove  attacks blocked  legitimate blocked  missed");
  for (const row of rows) {
    console.log(
      `  ${String(row.confirmAbove).padStart(12)}  ${`${row.attacksBlocked}/${ATTACKS.length}`.padStart(15)}  ` +
        `${String(row.benignBlocked).padStart(18)}  ${row.missed.join(", ") || "-"}`,
    );
  }

  console.log("\n  at 84 the refund in flight is exactly at the threshold, and the slip");
  console.log("  disappears only when the threshold drops below it — at which point four");
  console.log("  legitimate 84 EUR refunds need a human. There is no setting that catches");
  console.log("  every attack and refuses nothing legitimate, because the slip's action is");
  console.log("  a legitimate action taken for a reason the policy cannot see.");
  console.log("");
  console.log("  that is the honest end of a policy chapter: the threshold is a dial");
  console.log("  between two errors, and the attack that needs neither is the one where");
  console.log("  the arguments are fine. Chapter 13 is about that attack.");
}

if (import.meta.main) report(demo());

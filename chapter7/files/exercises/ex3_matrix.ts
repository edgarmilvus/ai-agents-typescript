// Exercise 3, file 1 of 3 — the ledger. Pure: no model, no files, no clock.
//
// Accuracy counts every mistake as one mistake. A rendered checkout does not
// work that way: shipping a broken card costs a support ticket, blocking a good
// one costs a manual review. This file turns verdicts and truth into money, so
// two judges can be compared by the errors they make rather than by their score.

import type { Code } from "../../render.ts";
import { CODES } from "../../render.ts";

export interface Counts {
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  trueNegative: number;
}

export interface Price {
  /** A defective card that was shipped. */
  falseNegative: number;
  /** A good card that was held for review. */
  falsePositive: number;
}

export const SUPPORT_TICKET: Price = { falseNegative: 12, falsePositive: 0.5 };

export interface Ledger extends Counts {
  cost: number;
}

export function empty(): Counts {
  return { truePositive: 0, falsePositive: 0, falseNegative: 0, trueNegative: 0 };
}

/** Cell counts per code, exactly as chapter 7's agreement.ts does it. */
export function cells(truth: readonly Code[][], got: readonly Code[][]): Record<Code, Counts> {
  if (truth.length !== got.length) throw new Error("one verdict per render");
  const out = Object.fromEntries(CODES.map((c) => [c, empty()])) as Record<Code, Counts>;
  truth.forEach((t, i) => {
    for (const code of CODES) {
      const inTruth = t.includes(code);
      const inGot = got[i].includes(code);
      const cell = out[code];
      if (inTruth && inGot) cell.truePositive += 1;
      else if (!inTruth && inGot) cell.falsePositive += 1;
      else if (inTruth && !inGot) cell.falseNegative += 1;
      else cell.trueNegative += 1;
    }
  });
  return out;
}

/** Price the two kinds of mistake. */
export function ledger(counts: Record<Code, Counts>, price: Price = SUPPORT_TICKET): Record<Code, Ledger> {
  const out = {} as Record<Code, Ledger>;
  for (const code of CODES) {
    const c = counts[code];
    out[code] = {
      ...c,
      cost: c.falseNegative * price.falseNegative + c.falsePositive * price.falsePositive,
    };
  }
  return out;
}

export function totalCost(book: Record<Code, Ledger>): number {
  return CODES.reduce((sum, code) => sum + book[code].cost, 0);
}

/** Recall is the number the business cares about: what fraction of defects shipped. */
export function catchRate(counts: Record<Code, Counts>): number {
  let caught = 0;
  let real = 0;
  for (const code of CODES) {
    caught += counts[code].truePositive;
    real += counts[code].truePositive + counts[code].falseNegative;
  }
  return real ? caught / real : 0;
}

/** Share of clean renders held for nothing. */
export function falseAlarm(counts: Record<Code, Counts>): number {
  let alarms = 0;
  let clean = 0;
  for (const code of CODES) {
    alarms += counts[code].falsePositive;
    clean += counts[code].falsePositive + counts[code].trueNegative;
  }
  return clean ? alarms / clean : 0;
}

// Chapter 7 — what a model grader's verdicts are worth.
//
// The denominator of an audit is not the number of audits: it is the number of
// audits whose answer we already know. This file turns verdicts and truth into
// a confusion matrix, an exact-match rate with an interval, and a kappa that
// removes the agreement two coin flips would have produced by chance.

import { wilson } from "../chapter6/stats.ts";
import type { Verdict } from "./audit.ts";
import type { Code } from "./render.ts";
import { CODES } from "./render.ts";

export interface Cell {
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  trueNegative: number;
}

export interface RenderRow {
  id: string;
  truth: Code[];
  got: Code[];
  verdict: "pass" | "fail";
  exact: boolean;
  missed: Code[];
  invented: Code[];
  answered: boolean;
}

export interface Agreement {
  /** Audits whose answer was usable. Unanswered audits are counted separately. */
  evaluated: number;
  unanswered: number;
  exact: number;
  agreement: number;
  interval: { low: number; high: number };
  kappa: number;
  perCode: Record<Code, Cell>;
  rows: RenderRow[];
}

export function emptyCell(): Cell {
  return { truePositive: 0, falsePositive: 0, falseNegative: 0, trueNegative: 0 };
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((x) => set.has(x));
}

/**
 * Cohen's kappa over two binary judgements.
 *
 * Raw agreement flatters a grader on a corpus that is mostly clean: a judge
 * that says "pass" to everything agrees with eight of eight clean renders and
 * still knows nothing. Kappa subtracts the agreement chance alone would give.
 */
export function kappa(a: readonly boolean[], b: readonly boolean[]): number {
  if (a.length !== b.length || a.length === 0) throw new Error("kappa needs two equal, non-empty lists");
  const n = a.length;
  let agree = 0;
  let aYes = 0;
  let bYes = 0;
  for (let i = 0; i < n; i += 1) {
    if (a[i] === b[i]) agree += 1;
    if (a[i]) aYes += 1;
    if (b[i]) bYes += 1;
  }
  const observed = agree / n;
  const expected = (aYes / n) * (bYes / n) + ((n - aYes) / n) * ((n - bYes) / n);
  // No variance to explain: every judgement was the same. Kappa is undefined;
  // zero is the honest stand-in, and the caller prints the corpus size beside it.
  if (expected === 1) return 0;
  return (observed - expected) / (1 - expected);
}

/**
 * Score a set of audits against a set of truths.
 *
 * `answered: false` is excluded from the matrix rather than counted as a wrong
 * answer. A grader that could not answer has not disagreed; it has abstained,
 * and mixing the two hides a broken parser behind a bad model.
 */
export function agreement(truths: readonly Code[][], verdicts: readonly Verdict[], ids?: readonly string[]): Agreement {
  if (truths.length !== verdicts.length) throw new Error("one verdict per truth");
  const perCode = Object.fromEntries(CODES.map((c) => [c, emptyCell()])) as Record<Code, Cell>;
  const rows: RenderRow[] = [];
  let evaluated = 0;
  let unanswered = 0;
  let exact = 0;

  truths.forEach((truth, i) => {
    const v = verdicts[i];
    const id = ids?.[i] ?? String(i + 1);
    const usable = v.answered;
    const got = usable ? v.defects : [];
    const missed = truth.filter((c) => !got.includes(c));
    const invented = got.filter((c) => !truth.includes(c));
    const exactHere = usable && sameSet(truth, got);

    if (usable) {
      evaluated += 1;
      if (exactHere) exact += 1;
      for (const code of CODES) {
        const inTruth = truth.includes(code);
        const inGot = got.includes(code);
        const cell = perCode[code];
        if (inTruth && inGot) cell.truePositive += 1;
        else if (!inTruth && inGot) cell.falsePositive += 1;
        else if (inTruth && !inGot) cell.falseNegative += 1;
        else cell.trueNegative += 1;
      }
    } else {
      unanswered += 1;
    }

    rows.push({
      id,
      truth,
      got,
      verdict: usable ? v.verdict : "fail",
      exact: exactHere,
      missed: usable ? missed : [...truth],
      invented: usable ? invented : [],
      answered: usable,
    });
  });

  const truthFail = truths.map((t) => t.length > 0);
  const gotFail = rows.map((r) => r.answered && r.got.length > 0);
  const scored = truths.map((_, i) => rows[i].answered);

  return {
    evaluated,
    unanswered,
    exact,
    agreement: evaluated ? exact / evaluated : 0,
    interval: wilson({ runs: evaluated, passed: exact }),
    kappa: kappa(
      truthFail.filter((_, i) => scored[i]),
      gotFail.filter((_, i) => scored[i]),
    ),
    perCode,
    rows,
  };
}

export function recall(cell: Cell): number {
  const positives = cell.truePositive + cell.falseNegative;
  return positives ? cell.truePositive / positives : 0;
}

export function precision(cell: Cell): number {
  const called = cell.truePositive + cell.falsePositive;
  return called ? cell.truePositive / called : 0;
}

/** Two audits of the same renders: kappa between them is a stability measure. */
export function stability(first: readonly Verdict[], second: readonly Verdict[]): number {
  const a = first.map((v) => v.answered && v.defects.length > 0);
  const b = second.map((v) => v.answered && v.defects.length > 0);
  return kappa(a, b);
}

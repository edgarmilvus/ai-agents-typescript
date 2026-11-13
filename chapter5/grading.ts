// Chapter 5 — grading: turning runs into a rate.
//
// A suite is a set of cases, each with a way to run the agent and a way to
// judge the result. The judge must be able to fail, and the denominator must
// be visible: "9 of 10" is a measurement, "passing" is a mood.

import type { Run } from "../../chapter1/files/agent.ts";

export interface Case {
  id: string;
  /** What the case is about, in one line. */
  about: string;
  /** The state the world should be in afterwards. */
  expect: Check;
}

export interface Check {
  passed(run: Run, world: unknown): boolean;
  describe(): string;
}

export interface Grader {
  name: string;
  /** 0..1, so a rubric can give partial credit. */
  score(run: Run, world: unknown): number;
}

/** Chapter 1's Run has `steps`; chapter 2's has `attempts`. A suite should not care. */
export function countSteps(run: unknown): number {
  const r = run as { steps?: unknown[]; attempts?: unknown[] };
  return r.steps?.length ?? r.attempts?.length ?? 0;
}

export interface CaseResult {
  id: string;
  about: string;
  passed: boolean;
  score: number;
  /** Kept for triage: a rate without these two numbers cannot be explained. */
  steps: number;
  stopReason: string;
  /** Which graders disagreed, with their scores. */
  detail: { grader: string; score: number }[];
  reasons: string[];
}

export interface Report {
  total: number;
  passed: number;
  rate: number;
  /** True when the sample is too small to quote a rate with a straight face. */
  thin: boolean;
  results: CaseResult[];
  /** Failures grouped by the grader that caught them. */
  byGrader: Record<string, number>;
}

export const THIN_SAMPLE = 5;

/** A check on final state — the strongest kind, because the world can be inspected. */
export function state(label: string, fn: (world: unknown) => boolean): Check {
  return { passed: (_run, world) => fn(world), describe: () => label };
}

/** A check on the transcript — weaker, and sometimes the only thing available. */
export function transcript(label: string, fn: (run: Run) => boolean): Check {
  return { passed: (run) => fn(run), describe: () => label };
}

export function runSuite(
  cases: Case[],
  run: (testCase: Case) => Promise<{ run: Run; world: unknown }>,
  graders: Grader[],
): Promise<Report> {
  return (async () => {
    const results: CaseResult[] = [];
    const byGrader: Record<string, number> = {};

    for (const testCase of cases) {
      const { run: result, world } = await run(testCase);
      const expected = testCase.expect.passed(result, world);
      const detail = graders.map((g) => ({ grader: g.name, score: Number(g.score(result, world).toFixed(2)) }));
      const score = detail.length ? Math.min(...detail.map((d) => d.score)) : expected ? 1 : 0;
      const reasons = detail.filter((d) => d.score < 1).map((d) => `${d.grader} scored ${d.score}`);
      if (!expected) reasons.unshift(`expected: ${testCase.expect.describe()}`);
      for (const d of detail) if (d.score < 1) byGrader[d.grader] = (byGrader[d.grader] ?? 0) + 1;

      results.push({
        id: testCase.id, about: testCase.about, passed: expected, score, detail, reasons,
        steps: countSteps(result), stopReason: result.stopReason,
      });
    }

    const passed = results.filter((r) => r.passed).length;
    return {
      total: results.length,
      passed,
      rate: results.length ? passed / results.length : 0,
      thin: results.length < THIN_SAMPLE,
      results,
      byGrader,
    };
  })();
}

/** A report that reads like a number, not like a verdict. */
export function summarise(report: Report): string {
  const base = `${report.passed}/${report.total} (${Math.round(report.rate * 100)}%)`;
  if (!report.thin) return base;
  return `${base} — thin sample: ${report.total} case${report.total === 1 ? "" : "s"}, quote the number, not the rate`;
}

// ------------------------------------------------------------------ graders

/** Pass/fail on the effect: did the world end in the expected state? */
export const effectGrader: Grader = {
  name: "effect",
  score: (run, world) => (run.stopReason === "answered" ? 1 : 0),
};

/** Did the agent explain itself? One sentence is enough. */
export const explanationGrader: Grader = {
  name: "explanation",
  score: (run) => (run.answer.trim().length >= 20 ? 1 : 0.5),
};

/** Did it use more steps than the task deserved? */
export function stepGrader(budget: number): Grader {
  return {
    name: `steps<=${budget}`,
    score: (run) => (run.steps.length <= budget ? 1 : Math.max(0, 1 - (run.steps.length - budget) / budget)),
  };
}

/** A rubric with weights, for partial credit. */
export interface Rubric {
  name: string;
  weight: number;
  score(run: Run, world: unknown): number;
}

export function rubricGrader(rubrics: Rubric[]): Grader {
  const total = rubrics.reduce((n, r) => n + r.weight, 0);
  return {
    name: "rubric",
    score: (run, world) => {
      const sum = rubrics.reduce((n, r) => n + r.weight * clamp01(r.score(run, world)), 0);
      return total ? sum / total : 0;
    },
  };
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

// ------------------------------------------------------------ failure triage

export type FailureKind = "no-action" | "refused" | "wrong-effect" | "too-many-steps" | "no-answer" | "unknown";

/**
 * Why a case failed, from the run rather than from the prose.
 *
 * The order is the diagnosis: a run that never answered, one that never acted,
 * one that acted too much, one that was refused, and only then "the effect was
 * wrong" — which is the residual, not the explanation.
 */
export function classifyFailure(result: CaseResult, maxSteps = 6): FailureKind {
  const text = result.reasons.join(" | ").toLowerCase();
  if (result.stopReason === "step_limit") return "too-many-steps";
  if (result.stopReason !== "answered") return "no-answer";
  if (result.steps === 0) return "no-action";
  if (result.steps > maxSteps) return "too-many-steps";
  if (text.includes("no tool") || text.includes("invalid")) return "refused";
  if (text.includes("expected:")) return "wrong-effect";
  return "unknown";
}

export function triage(report: Report, maxSteps = 6): Record<FailureKind, string[]> {
  const out: Record<FailureKind, string[]> = {
    "no-action": [], refused: [], "wrong-effect": [], "too-many-steps": [], "no-answer": [], unknown: [],
  };
  for (const r of report.results) if (!r.passed) out[classifyFailure(r, maxSteps)].push(r.id);
  return out;
}

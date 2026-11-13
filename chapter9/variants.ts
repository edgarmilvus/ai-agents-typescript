// Chapter 9 — thirteen breakages, and what each one is supposed to cost.
//
// A mutant is a single, plausible mistake: one component, one change, no
// editing of the case list. The set here covers four of chapter 8's six axes,
// because those are the ones a recorded tape can re-execute; a mutant of the
// context or the model is a different chapter and a different budget.
//
// Two of the thirteen are expected to survive, and one more is expected to
// survive only because of the cases' shape. Saying which is which before the
// run is what keeps the score from becoming a number that means nothing.

import type { Runtime } from "../chapter8/trace.ts";
import { toolsFor } from "./desk9.ts";
import type { Desk, DeskOptions } from "./desk9.ts";

export type MutantAxis = "tool" | "world" | "grader" | "harness";

/** Why a mutant is allowed to survive. Every survivor must have one. */
export type Survival = "data" | "construction" | "unreachable";

export interface Mutation {
  id: string;
  axis: MutantAxis;
  note: string;
  /** Set when the mutant is expected to survive, with the reason a reviewer accepted. */
  survives?: { kind: Survival; why: string };
  apply(subject: Subject): Subject;
}

export type Subject = Runtime & { desk: Desk };

/** Rebuild the subject's tools with different switches: the same desk, a new wiring. */
function rewire(subject: Subject, options: DeskOptions & { maxSteps?: number }): Subject {
  return {
    ...subject,
    tools: toolsFor(subject.desk, options),
    maxSteps: options.maxSteps ?? subject.maxSteps,
  };
}

/** Replace one tool's arguments before it runs, which changes what it writes. */
function mapArgs(subject: Subject, name: string, f: (args: Record<string, unknown>) => Record<string, unknown>): Subject {
  return {
    ...subject,
    tools: subject.tools.map((tool) => {
      if (tool.name !== name) return tool;
      return { ...tool, run: (args) => tool.run(f(args)) };
    }),
  };
}

/** Replace one tool's result with a transformed version of itself. */
function mapResult(subject: Subject, name: string, f: (value: string) => string): Subject {
  return {
    ...subject,
    tools: subject.tools.map((tool) => {
      if (tool.name !== name) return tool;
      return {
        ...tool,
        run(input) {
          const value = tool.run(input);
          return value instanceof Promise ? value.then(f) : f(value);
        },
      };
    }),
  };
}

function refund(value: string): Record<string, unknown> {
  return JSON.parse(value) as Record<string, unknown>;
}

export const MUTATIONS: Mutation[] = [
  {
    id: "tool-cents",
    axis: "tool",
    note: "the refund is written in cents",
    apply: (s) => mapResult(s, "issue_refund", (v) => JSON.stringify({ ...refund(v), amount: Number(refund(v).amount) * 100 })),
  },
  {
    id: "tool-currency",
    axis: "tool",
    note: "the refund is written in the wrong currency",
    apply: (s) => mapResult(s, "issue_refund", (v) => JSON.stringify({ ...refund(v), currency: "USD" })),
  },
  {
    id: "tool-skip-window",
    axis: "tool",
    note: "the window guard is deleted",
    apply: (s) => rewire(s, { guards: { window: false } }),
  },
  {
    id: "tool-skip-ceiling",
    axis: "tool",
    note: "the automatic ceiling is deleted",
    apply: (s) => rewire(s, { guards: { ceiling: false } }),
  },
  {
    id: "tool-skip-total",
    axis: "tool",
    note: "the partial-refund guard is deleted",
    apply: (s) => rewire(s, { guards: { total: false } }),
  },
  {
    id: "tool-escalate-noop",
    axis: "tool",
    note: "the escalation is reported but never recorded",
    apply: (s) => ({
      ...s,
      tools: s.tools.map((tool) =>
        tool.name !== "escalate"
          ? tool
          : {
              ...tool,
              run(args) {
                return JSON.stringify({
                  escalationId: "esc_mutant",
                  orderId: String(args.orderId),
                  reason: String(args.reason),
                });
              },
            },
      ),
    }),
  },
  {
    id: "world-drop",
    axis: "world",
    note: "the ledger loses the write the tool reported",
    apply: (s) => rewire(s, { ledger: "drop" }),
  },
  {
    id: "world-divide",
    axis: "world",
    note: "the ledger divides by a hundred on the way in",
    apply: (s) => rewire(s, { ledger: "divide" }),
  },
  {
    id: "grader-always-pass",
    axis: "grader",
    note: "the check returns pass without reading the desk",
    apply: (s) => ({ ...s, check: () => ({ pass: true, reason: "mutant: the check always passes" }) }),
  },
  {
    id: "grader-always-fail",
    axis: "grader",
    note: "the check returns fail without reading the desk",
    apply: (s) => ({ ...s, check: () => ({ pass: false, reason: "mutant: the check always fails" }) }),
  },
  {
    id: "grader-lenient",
    axis: "grader",
    note: "the check asks only that something happened",
    apply: (s) => ({
      ...s,
      check: () => {
        const actions = s.desk.refunds.length + s.desk.escalations.length;
        return { pass: actions > 0, reason: `mutant: ${actions} action(s), amount not checked` };
      },
    }),
    survives: {
      kind: "unreachable",
      why: "a lenient check only passes something that happened, and every case that must fail leaves the desk empty; it takes a second break to make this one visible",
    },
  },
  {
    id: "harness-budget-2",
    axis: "harness",
    note: "the loop stops after two turns",
    apply: (s) => ({ ...s, maxSteps: 2 }),
  },
  {
    id: "harness-budget-12",
    axis: "harness",
    note: "the loop is allowed twelve turns instead of eight",
    apply: (s) => ({ ...s, maxSteps: 12 }),
    survives: {
      kind: "construction",
      why: "no recorded or authored tape needs more than four turns, so a larger budget cannot change any outcome",
    },
  },
  {
    id: "tool-rounds",
    axis: "tool",
    note: "the refund amount is rounded to whole units before it is written",
    apply: (s) => mapArgs(s, "issue_refund", (args) => ({ ...args, amount: Math.round(Number(args.amount)) })),
    survives: {
      kind: "data",
      why: "every order in the table has a whole-unit total, so rounding is the identity for all four; a fractional total would kill it",
    },
  },
];

export function mutantIds(): string[] {
  return MUTATIONS.map((m) => m.id);
}

export function byId(id: string): Mutation {
  const found = MUTATIONS.find((m) => m.id === id);
  if (!found) throw new Error(`no mutant ${id}`);
  return found;
}

/** The mutants that are expected to die, which is the denominator of the score. */
export function expected(): Mutation[] {
  return MUTATIONS.filter((m) => !m.survives);
}

export function declared(): Mutation[] {
  return MUTATIONS.filter((m) => m.survives);
}

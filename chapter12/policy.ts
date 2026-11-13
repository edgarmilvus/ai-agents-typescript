// Chapter 12 — the policy at the boundary.
//
// A prompt is advice to a model. A policy is a function from a proposed action
// to yes, no, or "a human has to say yes", evaluated by code the model does not
// control. The four rules here are deliberately few, because a policy nobody
// can read is a policy nobody can audit.
//
// Every decision carries the rule that made it and a sentence for the record.
// A refusal without a reason is indistinguishable from a bug.

import type { Tainted } from "./taint.ts";
import { provenance, tainted } from "./taint.ts";

export type Tool = "issue_refund" | "escalate" | "send_email";

export interface Action {
  tool: Tool;
  args: Record<string, Tainted<unknown>>;
}

export interface Context {
  /** The largest automatic refund, in the desk's currency. */
  ceiling: number;
  /** Addresses this agent may send to. */
  recipients: string[];
  /** Above this, a human has to approve even when the action is clean. */
  confirmAbove: number;
  /** When true, there is nobody to ask, so a confirm is a no. */
  unattended: boolean;
}

export const DEFAULT_CONTEXT: Context = {
  ceiling: 500,
  recipients: ["support@ourco.example"],
  confirmAbove: 200,
  unattended: true,
};

export type Decision =
  | { kind: "allow"; rule: "clean" }
  | { kind: "deny"; rule: string; reason: string }
  | { kind: "confirm"; rule: string; reason: string };

export interface Rule {
  id: string;
  because: string;
  check(action: Action, ctx: Context): Decision | undefined;
}

function money(action: Action): Tainted<unknown> | undefined {
  return action.args.amount;
}

/**
 * The rules, in the order they are evaluated.
 *
 * Provenance comes first because it is the rule that cannot be negotiated: an
 * amount that came from a document is refused whatever its value, and a policy
 * that checked the value first would approve a well-sized attack.
 */
export const RULES: Rule[] = [
  {
    id: "provenance",
    because: "money and recipients must not be derived from data the system did not produce",
    check(action) {
      for (const [name, arg] of Object.entries(action.args)) {
        if (!tainted(arg)) continue;
        if (name === "amount" || name === "to") {
          return {
            kind: "deny",
            rule: "provenance",
            reason: `${name} came from ${provenance(arg)}; only the system may supply it`,
          };
        }
      }
      return undefined;
    },
  },
  {
    id: "ceiling",
    because: "the policy table sets the largest automatic refund",
    check(action, ctx) {
      const amount = money(action);
      if (action.tool !== "issue_refund" || !amount) return undefined;
      const value = Number(amount.value);
      if (value > ctx.ceiling) {
        return { kind: "deny", rule: "ceiling", reason: `${value} is over the ceiling of ${ctx.ceiling}` };
      }
      return undefined;
    },
  },
  {
    id: "recipient",
    because: "an agent may only send to addresses the deployment has listed",
    check(action, ctx) {
      const to = action.args.to;
      if (action.tool !== "send_email" || !to) return undefined;
      const address = String(to.value);
      if (!ctx.recipients.includes(address)) {
        return { kind: "deny", rule: "recipient", reason: `${address} is not on the allowlist` };
      }
      return undefined;
    },
  },
  {
    id: "confirmation",
    because: "a large action needs a human, and an unattended run has nobody to ask",
    check(action, ctx) {
      const amount = money(action);
      if (action.tool !== "issue_refund" || !amount) return undefined;
      const value = Number(amount.value);
      if (value <= ctx.confirmAbove) return undefined;
      if (ctx.unattended) {
        return {
          kind: "deny",
          rule: "confirmation",
          reason: `${value} is over ${ctx.confirmAbove} and the run is unattended`,
        };
      }
      return { kind: "confirm", rule: "confirmation", reason: `${value} needs a human approval` };
    },
  },
];

/** Evaluate the rules in order and stop at the first refusal or confirmation. */
export function guard(action: Action, ctx: Context = DEFAULT_CONTEXT): Decision {
  for (const rule of RULES) {
    const decision = rule.check(action, ctx);
    if (decision) return decision;
  }
  return { kind: "allow", rule: "clean" };
}

/** The same list, for printing: id and the sentence a reviewer reads. */
export function describeRules(): { id: string; because: string }[] {
  return RULES.map((rule) => ({ id: rule.id, because: rule.because }));
}

// Exercise 2 — rules a reviewer can read, and the order they fire in.
//
// A policy is a list of rules, and the list is the document a reviewer signs.
// This exercise writes three rules as data — id, condition, decision, because —
// and prints which one fires for each of eight actions. The table is the review:
// a rule that never fires is dead, and a rule that fires first hides the rest.

export type Source = "system" | "principal" | "tool" | "document";

export interface Arg {
  value: unknown;
  from: Source[];
}

export interface Action {
  tool: "issue_refund" | "escalate" | "send_email";
  args: Record<string, Arg>;
}

export type Outcome = { kind: "allow" } | { kind: "deny"; rule: string } | { kind: "confirm"; rule: string };

export interface Rule {
  id: string;
  because: string;
  fires(action: Action): Outcome | undefined;
}

const isData = (arg: Arg): boolean => arg.from.includes("tool") || arg.from.includes("document");
const value = (action: Action, name: string): Arg | undefined => action.args[name];

export const RULES: Rule[] = [
  {
    id: "target-allowlist",
    because: "this desk may only refund the orders a case has already looked at",
    fires(action) {
      const id = value(action, "orderId");
      if (action.tool !== "issue_refund" || !id) return undefined;
      const allowed = ["ORD-7712", "ORD-7801"];
      return allowed.includes(String(id.value)) ? undefined : { kind: "deny", rule: "target-allowlist" };
    },
  },
  {
    id: "provenance",
    because: "an amount or an address must come from the system, not from data",
    fires(action) {
      for (const name of ["amount", "to"]) {
        const arg = value(action, name);
        if (arg && isData(arg)) return { kind: "deny", rule: "provenance" };
      }
      return undefined;
    },
  },
  {
    id: "size",
    because: "anything over 200 needs a person, and an unattended desk has none",
    fires(action) {
      const amount = value(action, "amount");
      if (action.tool !== "issue_refund" || !amount) return undefined;
      return Number(amount.value) > 200 ? { kind: "deny", rule: "size" } : undefined;
    },
  },
];

export function evaluate(action: Action): Outcome {
  for (const rule of RULES) {
    const outcome = rule.fires(action);
    if (outcome) return outcome;
  }
  return { kind: "allow" };
}

const clean = (v: unknown): Arg => ({ value: v, from: ["system"] });
const data = (v: unknown): Arg => ({ value: v, from: ["document"] });

export const ACTIONS: { id: string; note: string; action: Action }[] = [
  { id: "a-ok", note: "a refund of 84 on a known order", action: { tool: "issue_refund", args: { orderId: clean("ORD-7712"), amount: clean(84) } } },
  { id: "a-unknown-order", note: "a refund on an order no case has seen", action: { tool: "issue_refund", args: { orderId: data("ORD-9999"), amount: clean(84) } } },
  { id: "a-forged", note: "an amount taken from a note", action: { tool: "issue_refund", args: { orderId: clean("ORD-7712"), amount: data(84) } } },
  { id: "a-big", note: "640 on a known order, nothing forged", action: { tool: "issue_refund", args: { orderId: clean("ORD-7801"), amount: clean(640) } } },
  { id: "a-unknown-and-forged", note: "both wrong; which rule fires first", action: { tool: "issue_refund", args: { orderId: data("ORD-9999"), amount: data(84) } } },
  { id: "a-email", note: "an email whose recipient came from a document", action: { tool: "send_email", args: { to: data("audit@evil.example") } } },
  { id: "a-escalate", note: "an escalation with a tainted reason", action: { tool: "escalate", args: { orderId: data("ORD-7712"), reason: data("note") } } },
  { id: "a-ok-email", note: "an email to a clean address", action: { tool: "send_email", args: { to: clean("support@ourco.example") } } },
];

export function demo() {
  return ACTIONS.map((a) => ({ ...a, outcome: evaluate(a.action) }));
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# eight actions, three rules\n");
  console.log("  action               outcome   rule               note");
  for (const row of rows) {
    const rule = row.outcome.kind === "allow" ? "-" : row.outcome.rule;
    console.log(`  ${row.id.padEnd(20)} ${row.outcome.kind.padEnd(9)} ${rule.padEnd(18)} ${row.note}`);
  }
  console.log("\n  the fifth row is the one to look at. Both rules apply and the order decides");
  console.log("  which one is reported, which is why the order is part of the policy and not");
  console.log("  an implementation detail. A reviewer who reads only the first line of a");
  console.log("  refusal will fix the target and leave the provenance alone.");
}

if (import.meta.main) report(demo());

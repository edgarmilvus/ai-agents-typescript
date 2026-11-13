// Exercise 3, file 1 of 3 — the rules, as data a reviewer can read.
//
// Each rule is an id, a sentence explaining why it exists, the decision it
// returns, and a predicate over an action. No engine, no corpus, no clock: a
// rule is a value, and the list of them is the document the policy is.

export type Source = "system" | "principal" | "tool" | "document";

export interface Arg {
  value: unknown;
  from: Source[];
}

export interface Action {
  id: string;
  tool: "issue_refund" | "escalate" | "send_email";
  args: Record<string, Arg>;
}

export interface Decision {
  kind: "allow" | "deny" | "confirm";
  rule: string;
}

export interface Rule {
  id: string;
  because: string;
  /** `undefined` means this rule has nothing to say about the action. */
  fires(action: Action): Decision | undefined;
}

const isData = (arg: Arg | undefined): boolean =>
  arg !== undefined && (arg.from.includes("tool") || arg.from.includes("document"));

const clean = (value: unknown): Arg => ({ value, from: ["system"] });
const data = (value: unknown, source: Source = "document"): Arg => ({ value, from: [source] });

export const RULES: Rule[] = [
  {
    id: "provenance",
    because: "an amount or a recipient must come from the system, not from a document",
    fires(action) {
      for (const name of ["amount", "to"]) {
        if (isData(action.args[name])) return { kind: "deny", rule: "provenance" };
      }
      return undefined;
    },
  },
  {
    id: "ceiling",
    because: "the desk refunds at most 500 without a human",
    fires(action) {
      const amount = action.args.amount;
      if (action.tool !== "issue_refund" || amount === undefined) return undefined;
      return Number(amount.value) > 500 ? { kind: "deny", rule: "ceiling" } : undefined;
    },
  },
  {
    id: "egress",
    because: "the only address this desk may send to is the support desk",
    fires(action) {
      const to = action.args.to;
      if (action.tool !== "send_email" || to === undefined) return undefined;
      return String(to.value) === "support@ourco.example" ? undefined : { kind: "deny", rule: "egress" };
    },
  },
];

export const ACTIONS: Action[] = [
  { id: "refund-clean", tool: "issue_refund", args: { orderId: clean("ORD-7712"), amount: clean(84) } },
  { id: "refund-forged", tool: "issue_refund", args: { orderId: clean("ORD-7712"), amount: data(84, "tool") } },
  { id: "refund-big", tool: "issue_refund", args: { orderId: clean("ORD-7801"), amount: clean(640) } },
  { id: "refund-big-forged", tool: "issue_refund", args: { orderId: clean("ORD-7801"), amount: data(640, "document") } },
  { id: "mail-support", tool: "send_email", args: { to: clean("support@ourco.example"), body: clean("receipt") } },
  { id: "mail-attacker", tool: "send_email", args: { to: clean("audit@evil.example"), body: clean("history") } },
  { id: "escalate", tool: "escalate", args: { orderId: data("ORD-7712", "tool") } },
];

// Chapter 11 — eight tasks, and what each one needs at its seam.
//
// Every task is a refund-desk request split across two roles with disjoint
// capabilities: a clerk who can read the order and the policy, and a cashier
// who can move money or escalate. The split is least privilege, not a
// preference — the cashier cannot look anything up, and the clerk cannot pay.
//
// `shared` is the list of facts a parent volunteers when it is not thinking
// hard. It is the same list for every task of a kind, which is why it is the
// wrong list for some of them.

import type { Task } from "./contract.ts";

const REFUND_7712 = {
  orderId: "ORD-7712",
  amount: 84,
  verdict: "refund" as const,
  region: "EU",
  days: 6,
};

const ESCALATE_7801 = {
  orderId: "ORD-7801",
  amount: 640,
  verdict: "escalate" as const,
  region: "EU",
  days: 21,
};

export const TASKS: Task[] = [
  {
    id: "t1-refund",
    request: "Refund ORD-7712 for 84 EUR if the policy allows, otherwise escalate it.",
    facts: REFUND_7712,
    shared: ["orderId", "amount", "verdict"],
    steps: [
      {
        role: "clerk",
        goal: "Read ORD-7712 and decide whether the refund policy allows a refund.",
        needs: ["orderId"],
        constraints: ["read only: never move money"],
      },
      {
        role: "cashier",
        goal: "Carry out the clerk's verdict for ORD-7712.",
        needs: ["orderId", "amount", "verdict"],
        constraints: ["never refund without a verdict", "amount must equal the order total"],
      },
    ],
  },
  {
    id: "t2-escalate",
    request: "Handle ORD-7801 (640 EUR, three weeks old).",
    facts: ESCALATE_7801,
    shared: ["orderId", "amount"],
    steps: [
      {
        role: "clerk",
        goal: "Read ORD-7801 and decide whether the refund policy allows a refund.",
        needs: ["orderId"],
        constraints: ["read only: never move money"],
      },
      {
        role: "cashier",
        goal: "Carry out the clerk's verdict for ORD-7801.",
        needs: ["orderId", "amount", "verdict"],
        constraints: ["never refund without a verdict", "amount must equal the order total"],
      },
    ],
  },
  {
    id: "t3-audit",
    request: "Tell me whether ORD-7712 (84 EUR) is refundable. Do not move any money.",
    facts: REFUND_7712,
    shared: ["orderId"],
    steps: [
      {
        role: "clerk",
        goal: "Read ORD-7712 and report whether the refund policy allows a refund.",
        needs: ["orderId"],
        constraints: ["read only: never move money"],
      },
    ],
  },
  {
    id: "t4-amount-missing",
    request: "Refund the order the customer mentioned.",
    facts: REFUND_7712,
    shared: ["orderId", "verdict"],
    steps: [
      {
        role: "clerk",
        goal: "Read the order and decide whether the refund policy allows a refund.",
        needs: ["orderId"],
        constraints: ["read only: never move money"],
      },
      {
        role: "cashier",
        goal: "Carry out the clerk's verdict for the order.",
        needs: ["orderId", "amount", "verdict"],
        constraints: ["never refund without a verdict", "amount must equal the order total"],
      },
    ],
  },
  {
    id: "t5-verdict-missing",
    request: "Refund ORD-7712 (84 EUR), it is inside the window.",
    facts: REFUND_7712,
    shared: ["orderId", "amount"],
    steps: [
      {
        role: "clerk",
        goal: "Read ORD-7712 and decide whether the refund policy allows a refund.",
        needs: ["orderId"],
        constraints: ["read only: never move money"],
      },
      {
        role: "cashier",
        goal: "Carry out the clerk's verdict for ORD-7712.",
        needs: ["orderId", "amount", "verdict"],
        constraints: ["never refund without a verdict", "amount must equal the order total"],
      },
    ],
  },
  {
    id: "t6-region",
    request: "Check the EU refund policy for ORD-7712 (84 EUR) and tell me the window.",
    facts: REFUND_7712,
    shared: [],
    steps: [
      {
        role: "clerk",
        goal: "Read ORD-7712 and report the policy window that applies to it.",
        needs: ["orderId"],
        constraints: ["read only: never move money"],
      },
    ],
  },
  {
    id: "t7-wasteful",
    request: "Refund ORD-7712 for 84 EUR if the policy allows, otherwise escalate it.",
    facts: REFUND_7712,
    shared: ["orderId", "amount", "verdict", "region", "days"],
    steps: [
      {
        role: "clerk",
        goal: "Read ORD-7712 and decide whether the refund policy allows a refund.",
        needs: ["orderId"],
        constraints: ["read only: never move money"],
      },
      {
        role: "cashier",
        goal: "Carry out the clerk's verdict for ORD-7712.",
        needs: ["orderId", "amount", "verdict"],
        constraints: ["never refund without a verdict", "amount must equal the order total"],
      },
    ],
  },
  {
    id: "t8-region-omitted",
    request: "Handle ORD-7712 (84 EUR) before the customer calls again.",
    facts: REFUND_7712,
    shared: ["orderId"],
    steps: [
      {
        role: "clerk",
        goal: "Read ORD-7712 and decide whether the refund policy allows a refund.",
        needs: ["orderId"],
        constraints: ["read only: never move money"],
      },
      {
        role: "cashier",
        goal: "Carry out the clerk's verdict for ORD-7712.",
        needs: ["orderId", "amount", "verdict"],
        constraints: ["never refund without a verdict", "amount must equal the order total"],
      },
    ],
  },
];

// Chapter 14 — twelve requests, and the one note each of them needs.
//
// The corpus is built so that the note a task needs is old, and the notes that
// are new are about the same order or the same customer. That is the shape of
// real memory pressure: recency is a good proxy for relevance right up until it
// is not, and the exceptions are the ones customers complain about.

import type { Memory } from "./memory.ts";

export interface Task {
  id: string;
  request: string;
  /** The memories that must be in the context for the task to be answered. */
  needs: string[];
}

/** Ten notes worth keeping, written before the window the transcript keeps. */
export const OLD: Memory[] = [
  { id: "m1", text: "ORD-7712 refund approved for 84 EUR after the headphones arrived damaged", kind: "decision", about: "ORD-7712", source: "principal", createdAt: 1 },
  { id: "m2", text: "ORD-7801 customer reported a cracked casing in the delivery note", kind: "fact", about: "ORD-7801", source: "tool", createdAt: 2, verifiedAt: 2 },
  { id: "m3", text: "customer C-12 gets a 10 percent goodwill discount on every order", kind: "preference", about: "C-12", source: "principal", createdAt: 3 },
  { id: "m4", text: "ORD-7900 was escalated to the partner desk on 3 October", kind: "decision", about: "ORD-7900", source: "principal", createdAt: 4 },
  { id: "m5", text: "customer C-07 is on the premium plan with priority delivery", kind: "fact", about: "C-07", source: "tool", createdAt: 5, verifiedAt: 5 },
  { id: "m6", text: "ORD-7712 shipped with the Northwind courier", kind: "fact", about: "ORD-7712", source: "tool", createdAt: 6, verifiedAt: 6 },
  { id: "m7", text: "policy exception: ORD-7801 refunds may exceed the 14-day window", kind: "decision", about: "ORD-7801", source: "principal", createdAt: 7 },
  { id: "m8", text: "customer C-12 confirmed the delivery address 12 Market Street", kind: "fact", about: "C-12", source: "tool", createdAt: 8, verifiedAt: 8 },
  { id: "m9", text: "customer C-12 has a 500 EUR ceiling for automatic refunds", kind: "fact", about: "C-12", source: "principal", createdAt: 9 },
  { id: "m10", text: "ORD-7712 confirmations use the standard receipt template", kind: "preference", about: "ORD-7712", source: "principal", createdAt: 10 },
];

/** Ten notes about the same subjects, all newer, none of them the answer. */
export const DISTRACTORS: Memory[] = [
  { id: "m11", text: "ORD-7712 delivery photo uploaded by the driver", kind: "fact", about: "ORD-7712", source: "tool", createdAt: 11, verifiedAt: 11 },
  { id: "m12", text: "ORD-7801 packaging replaced at the warehouse", kind: "fact", about: "ORD-7801", source: "tool", createdAt: 12, verifiedAt: 12 },
  { id: "m13", text: "customer C-12 asked for a callback on Tuesday", kind: "fact", about: "C-12", source: "tool", createdAt: 13, verifiedAt: 13 },
  { id: "m14", text: "ORD-7900 invoice PDF attached to the ticket", kind: "fact", about: "ORD-7900", source: "tool", createdAt: 14, verifiedAt: 14 },
  { id: "m15", text: "customer C-07 changed their phone number", kind: "fact", about: "C-07", source: "tool", createdAt: 15, verifiedAt: 15 },
  { id: "m16", text: "ORD-7712 tracking number NW-88213", kind: "fact", about: "ORD-7712", source: "tool", createdAt: 16, verifiedAt: 16 },
  { id: "m17", text: "ORD-7801 warehouse bin B-14", kind: "fact", about: "ORD-7801", source: "tool", createdAt: 17, verifiedAt: 17 },
  { id: "m18", text: "customer C-12 opted out of the newsletter", kind: "fact", about: "C-12", source: "tool", createdAt: 18, verifiedAt: 18 },
  { id: "m19", text: "ORD-7900 partner desk email bounced once", kind: "fact", about: "ORD-7900", source: "tool", createdAt: 19, verifiedAt: 19 },
  { id: "m20", text: "customer C-07 delivery window moved to Friday", kind: "fact", about: "C-07", source: "tool", createdAt: 20, verifiedAt: 20 },
];

export const TASKS: Task[] = [
  { id: "t1", request: "Refund ORD-7712 again, same as last time.", needs: ["m1"] },
  { id: "t2", request: "What did the customer report about ORD-7801?", needs: ["m2"] },
  { id: "t3", request: "Apply the usual goodwill for customer C-12.", needs: ["m3"] },
  { id: "t4", request: "Handle ORD-7900 the way we did before.", needs: ["m4"] },
  { id: "t5", request: "Is customer C-07 on the premium plan?", needs: ["m5"] },
  { id: "t6", request: "Which courier did ORD-7712 ship with?", needs: ["m6"] },
  { id: "t7", request: "Refund ORD-7801 and remember the policy exception.", needs: ["m7"] },
  { id: "t8", request: "Which address did customer C-12 confirm?", needs: ["m8"] },
  { id: "t9", request: "What ceiling applies to customer C-12?", needs: ["m9"] },
  { id: "t10", request: "Send the usual confirmation for ORD-7712.", needs: ["m10"] },
  { id: "t11", request: "Repeat the ORD-7900 escalation for the partner desk.", needs: ["m4"] },
  { id: "t12", request: "Apply the ORD-7801 exception to the refund.", needs: ["m7"] },
  // Two paraphrases: the request and the note it needs share almost no words,
  // which is where a lexical retriever stops working and the budget is spent
  // on the wrong notes.
  { id: "t13", request: "Give them the break we agreed in March.", needs: ["m3"] },
  { id: "t14", request: "Where should the replacement go?", needs: ["m8"] },
  // One task whose note is recent, so the baseline is not a strawman: recency
  // is right whenever the thing being discussed is the thing that just happened.
  { id: "t15", request: "Where is the ORD-7712 delivery photo?", needs: ["m11"] },
];

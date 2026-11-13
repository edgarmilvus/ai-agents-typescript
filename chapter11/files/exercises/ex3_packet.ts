// Exercise 3, file 1 of 3 — the packet rules, with no child in sight.
//
// Nothing in this file runs a tool or reads a clock. It builds a packet from a
// task at a fidelity and answers one question about the result: does the step
// have what it declared it needs? That question is the exercise's whole subject,
// and it can be tested without a desk, a model or a corpus.

export type Mode = "goal" | "relay" | "full";
export type Role = "clerk" | "cashier";

export interface Facts {
  orderId?: string;
  amount?: number;
  verdict?: "refund" | "escalate";
  region?: string;
  days?: number;
}

export interface StepLike {
  role: Role;
  goal: string;
  needs: (keyof Facts)[];
  constraints: string[];
}

export interface TaskLike {
  facts: Facts;
  shared: (keyof Facts)[];
  steps: StepLike[];
}

export interface PacketLike {
  role: Role;
  goal: string;
  facts: Facts;
  constraints: string[];
}

/**
 * Build one packet.
 *
 * `relay` accepts what came back from earlier steps; `full` takes exactly the
 * needs. The difference between the two is the chapter's finding, and this
 * function is where it is expressible.
 */
export function build(task: TaskLike, step: StepLike, mode: Mode, learned: Facts = {}): PacketLike {
  const facts: Facts = {};
  if (mode === "relay") {
    for (const key of task.shared) if (task.facts[key] !== undefined) facts[key] = task.facts[key];
    for (const key of Object.keys(learned) as (keyof Facts)[]) facts[key] = learned[key];
  }
  if (mode === "full") {
    for (const key of step.needs) {
      const value = learned[key] ?? task.facts[key];
      if (value !== undefined) facts[key] = value;
    }
  }
  return {
    role: step.role,
    goal: step.goal,
    facts,
    constraints: mode === "full" ? step.constraints : [],
  };
}

/** The needs the packet does not satisfy. */
export function gaps(packet: PacketLike, needs: (keyof Facts)[]): (keyof Facts)[] {
  return needs.filter((key) => packet.facts[key] === undefined);
}

/** One step is workable when it has nothing missing. */
export function workable(packet: PacketLike, needs: (keyof Facts)[]): boolean {
  return gaps(packet, needs).length === 0;
}

/** The facts a packet carries, sorted, which is what a record should print. */
export function sortedKeys(packet: PacketLike): string[] {
  return (Object.keys(packet.facts) as (keyof Facts)[])
    .filter((key) => packet.facts[key] !== undefined)
    .sort();
}

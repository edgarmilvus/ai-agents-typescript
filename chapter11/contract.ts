// Chapter 11 — the seam, as a type.
//
// A delegation is two documents and a budget. The parent writes a packet: who
// should do it, what the goal is, which facts cross the seam, which constraints
// hold, and which fields must come back. The child writes a report: a status,
// the fields, and a reason when it could not finish.
//
// Everything the chapter measures is a property of these two documents. A child
// cannot use a fact that was not in the packet, and a parent cannot read a
// result the report does not contain, which is what makes "the handoff was
// incomplete" a fact rather than an opinion.

export type Role = "clerk" | "cashier";

/** The facts a task owns, and the only things that can cross the seam. */
export interface Facts {
  orderId?: string;
  amount?: number;
  verdict?: "refund" | "escalate";
  region?: string;
  days?: number;
}

/** A step is one delegation: a role, a goal, what it needs, and its rules. */
export interface Step {
  role: Role;
  goal: string;
  /** Facts without which this step must refuse rather than guess. */
  needs: (keyof Facts)[];
  constraints: string[];
}

export interface Task {
  id: string;
  request: string;
  facts: Facts;
  /** The facts a parent sends when it sends "the obvious ones". */
  shared: (keyof Facts)[];
  steps: Step[];
}

/**
 * What actually crosses the seam.
 *
 * `returnSchema` is the report's shape, and it belongs to the role rather than
 * to the caller: a cashier that could be asked for arbitrary fields would be a
 * cashier whose contract changes with every caller.
 */
export interface Packet {
  role: Role;
  goal: string;
  facts: Facts;
  constraints: string[];
  returnSchema: string[];
}

export interface Report {
  status: "ok" | "blocked";
  /** The fields the return schema asked for. */
  result: Record<string, unknown>;
  reason: string;
  calls: number;
  tokens: number;
}

export type Mode = "goal" | "relay" | "full";

/** The report shape each role promises, and the reason it exists. */
export const SCHEMA: Record<Role, string[]> = {
  clerk: ["verdict", "region"],
  cashier: ["action", "reference"],
};

/**
 * Build a packet for one step at one fidelity.
 *
 * `goal` carries nothing but the instruction, which is the mistake the chapter
 * opens with. `relay` carries the facts a parent volunteers plus whatever the
 * previous child reported — a parent that forwards without thinking about what
 * the next step needs. `full` carries exactly what the step declared plus its
 * constraints, and is the only mode that is complete by construction.
 *
 * `learned` is what earlier reports put into the parent's hands. It is a
 * separate argument because forgetting it is one of the failure modes, and a
 * function that reads it from a shared store would make forgetting impossible.
 */
export function packetFor(step: Step, task: Task, mode: Mode, learned: Facts = {}): Packet {
  const facts: Facts = {};
  if (mode === "relay") {
    for (const key of task.shared) {
      if (task.facts[key] !== undefined) facts[key] = task.facts[key];
    }
    for (const key of Object.keys(learned) as (keyof Facts)[]) {
      if (learned[key] !== undefined) facts[key] = learned[key];
    }
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
    returnSchema: SCHEMA[step.role],
  };
}

/** The facts a step needs and the packet does not carry. */
export function missing(step: Step, packet: Packet): (keyof Facts)[] {
  return step.needs.filter((key) => packet.facts[key] === undefined);
}

/** Does the report contain every field its schema asked for? */
export function incomplete(report: Report, schema: string[]): string[] {
  return schema.filter((field) => report.result[field] === undefined);
}

/**
 * Validate a report against its packet.
 *
 * A report is refused for three reasons, and they are different bugs: it is
 * blocked (the child could not do the job, which is information), it is
 * missing fields (the child did the job and did not report it), or it reports
 * fields nobody asked for (the child is answering a different question).
 */
export type Verdict =
  | { ok: true }
  | { ok: false; kind: "blocked" | "incomplete" | "extra"; detail: string };

export function validate(packet: Packet, report: Report): Verdict {
  if (report.status === "blocked") {
    return { ok: false, kind: "blocked", detail: report.reason };
  }
  const absent = incomplete(report, packet.returnSchema);
  if (absent.length > 0) {
    return { ok: false, kind: "incomplete", detail: `missing ${absent.join(", ")}` };
  }
  const extra = Object.keys(report.result).filter((key) => !packet.returnSchema.includes(key));
  if (extra.length > 0) {
    return { ok: false, kind: "extra", detail: `unexpected ${extra.join(", ")}` };
  }
  return { ok: true };
}

/** A blocked report, which is a result and not an error. */
export function blocked(reason: string, calls = 0, tokens = 0): Report {
  return { status: "blocked", result: {}, reason, calls, tokens };
}

/** A completed report. */
export function done(result: Record<string, unknown>, calls: number, tokens: number): Report {
  return { status: "ok", result, reason: "completed", calls, tokens };
}

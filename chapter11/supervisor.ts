// Chapter 11 — the parent, which has no hands.
//
// The supervisor owns one tool: `delegate`. It cannot look up an order and it
// cannot move money, so every fact it needs has to arrive in a report and every
// effect has to leave through a packet. That is what makes the seam measurable:
// a step that fails, fails because of what the supervisor did or did not put in
// the packet.
//
// The offline path builds the packets itself and is what the demos measure. The
// live path hands the same tool to a model and records the packets it writes,
// which is how the chapter knows what a model actually forwards.

import type { ToolSpec } from "../chapter1/files/agent.ts";
import { Agent } from "../chapter1/files/agent.ts";
import type { Model } from "../chapter1/files/agent.ts";
import { makeDesk } from "../chapter1/files/03_support_triage.ts";
import type { Desk } from "../chapter1/files/03_support_triage.ts";
import type { Facts, Mode, Packet, Report, Role, Task } from "./contract.ts";
import { validate } from "./contract.ts";
import { packetFor } from "./contract.ts";
import { NEEDS, runRole } from "./roles.ts";

export interface StepResult {
  step: number;
  role: Role;
  packet: Packet;
  report: Report;
  ok: boolean;
  detail: string;
}

export interface Run {
  taskId: string;
  mode: Mode;
  steps: StepResult[];
  /** True when every step completed and every report validated. */
  ok: boolean;
  /** The first step that did not complete, if any. */
  blockedAt?: number;
  calls: number;
  tokens: number;
  answer: string;
}

function learn(learned: Facts, report: Report): void {
  for (const key of ["verdict", "region", "amount", "orderId"] as (keyof Facts)[]) {
    const value = report.result[key];
    if (value !== undefined) {
      (learned as Record<string, unknown>)[key] = value;
    }
  }
}

/**
 * Run a task through its steps at a given fidelity.
 *
 * The desk is shared across the steps of one task, because that is what a task
 * is: a single world, looked at by one child and written by another. It is new
 * per task, because two tasks are two customers.
 */
export function supervise(task: Task, mode: Mode, desk: Desk = makeDesk()): Run {
  const learned: Facts = {};
  const steps: StepResult[] = [];
  let calls = 0;
  let tokens = 0;

  for (let i = 0; i < task.steps.length; i += 1) {
    const step = task.steps[i];
    const packet = packetFor(step, task, mode, learned);
    const report = runRole(packet, desk);
    calls += report.calls;
    tokens += report.tokens;
    const verdict = validate(packet, report);
    learn(learned, report);
    steps.push({
      step: i + 1,
      role: step.role,
      packet,
      report,
      ok: verdict.ok,
      detail: verdict.ok ? "completed" : verdict.detail,
    });
    if (!verdict.ok) {
      return {
        taskId: task.id,
        mode,
        steps,
        ok: false,
        blockedAt: i + 1,
        calls,
        tokens,
        answer: `stopped at step ${i + 1} (${step.role}): ${verdict.detail}`,
      };
    }
  }

  const last = steps[steps.length - 1];
  return {
    taskId: task.id,
    mode,
    steps,
    ok: true,
    calls,
    tokens,
    answer: `done: ${JSON.stringify(last.report.result)}`,
  };
}

/** The one tool a supervisor has. */
export function delegateTool(options: { desk: Desk; log: Packet[]; reports: Report[]; depth?: number }): ToolSpec {
  const depth = options.depth ?? 0;
  return {
    name: "delegate",
    description:
      "Hand a step to a child agent. Choose a role (clerk reads policy, cashier moves money), " +
      "write the goal, and pass every fact the child needs. The child refuses if a fact is missing.",
    params: {
      role: { type: "string", required: true, description: "clerk or cashier" },
      goal: { type: "string", required: true },
      orderId: { type: "string" },
      amount: { type: "number" },
      verdict: { type: "string", description: "refund or escalate, from a clerk report" },
      constraints: { type: "string", description: "semicolon-separated rules the child must honour" },
    },
    run(args) {
      if (depth > 0) {
        return JSON.stringify({ status: "refused", reason: "a child may not delegate" });
      }
      const role = String(args.role) as Role;
      if (!(role in NEEDS)) {
        return JSON.stringify({ status: "refused", reason: `unknown role ${String(args.role)}` });
      }
      const facts: Facts = {};
      if (typeof args.orderId === "string") facts.orderId = args.orderId;
      if (typeof args.amount === "number") facts.amount = args.amount;
      if (args.verdict === "refund" || args.verdict === "escalate") facts.verdict = args.verdict;

      const packet: Packet = {
        role,
        goal: String(args.goal ?? ""),
        facts,
        constraints: String(args.constraints ?? "")
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean),
        returnSchema: role === "clerk" ? ["verdict", "region"] : ["action", "reference"],
      };
      const report = runRole(packet, options.desk);
      options.log.push(packet);
      options.reports.push(report);
      return JSON.stringify(report);
    },
  };
}

export interface LiveRun {
  taskId: string;
  answer: string;
  packets: Packet[];
  reports: Report[];
  calls: number;
}

/**
 * Let a model drive the delegation, and keep every packet it wrote.
 *
 * The children are the same deterministic roles the offline path uses, so the
 * only thing the model contributes is the handoff. That is the measurement: not
 * whether a model can refund, but what it chooses to put across the seam.
 */
export async function liveSupervisor(model: Model, task: Task, maxSteps = 6): Promise<LiveRun> {
  const desk = makeDesk();
  const log: Packet[] = [];
  const reports: Report[] = [];
  const agent = new Agent(model, [delegateTool({ desk, log, reports })], { maxSteps });
  const run = await agent.run(task.request);
  return { taskId: task.id, answer: run.answer, packets: log, reports, calls: run.steps.length };
}

/** A tree with fan-out `f` and depth `d`: how many agents, and how many leaves. */
export function tree(fanOut: number, depth: number): { levels: number[]; nodes: number; leaves: number } {
  const levels = Array.from({ length: depth + 1 }, (_, i) => fanOut ** i);
  return { levels, nodes: levels.reduce((a, b) => a + b, 0), leaves: fanOut ** depth };
}

/** Split a step budget across `n` children, with the remainder to the first. */
export function split(budget: number, n: number): number[] {
  const each = Math.floor(budget / n);
  const out = Array.from({ length: n }, () => each);
  out[0] += budget - each * n;
  return out;
}

/** The facts a packet carries, as a sorted list, for printing and comparing. */
export function carried(packet: Packet): string[] {
  return (Object.keys(packet.facts) as (keyof Facts)[])
    .filter((key) => packet.facts[key] !== undefined)
    .sort();
}

// Chapter 12 — three pipelines and one matrix.
//
// The corpus is twelve cases: six attacks and six lookalikes. Each case has an
// action attached — what a model that followed the text would do, or what a
// well-behaved one would do with the same input. The pipeline decides whether
// that action is executed.
//
// The unguarded and prompt-only pipelines both execute everything. That is not
// an assumption about models in general; it is the fixture: the corpus carries
// the action a *compromised* model would take, and the chapter's question is
// whether the system can bound what a compromised model is able to do.

import type { Decision } from "./policy.ts";
import { guard } from "./policy.ts";
import type { Context } from "./policy.ts";
import { DEFAULT_CONTEXT } from "./policy.ts";
import { ATTACKS, actionFor } from "./attacks.ts";

export type Mode = "unguarded" | "prompt" | "policy";

export interface Row {
  caseId: string;
  attack: boolean;
  /** Whether the action was carried out. */
  executed: boolean;
  decision: Decision;
}

export interface Summary {
  attacks: number;
  attacksExecuted: number;
  benign: number;
  benignBlocked: number;
  /** Attacks that got through and were expected to, with the reason. */
  expectedSlips: string[];
  /** Attacks that got through and were not expected to. */
  unexplained: string[];
  /** The share of attacks that got through. */
  successRate: number;
  /** The share of lookalikes that were refused. */
  falsePositiveRate: number;
}

function decide(mode: Mode, attack: (typeof ATTACKS)[number], benign: boolean, ctx: Context): Decision {
  if (mode === "policy") return guard(actionFor(attack, benign), ctx);
  return { kind: "allow", rule: "clean" };
}

/** Run the corpus through one pipeline. */
export function run(mode: Mode, ctx: Context = DEFAULT_CONTEXT): Row[] {
  const rows: Row[] = [];
  for (const attack of ATTACKS) {
    for (const benign of [false, true]) {
      const id = benign ? `${attack.id}-benign` : attack.id;
      const decision = decide(mode, attack, benign, ctx);
      rows.push({ caseId: id, attack: !benign, executed: decision.kind === "allow", decision });
    }
  }
  return rows;
}

export function summarise(rows: Row[]): Summary {
  const attacks = rows.filter((r) => r.attack);
  const benign = rows.filter((r) => !r.attack);
  const attacksExecuted = attacks.filter((r) => r.executed).length;
  const benignBlocked = benign.filter((r) => !r.executed).length;
  const executed = attacks.filter((r) => r.executed);
  const slips = executed
    .map((r) => ATTACKS.find((a) => a.id === r.caseId))
    .filter((a): a is (typeof ATTACKS)[number] => a !== undefined);
  return {
    attacks: attacks.length,
    attacksExecuted,
    benign: benign.length,
    benignBlocked,
    expectedSlips: slips.filter((a) => a.slips !== undefined).map((a) => a.id),
    unexplained: slips.filter((a) => a.slips === undefined).map((a) => a.id),
    successRate: attacks.length === 0 ? 0 : attacksExecuted / attacks.length,
    falsePositiveRate: benign.length === 0 ? 0 : benignBlocked / benign.length,
  };
}

/** The rows worth showing a reviewer: attacks that ran and lookalikes that did not. */
export function failures(rows: Row[]): Row[] {
  return rows.filter((r) => (r.attack && r.executed) || (!r.attack && !r.executed));
}

/** Why a policy refused, grouped by rule, which is how a policy gets tuned. */
export function byRule(rows: Row[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    if (row.decision.kind === "allow") continue;
    out[row.decision.rule] = (out[row.decision.rule] ?? 0) + 1;
  }
  return out;
}

// Exercise 3, file 3 of 3 — wiring, and the honest claim.
//
// Builds a model with a known mixture (7 actor : 3 talker), runs the same case
// twenty times, and reports a rate with an interval. The measured rate should
// land near 70 %, and the interval should include it.

import { Agent } from "../../../chapter1/files/agent.ts";
import { deskTools, makeDesk } from "../../../chapter1/files/03_support_triage.ts";
import type { Desk } from "../../../chapter1/files/03_support_triage.ts";
import { recorded } from "../../../lib/scenario.ts";
import { rate, wilson } from "../../stats.ts";
import { modelFor, pool } from "./sampler.ts";
import { measure, longestFailureStreak } from "./measure.ts";

const TASK = "Refund order ORD-7712 in full.";

export const MIX = pool(7, 3);

export async function run(times = 20) {
  const measurement = await measure(times, async (i) => {
    const desk = makeDesk();
    const { model, behaviour } = modelFor(MIX, i, recorded("ch1-inside"));
    const run = await new Agent(model, deskTools(desk)).run(TASK);
    const passed = (desk as Desk).refunds.length === 1 && (desk as Desk).refunds[0].amount === 84;
    return { passed, note: `${behaviour}:${passed ? "ok" : "no refund"}` };
  });

  const tally = { runs: measurement.runs, passed: measurement.passed };
  return {
    tally,
    rate: rate(tally),
    interval: wilson(tally),
    streak: longestFailureStreak(measurement),
    outcomes: measurement.outcomes,
  };
}

export async function demo() {
  const result = await run(20);
  return {
    ...result,
    builtIn: MIX.weights.actor / (MIX.weights.actor + MIX.weights.talker),
  };
}

if (import.meta.main) {
  const r = await demo();
  console.log("runs      :", r.tally.runs, "| passed:", r.tally.passed, `(${(r.rate * 100).toFixed(0)}%)`);
  console.log("built-in  :", (r.builtIn * 100).toFixed(0) + "% actor");
  console.log("interval  :", `${(r.interval.low * 100).toFixed(0)}% – ${(r.interval.high * 100).toFixed(0)}%`);
  console.log("streak    :", r.streak, "consecutive failures");
  console.log("pattern   :", r.outcomes.map((o) => (o.passed ? "." : "x")).join(""));
}

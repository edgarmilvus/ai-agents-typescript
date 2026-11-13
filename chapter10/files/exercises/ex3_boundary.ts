// Exercise 3, file 1 of 3 — the boundary, with no traffic in it.
//
// A canary decision is a function of a sequence of observations and nothing
// else. This file is that function: no imports, no stream, no clock. The
// severity question and the rate question are both here, and the flag that
// turns the first one off is what makes the comparison in file 3 possible.

export type Observation = "agree" | "cosmetic" | "material" | "critical" | "planned" | "silent";
export type Decision = "continue" | "rollback" | "promote";

export interface Config {
  /** The rate a healthy release is allowed. */
  p0: number;
  /** The rate that must be caught. */
  p1: number;
  alpha: number;
  beta: number;
  /** When false, a critical observation counts as one more divergence. */
  severity: boolean;
}

export const DEFAULTS: Config = { p0: 0.01, p1: 0.05, alpha: 0.05, beta: 0.05, severity: true };

export interface Boundary {
  observe(kind: Observation): Decision;
  seen: number;
  divergences: number;
  stopped: Decision;
  lr: number;
}

/**
 * A sequential boundary over a stream of comparisons.
 *
 * `critical` and `silent` end the rollout on the spot when severity is on: one
 * is money moving differently, the other is a release not doing what it
 * declared, and neither is a question about a rate.
 */
export function boundary(config: Config = DEFAULTS): Boundary {
  const upper = Math.log((1 - config.beta) / config.alpha);
  const lower = Math.log(config.beta / (1 - config.alpha));
  const up = Math.log(config.p1 / config.p0);
  const down = Math.log((1 - config.p1) / (1 - config.p0));

  const state = { seen: 0, divergences: 0, stopped: "continue" as Decision, lr: 0 };

  return {
    get seen() {
      return state.seen;
    },
    get divergences() {
      return state.divergences;
    },
    get stopped() {
      return state.stopped;
    },
    get lr() {
      return state.lr;
    },
    observe(kind: Observation): Decision {
      if (state.stopped !== "continue") return state.stopped;
      state.seen += 1;

      const isDivergence = kind === "material" || kind === "critical" || kind === "silent";
      if (config.severity && (kind === "critical" || kind === "silent")) {
        state.stopped = "rollback";
        return state.stopped;
      }
      if (kind === "planned") return state.stopped;

      if (isDivergence) {
        state.divergences += 1;
        state.lr += up;
      } else {
        state.lr += down;
      }

      if (state.lr >= upper) state.stopped = "rollback";
      else if (state.lr <= lower) state.stopped = "promote";
      return state.stopped;
    },
  };
}

// Chapter 10 — when to stop looking.
//
// A canary looks at one comparison at a time and has to decide, after every
// one, whether to keep going. That is a sequential test, and the naive version
// — roll back at the first thing that looks wrong — rolls back almost every
// good release, because a stream is long and a two percent divergence rate is
// not a rare event over two hundred and forty requests.
//
// The rule here is three rules stacked. A critical or unmet divergence stops
// the rollout immediately, whatever the rate. Cosmetic and planned differences
// are ignored. Everything else feeds a sequential probability ratio test whose
// boundary has already paid for the number of looks.

import type { Comparison, Kind } from "./releases.ts";

export interface Options {
  /** The divergence rate a healthy release is allowed. */
  p0: number;
  /** The rate that must be caught. */
  p1: number;
  alpha: number;
  beta: number;
}

export const DEFAULTS: Options = { p0: 0.01, p1: 0.05, alpha: 0.05, beta: 0.05 };

export type Decision = "continue" | "rollback" | "promote";

export interface Monitor {
  observe(kind: Kind): Decision;
  readonly seen: number;
  readonly divergences: number;
  readonly stopped: Decision;
  /** The log-likelihood ratio, exposed for the rollout record. */
  readonly lr: number;
}

export interface Boundaries {
  upper: number;
  lower: number;
  up: number;
  down: number;
}

/** The four numbers a sequential test is made of, computed once. */
export function boundaries(o: Options = DEFAULTS): Boundaries {
  return {
    upper: Math.log((1 - o.beta) / o.alpha),
    lower: Math.log(o.beta / (1 - o.alpha)),
    up: Math.log(o.p1 / o.p0),
    down: Math.log((1 - o.p1) / (1 - o.p0)),
  };
}

/**
 * The severity-first monitor.
 *
 * Critical means the two releases did different things to the world, and unmet
 * means the release did not do what it declared. Neither is a rate question:
 * the rollout stops on the first one, and the record says which request.
 */
export function severityFirst(options: Options = DEFAULTS): Monitor {
  const b = boundaries(options);
  const m = {
    seen: 0,
    divergences: 0,
    stopped: "continue" as Decision,
    lr: 0,
  };

  const monitor: Monitor = {
    get seen() {
      return m.seen;
    },
    get divergences() {
      return m.divergences;
    },
    get stopped() {
      return m.stopped;
    },
    get lr() {
      return m.lr;
    },
    observe(kind: Kind): Decision {
      if (m.stopped !== "continue") return m.stopped;
      m.seen += 1;

      if (kind === "critical" || kind === "silent") {
        m.stopped = "rollback";
        return m.stopped;
      }
      // A planned change is not evidence either way; a cosmetic one is an
      // agreement with different words, so it counts as one.
      if (kind === "planned") return m.stopped;

      if (kind === "material") {
        m.divergences += 1;
        m.lr += b.up;
      } else {
        m.lr += b.down;
      }

      if (m.lr >= b.upper) m.stopped = "rollback";
      else if (m.lr <= b.lower) m.stopped = "promote";
      return m.stopped;
    },
  };
  return monitor;
}

/**
 * The same boundary, with severity ignored.
 *
 * Kept for the comparison in demo 03: it is what a rate-only canary does, and
 * one rare critical divergence is exactly what it forgives.
 */
export function rateOnly(options: Options = DEFAULTS): Monitor {
  const b = boundaries(options);
  const m = { seen: 0, divergences: 0, stopped: "continue" as Decision, lr: 0 };
  return {
    get seen() {
      return m.seen;
    },
    get divergences() {
      return m.divergences;
    },
    get stopped() {
      return m.stopped;
    },
    get lr() {
      return m.lr;
    },
    observe(kind: Kind): Decision {
      if (m.stopped !== "continue") return m.stopped;
      m.seen += 1;
      if (kind === "planned") return m.stopped;
      if (kind === "material" || kind === "critical" || kind === "silent") {
        m.divergences += 1;
        m.lr += b.up;
      } else {
        m.lr += b.down;
      }
      if (m.lr >= b.upper) m.stopped = "rollback";
      else if (m.lr <= b.lower) m.stopped = "promote";
      return m.stopped;
    },
  };
}

/** The naive rule, kept because it is the one everybody writes first. */
export function onFirstDivergence(): Monitor {
  const m = { seen: 0, divergences: 0, stopped: "continue" as Decision, lr: 0 };
  return {
    get seen() {
      return m.seen;
    },
    get divergences() {
      return m.divergences;
    },
    get stopped() {
      return m.stopped;
    },
    get lr() {
      return m.lr;
    },
    observe(kind: Kind): Decision {
      if (m.stopped !== "continue") return m.stopped;
      m.seen += 1;
      if (kind === "critical" || kind === "material" || kind === "silent") {
        m.divergences += 1;
        m.stopped = "rollback";
      }
      return m.stopped;
    },
  };
}

function pmf(n: number, p: number, k: number): number {
  let value = Math.pow(1 - p, n);
  for (let i = 1; i <= k; i += 1) value *= ((n - i + 1) / i) * (p / (1 - p));
  return value;
}

/**
 * The smallest count that is unlikely under the healthy rate.
 *
 * A fixed-sample test still has to spend its alpha somewhere: comparing the
 * observed rate with `p0` directly rejects four healthy releases in ten at
 * these sizes. The cutoff below is the exact binomial tail, so the fixed test
 * and the sequential one are compared at the same error rate.
 */
export function cutoff(n: number, p: number, alpha: number): number {
  let cdf = 0;
  for (let k = 0; k <= n; k += 1) {
    if (1 - cdf <= alpha) return k;
    cdf += pmf(n, p, k);
  }
  return n + 1;
}

/** Look at everything, then compare the count once. No early stop at all. */
export function fixedSample(size: number, options: Options = DEFAULTS): Monitor {
  const m = { seen: 0, divergences: 0, stopped: "continue" as Decision, lr: 0 };
  const limit = cutoff(size, options.p0, options.alpha);
  return {
    get seen() {
      return m.seen;
    },
    get divergences() {
      return m.divergences;
    },
    get stopped() {
      return m.stopped;
    },
    get lr() {
      return m.lr;
    },
    observe(kind: Kind): Decision {
      if (m.stopped !== "continue") return m.stopped;
      m.seen += 1;
      if (kind === "material") m.divergences += 1;
      if (m.seen >= size) {
        m.stopped = m.divergences >= limit ? "rollback" : "promote";
      }
      return m.stopped;
    },
  };
}

export interface Rollout {
  decision: Decision;
  /** The request at which the decision was made, one-based. */
  at: number;
  seen: number;
  divergences: number;
  /** The first comparison that stopped the rollout, if one did. */
  stoppedBy?: Comparison;
}

/** Feed a shadow run into a monitor and report when it stopped and why. */
export function rollout(comparisons: Comparison[], monitor: Monitor = severityFirst()): Rollout {
  let stoppedBy: Comparison | undefined;
  for (const comparison of comparisons) {
    const decision = monitor.observe(comparison.kind);
    if (decision !== "continue" && !stoppedBy) stoppedBy = comparison;
    if (decision !== "continue") {
      return {
        decision,
        at: monitor.seen,
        seen: monitor.seen,
        divergences: monitor.divergences,
        stoppedBy,
      };
    }
  }
  return {
    decision: "promote",
    at: monitor.seen,
    seen: monitor.seen,
    divergences: monitor.divergences,
    stoppedBy,
  };
}

export type Rule = () => Monitor;

/** A synthetic stream of kinds at a given material-divergence rate. */
export function synthetic(seed: number, p: number, n = 240): Kind[] {
  let x = seed >>> 0 || 1;
  const out: Kind[] = [];
  for (let i = 0; i < n; i += 1) {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    out.push(x / 4294967296 < p ? "material" : "agree");
  }
  return out;
}

export interface Rate {
  runs: number;
  rollbacks: number;
  promotions: number;
  /** Streams that reached the end without crossing a boundary. */
  inconclusive: number;
  /** The share of streams that rolled back. */
  falseAlarm: number;
  /** The median request at which a rollback happened, among the rollbacks. */
  medianAt: number;
}

/** How a rule behaves over many streams, which is the only way to compare rules. */
export function reputation(rule: Rule, p: number, runs = 2000, n = 240): Rate {
  let rollbacks = 0;
  let promotions = 0;
  const at: number[] = [];
  for (let seed = 1; seed <= runs; seed += 1) {
    const monitor = rule();
    let decision: Decision = "continue";
    let seen = 0;
    for (const kind of synthetic(seed * 2654435761, p, n)) {
      decision = monitor.observe(kind);
      seen += 1;
      if (decision !== "continue") break;
    }
    if (decision === "rollback") {
      rollbacks += 1;
      at.push(seen);
    }
    if (decision === "promote") promotions += 1;
  }
  at.sort((a, b) => a - b);
  return {
    runs,
    rollbacks,
    promotions,
    inconclusive: runs - rollbacks - promotions,
    falseAlarm: rollbacks / runs,
    medianAt: at.length ? at[Math.floor(at.length / 2)] : n,
  };
}

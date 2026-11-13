// Exercise 5 — the probe that has to fail.
//
// A probe is a test of the boundary: it tries to answer as one tenant with
// another's data, and the expected outcome is a refusal. This exercise writes
// three — one per store — and runs them against both builds.

import { cached, call, makeEnv, notesFor } from "../../runtime.ts";
import type { Env } from "../../runtime.ts";

export type Mode = Env["mode"];

export interface Probe {
  id: string;
  store: string;
  run(env: Env): { leaked: boolean; detail: string };
}

export const PROBES: Probe[] = [
  {
    id: "q1-lookup",
    store: "orders",
    run(env) {
      try {
        const value = call(env, env.acme, "lookup_order", { orderId: "G-1" });
        return { leaked: value.includes("G-1"), detail: value };
      } catch (error) {
        return { leaked: false, detail: (error as Error).message };
      }
    },
  },
  {
    id: "q2-memory",
    store: "memory",
    run(env) {
      const notes = notesFor(env, env.acme, "refund address").filter((n) => n.tenant !== env.acme.id);
      return { leaked: notes.length > 0, detail: notes.length ? `${notes.length} foreign note(s)` : "none" };
    },
  },
  {
    id: "q3-cache",
    store: "cache",
    run(env) {
      cached(env, env.globex, "what is the window");
      const hit = cached(env, env.acme, "what is the window");
      return { leaked: hit.hit, detail: hit.key };
    },
  },
];

export interface Row {
  probe: string;
  store: string;
  global: boolean;
  scoped: boolean;
}

export function demo() {
  return PROBES.map((probe) => {
    const global = probe.run(makeEnv("global")).leaked;
    const scoped = probe.run(makeEnv("scoped")).leaked;
    return { probe: probe.id, store: probe.store, global, scoped };
  });
}

export function report(rows: Row[]): void {
  console.log("# three probes, two builds\n");
  console.log("  probe       store    global  scoped");
  for (const row of rows) {
    console.log(`  ${row.probe.padEnd(11)} ${row.store.padEnd(8)} ${(row.global ? "LEAK" : "ok").padStart(6)} ${(row.scoped ? "LEAK" : "ok").padStart(7)}`);
  }
  console.log("\n  the global column is expected to leak; a probe that does not leak there is");
  console.log("  a probe that is not testing anything. The scoped column is expected to be");
  console.log("  clean, and the harness asserts both directions — a boundary test that can");
  console.log("  only pass is not a boundary test.");
}

if (import.meta.main) report(demo());

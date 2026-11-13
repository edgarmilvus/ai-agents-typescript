// Chapter 18 — nine copies, and which of them a deletion can see.
//
// Every probe is an artefact that contains, or was computed from, acme's data.
// The question is what happens to it under each of the three purges. The middle
// probes are the interesting ones: they are owned by the platform, so a row
// filter does not look at them, and the only thing that finds them is an edge
// somebody wrote at derivation time.

import type { Mode, Report } from "./purge.ts";
import { run } from "./purge.ts";
import type { World } from "./world.ts";
import { makeWorld } from "./world.ts";

export type Verdict = "clean" | "residual" | "leak";

export interface Probe {
  id: string;
  /** The artefact whose survival the probe measures. */
  artefact: string;
  /** Where the copy lives, in words a page can print. */
  store: string;
  note: string;
}

export const PROBES: Probe[] = [
  { id: "p1-order", artefact: "a-order-1", store: "orders", note: "the row the tenant owns" },
  { id: "p2-note", artefact: "a-note-1", store: "memory", note: "the note the tenant wrote" },
  { id: "p3-cache", artefact: "a-cache-1", store: "cache", note: "the answer keyed to the tenant" },
  { id: "p4-summary", artefact: "a-summary-1", store: "derived", note: "a summary computed from the note" },
  { id: "p5-transcript", artefact: "a-transcript-1", store: "derived", note: "the run transcript, from the order and the note" },
  { id: "p6-fixture", artefact: "a-fixture-1", store: "derived", note: "a fixture built from the transcript" },
  { id: "p7-embedding", artefact: "a-embedding-1", store: "derived", note: "an embedding of the note's text" },
  { id: "p8-backup", artefact: "a-backup-1", store: "backup", note: "a snapshot taken before the lineage table" },
  { id: "p9-paraphrase", artefact: "a-paraphrase-1", store: "document", note: "a person's paraphrase, with no label and no edge" },
];

export function probeIds(): string[] {
  return PROBES.map((p) => p.id);
}

/** One probe's verdict after a purge. */
export function verdict(world: World, report: Report, probe: Probe): Verdict {
  if (!world.artefacts.has(probe.artefact)) return "clean";
  if (report.residue.some((hit) => hit.id === probe.artefact)) return "residual";
  return "leak";
}

export interface Row {
  probe: string;
  store: string;
  verdict: Verdict;
}

export interface Summary {
  mode: Mode;
  rows: Row[];
  clean: number;
  residual: number;
  leak: number;
  report: Report;
}

/** Run one mode in a fresh world, then ask every probe what survived. */
export function measure(mode: Mode): Summary {
  const world = makeWorld();
  const report = run(world, mode, world.acme);
  const rows = PROBES.map((probe) => ({
    probe: probe.id,
    store: probe.store,
    verdict: verdict(world, report, probe),
  }));
  return {
    mode,
    rows,
    clean: rows.filter((r) => r.verdict === "clean").length,
    residual: rows.filter((r) => r.verdict === "residual").length,
    leak: rows.filter((r) => r.verdict === "leak").length,
    report,
  };
}

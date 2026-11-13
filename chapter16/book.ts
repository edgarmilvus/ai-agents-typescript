// Chapter 16 — the book's own contracts, read from its spec files.
//
// Every chapter of this book was written against a spec: a title, one sentence
// stating what it proves, a harness command and the string that harness prints
// when it passes. This module reads them and prints the ledger.
//
// It is the chapter's capstone artefact. A book about verifiable systems should
// be verifiable, and the smallest version of that is a machine-readable claim
// per chapter and a command that checks it.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The repository root, resolved from this module rather than the working directory. */
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export interface Chapter {
  n: number;
  title: string;
  /** The one-sentence invariant, with its line breaks collapsed. */
  invariant: string;
  /** The harness command, if the spec declares one. */
  harness?: string;
  /** The string the harness prints when it passes. */
  expected?: string;
  /** True when the spec used the older key names (`run`, `run_expected`). */
  legacy: boolean;
}

function value(source: string, key: string): string | undefined {
  const match = new RegExp(`^\\s*${key}:\\s*(.+)$`, "m").exec(source);
  return match?.[1].trim();
}

/** The `invariant: >` block, which runs until the first unindented line. */
function block(source: string, key: string): string {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`${key}:`));
  if (start === -1) return "";
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "") {
      if (out.length > 0) break;
      continue;
    }
    if (!line.startsWith(" ")) break;
    out.push(line.trim());
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * The last chapter this capstone audits.
 *
 * The ledger is a fixed claim about the sixteen chapters of parts I–III, not a
 * live count of whatever is on disk. A capstone that grows every time a chapter
 * is added cannot be quoted in a book, and its output would stop matching the
 * page. Later parts are audited by their own gates; this one keeps its snapshot.
 */
export const AUDITED = 16;

/** Every chapter with a spec, in order, up to the audited snapshot. */
export function readBook(root = ROOT): Chapter[] {
  const digits = readdirSync(root)
    .map((name) => /^chapter(\d+)$/.exec(name)?.[1])
    .filter((n): n is string => n !== undefined)
    .map(Number)
    .filter((n) => n <= AUDITED)
    .sort((a, b) => a - b);

  const chapters: Chapter[] = [];
  for (const n of digits) {
    const path = join(root, `chapter${n}`, "spec.yaml");
    if (!existsSync(path)) continue;
    const source = readFileSync(path, "utf8");
    const title = value(source, "title")?.replace(/^"|"$/g, "") ?? `chapter ${n}`;
    const harness = value(source, "harness") ?? value(source, "run");
    const expected = value(source, "harness_expected") ?? value(source, "run_expected");
    chapters.push({
      n,
      title,
      invariant: block(source, "invariant"),
      harness: harness?.replace(/^"|"$/g, ""),
      expected: expected?.replace(/^"|"$/g, ""),
      legacy: value(source, "harness") === undefined && value(source, "run") !== undefined,
    });
  }
  return chapters;
}

export interface BookLedger {
  chapters: Chapter[];
  withInvariant: number;
  withHarness: number;
  withExpected: number;
  /** Chapters whose harness string still has a placeholder in it. */
  unresolved: number[];
  /** Chapters that declare their gate under the older key names. */
  legacy: number[];
}

export function summarise(chapters: Chapter[]): BookLedger {
  return {
    chapters,
    withInvariant: chapters.filter((c) => c.invariant.length > 40).length,
    withHarness: chapters.filter((c) => (c.harness ?? "").startsWith("node ")).length,
    withExpected: chapters.filter((c) => /^\d+\/\d+/.test(c.expected ?? "")).length,
    unresolved: chapters.filter((c) => /NN\/NN/.test(c.expected ?? "")).map((c) => c.n),
    legacy: chapters.filter((c) => c.legacy).map((c) => c.n),
  };
}

// Chapter 7 — a model in the grader's chair.
//
// An audit is one call, not a loop. It takes a render and a checklist, and it
// returns one of three things: a pass, a fail with codes, or an answer the
// parser could not use. The third outcome is not a detail — a grader that can
// only say yes or no will say one of them about output it did not understand.

import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Message, Model } from "../../chapter1/files/agent.ts";
import type { Code } from "./render.ts";
import { CODES } from "./render.ts";

/** A message that carries pixels as well as prose. */
export interface VisionMessage extends Message {
  image?: { mimeType: string; data: string };
}

/** The vocabulary an audit is allowed to use. A verdict outside it is noise. */
export const CHECKLIST: Record<Code, string> = {
  missing_total: "the receipt has no Total row at all",
  truncated_amount: "an amount is cut off by the edge of the card and cannot be read in full",
  overlap: "two rows of text collide on the same baseline and cannot both be read",
  low_contrast: "the total is drawn in a color almost identical to the background",
  offscreen_control: "a button or other control extends past the edge of the card",
  total_mismatch: "the printed Total does not equal items plus shipping plus tax",
};

export interface Verdict {
  /** False when the reply was not usable: unparseable, contradictory, or off-vocabulary. */
  answered: boolean;
  verdict: "pass" | "fail";
  defects: Code[];
  evidence: string;
  /** The model's own number. Recorded, never trusted: it is not a probability. */
  confidence: number | null;
  raw: string;
  /** Set when `answered` is false: what was wrong with the reply. */
  note?: string;
}

export interface AuditOptions {
  /** Override the prompt — exercise 2 uses this to show what a vague rubric costs. */
  prompt?: string;
  /** Ask only a subset of the vocabulary. */
  codes?: readonly Code[];
}

export function checklistPrompt(codes: readonly Code[] = CODES): string {
  const lines = codes.map((c) => `- ${c}: ${CHECKLIST[c]}`);
  return [
    "You are auditing a rendered order-confirmation card from a web checkout.",
    "The image is the whole page at 480x640; text is small but legible.",
    "",
    "Check it against exactly this checklist:",
    ...lines,
    "",
    "Reply with a single JSON object and nothing else:",
    '{"verdict":"pass"|"fail","defects":[codes],"evidence":"one sentence","confidence":0.0}',
    "",
    "Rules: if the card is clean, verdict is pass and defects is empty.",
    "If it is not, verdict is fail, defects lists every code that applies, and",
    "evidence names what you saw, including the numbers you read.",
  ].join("\n");
}

/** The first balanced {…} in a reply, which is what a fenced or chatty answer hides. */
export function firstObject(raw: string): string | null {
  const start = raw.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Turn a model reply into a Verdict, or into a refusal with a reason.
 *
 * Every rejection here is a case that would otherwise be counted as a pass or
 * a fail: a fail with no code cannot be acted on, a pass with codes contradicts
 * itself, and a code outside the checklist is a word the report cannot tally.
 */
export function parseVerdict(raw: string, codes: readonly Code[] = CODES): Verdict {
  const blank: Verdict = {
    answered: false,
    verdict: "fail",
    defects: [],
    evidence: "",
    confidence: null,
    raw,
  };
  const json = firstObject(raw);
  if (!json) return { ...blank, note: "no JSON object in the reply" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ...blank, note: "JSON did not parse" };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ...blank, note: "JSON was not an object" };
  }

  const v = parsed as Record<string, unknown>;
  const verdict = v.verdict;
  if (verdict !== "pass" && verdict !== "fail") {
    return { ...blank, note: `verdict must be pass or fail, got ${JSON.stringify(verdict)}` };
  }

  const rawDefects = Array.isArray(v.defects) ? v.defects : [];
  const known = rawDefects.filter((d): d is Code => typeof d === "string" && (codes as readonly string[]).includes(d));
  const unknown = rawDefects.filter((d) => typeof d !== "string" || !(codes as readonly string[]).includes(d));
  const evidence = typeof v.evidence === "string" ? v.evidence.trim() : "";
  const confidence = typeof v.confidence === "number" && Number.isFinite(v.confidence) ? v.confidence : null;

  const result: Verdict = {
    answered: true,
    verdict,
    defects: [...new Set(known)],
    evidence,
    confidence,
    raw,
  };

  if (unknown.length) result.note = `dropped ${unknown.length} code(s) outside the checklist`;
  if (verdict === "pass" && result.defects.length) {
    return { ...result, answered: false, note: "pass with defect codes: contradictory" };
  }
  if (verdict === "fail" && !result.defects.length) {
    return { ...result, answered: false, note: "fail with no code: unactionable" };
  }
  if (verdict === "fail" && !evidence) {
    return { ...result, answered: false, note: "fail with no evidence: unsupported" };
  }
  return result;
}

/**
 * One audit: read the pixels, ask once, parse strictly.
 *
 * No tools, no loop, no state. A grader that needs three turns to say "the
 * total is missing" is a grader that has its own failure modes to measure.
 */
export async function audit(
  model: Model,
  imagePath: string,
  options: AuditOptions = {},
): Promise<Verdict> {
  const codes = options.codes ?? CODES;
  const data = readFileSync(imagePath).toString("base64");
  const message: VisionMessage = {
    role: "user",
    content: options.prompt ?? checklistPrompt(codes),
    image: { mimeType: "image/png", data },
  };
  const reply = await model.step([message], []);
  return parseVerdict(reply.text ?? "", codes);
}

/** Where the rasterized corpus lives, so every demo agrees on one path. */
export const RENDERS = join(dirname(fileURLToPath(import.meta.url)), "renders");

export function renderPath(id: string): string {
  return join(RENDERS, `${id}.png`);
}

export function auditLabel(imagePath: string): string {
  return basename(imagePath, ".png");
}

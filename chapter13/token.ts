// Chapter 13 — an approval is a token, not a message.
//
// A token binds five things: the run it belongs to, the action it authorises,
// the person who approved it, when it was issued, and when it dies. The binding
// is signed with a key the agent does not have, so a token cannot be minted by
// the party it constrains — which is the difference between an approval and a
// sentence in a transcript that says "approved".
//
// The action hash is a fingerprint of the tool and its arguments, canonicalised
// so that key order cannot change the answer. That is what makes "approve 300,
// then send 3000" a refusal instead of a confused deputy.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Anything with a tool and arguments can be bound; the hash is over both. */
export interface Action {
  tool: string;
  args: Record<string, unknown>;
}

export interface Binding {
  runId: string;
  actionHash: string;
  approver: string;
  issuedAt: number;
  expiresAt: number;
}

export interface Token extends Binding {
  signature: string;
}

export type Check = { ok: true } | { ok: false; reason: string };

/** Stable JSON: keys sorted, so two spellings of one action hash the same. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
}

/** The action's fingerprint. Not secret: it only has to be stable. */
export function actionHash(action: Action): string {
  return createHash("sha256").update(canonical(action)).digest("hex").slice(0, 16);
}

function sign(binding: Binding, key: string): string {
  return createHmac("sha256", key).update(canonical(binding)).digest("hex");
}

/** Mint a token. Only the approver's side of the system has `key`. */
export function mint(binding: Binding, key: string): Token {
  return { ...binding, signature: sign(binding, key) };
}

/**
 * Verify a token against the run, the action and the clock.
 *
 * The order matters for the same reason the policy's did: a bad signature is a
 * forgery and everything after it is arithmetic on a forged value. Binding is
 * checked before expiry because "this token was for a different action" is a
 * more useful message than "and it also expired".
 */
export function verify(token: Token, expected: { runId: string; action: Action; now: number }, key: string): Check {
  const { signature, ...binding } = token;
  const wanted = sign(binding, key);
  const got = Buffer.from(signature, "hex");
  const want = Buffer.from(wanted, "hex");
  if (got.length !== want.length || !timingSafeEqual(got, want)) {
    return { ok: false, reason: "signature does not match: the token was not issued by this system" };
  }
  if (binding.runId !== expected.runId) {
    return { ok: false, reason: `token is for run ${binding.runId}, not ${expected.runId}` };
  }
  const hash = actionHash(expected.action);
  if (binding.actionHash !== hash) {
    return { ok: false, reason: "the action changed after it was approved" };
  }
  if (expected.now > binding.expiresAt) {
    return { ok: false, reason: `the approval expired at ${binding.expiresAt}` };
  }
  if (expected.now < binding.issuedAt) {
    return { ok: false, reason: "the approval is from the future" };
  }
  return { ok: true };
}

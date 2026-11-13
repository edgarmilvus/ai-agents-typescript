// Exercise 3, file 1 of 3 — the binding, borrowed from exercise 1.
//
// The token rules are the same problem every time, so this file re-exports the
// pure parts instead of writing them twice. It is still the only file in the
// split that knows what a signature is.

import { check, fingerprint, issue, KEY, stable } from "./ex1_token.ts";
import type { Action, Bound, Result, Token } from "./ex1_token.ts";

export { check, fingerprint, issue, KEY, stable };
export type { Action, Bound, Result, Token };

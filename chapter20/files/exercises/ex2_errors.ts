// Exercise 2 — errors with a vocabulary.
//
// A provider's error codes are a wire format. The agent needs four kinds it can
// branch on: the request was too long, it was rate limited, the credential is
// wrong, or something else went wrong.
//
// This exercise maps five codes and prints the kind and the delay. The table is
// the whole contract: anything not in it is `wire`, which is the kind that
// means "a human should look".

export type Kind = "rate_limit" | "context" | "auth" | "wire";

export interface Failure {
  code: string;
  kind: Kind;
  retryAfter?: number;
}

export function classify(code: string, retryAfter?: number): Failure {
  switch (code) {
    case "rate_limit":
      return { code, kind: "rate_limit", retryAfter };
    case "context_length_exceeded":
      return { code, kind: "context" };
    case "invalid_api_key":
      return { code, kind: "auth" };
    default:
      return { code, kind: "wire" };
  }
}

export const CODES: { code: string; retryAfter?: number }[] = [
  { code: "rate_limit", retryAfter: 2 },
  { code: "context_length_exceeded" },
  { code: "invalid_api_key" },
  { code: "server_error" },
  { code: "timeout" },
];

export function demo(): Failure[] {
  return CODES.map((entry) => classify(entry.code, entry.retryAfter));
}

export function report(rows: Failure[]): void {
  console.log("# five provider errors\n");
  console.log("  code                     kind         retry");
  for (const row of rows) {
    console.log(`  ${row.code.padEnd(25)}${row.kind.padEnd(13)}${row.retryAfter === undefined ? "-" : `${row.retryAfter}s`}`);
  }
  console.log("");
  console.log("  the mapping is total: a code that is not in the table becomes `wire`,");
  console.log("  not an exception. A provider that adds a code tomorrow gets the");
  console.log("  conservative branch, which is a person, rather than a crash.");
}

if (import.meta.main) report(demo());

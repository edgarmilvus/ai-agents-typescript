// 10.1 — one request, two releases, and a difference with a name.
//
// The unit of a canary is not a request. It is a pair: the same request run
// through the release that is serving and the release that wants to. This demo
// runs two such pairs — one where a rounding bug moves money, one where the
// two releases agree — and prints what a reviewer would have to decide.

import { INCUMBENT, ROUNDING, classify, makeWorld, run } from "../releases.ts";
import { driver, stream } from "../traffic.ts";

const requests = stream();

/** In policy for the incumbent, with cents in the total: the bug's home turf. */
function refundable(request: { region: string; days: number; total: number }): boolean {
  if (request.region === "EU") return request.days <= 14 && request.total <= 500;
  if (request.region === "US") return request.days <= 30 && request.total <= 1000;
  return false;
}

const request =
  requests.find((r) => refundable(r) && r.total % 1 !== 0 && !r.duplicateOf) ?? requests[0];

const incumbent = run(INCUMBENT, makeWorld(), request);
const candidate = run(ROUNDING, makeWorld(), request);
const verdict = classify(request, incumbent, candidate, false);

console.log("# the request");
console.log(`  ${request.id}  ${request.region}  ${request.total} ${request.currency}  ${request.days} days`);
console.log(`  decisions: ${driver(request).map((c) => c.name).join(" -> ")}`);

console.log("\n# the two results");
for (const [label, result] of [["incumbent", incumbent], ["candidate", candidate]] as const) {
  const actions = result.actions.map((a) => `${a.kind}${a.amount === undefined ? "" : ` ${a.amount.toFixed(2)}`}`);
  console.log(`  ${label.padEnd(9)} pass=${String(result.pass).padEnd(5)} ${actions.join(", ") || "nothing"}   ${result.reason}`);
}

console.log("\n# the classification");
console.log(`  kind   : ${verdict.kind}`);
console.log(`  detail : ${verdict.detail}`);
console.log("\n  the two releases wrote different amounts. The verdict also differs, but the");
console.log("  severity was settled by the money: a wrong sum is critical whether or not");
console.log("  the check happened to notice.");

const apac = requests.find((r) => r.region === "APAC") ?? requests[1];
const a = run(INCUMBENT, makeWorld(), apac);
const b = run(ROUNDING, makeWorld(), apac);
const same = classify(apac, a, b, false);
console.log("\n# a request the candidate does not touch");
console.log(`  ${apac.id}  ${same.kind.padEnd(8)} ${same.detail}`);
console.log("  both releases crash on a region with no policy, and agreement on a crash is");
console.log("  agreement. That sentence is the chapter's second half.");

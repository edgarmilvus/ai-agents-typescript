// 11.3 — what a model actually put in the packet.
//
// The three runs on disk were recorded live: a supervisor with one tool, two
// deterministic children, and nothing else. The question this demo asks is not
// whether the refund happened but whether the packet contained what the role
// needed, and it answers it by replaying each packet the model wrote through
// the same child the offline demos use.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RECORDED, RUNS } from "../runs.ts";
import type { Saved } from "../runs.ts";
import { NEEDS, runRole } from "../roles.ts";
import { makeDesk } from "../../chapter1/files/03_support_triage.ts";
import { validate } from "../contract.ts";
import type { Facts } from "../contract.ts";

let complete = 0;
let packets = 0;

for (const id of RECORDED) {
  const saved = JSON.parse(readFileSync(join(RUNS, `${id}.json`), "utf8")) as Saved;
  console.log(`# ${saved.taskId}`);
  console.log(`  ${saved.request}`);
  console.log(`  ${saved.calls} supervisor calls, ${saved.usage.promptTokens} prompt tokens\n`);

  const desk = makeDesk();
  for (const [i, packet] of saved.packets.entries()) {
    packets += 1;
    const carried = Object.keys(packet.facts).filter((k) => packet.facts[k as keyof Facts] !== undefined);
    const needs = NEEDS[packet.role];
    const absent = needs.filter((k) => !carried.includes(k as string));
    const report = runRole(packet, desk);
    const verdict = validate(packet, report);
    if (verdict.ok) complete += 1;
    console.log(
      `  packet ${i + 1} ${packet.role.padEnd(8)} carried ${(carried.join(", ") || "none").padEnd(26)} ` +
        `needs ${(needs.join(", ") || "none").padEnd(26)} ${verdict.ok ? "ok" : "REFUSED"}`,
    );
    if (!verdict.ok) console.log(`              ${verdict.detail}`);
  }
  console.log(`  answer: ${saved.answer.slice(0, 120)}\n`);
}

console.log(`# ${complete}/${packets} live packets carried enough to be acted on`);

console.log("\n  two of the three tasks were handed over correctly, including the fact");
console.log("  the cashier could not derive for itself: the clerk's verdict and the");
console.log("  amount from the request.");
console.log("");
console.log("  the third request never named an order, so the model delegated a goal");
console.log("  with no facts, the clerk refused, and the supervisor answered the");
console.log("  customer instead of inventing an order id. That is the behaviour the");
console.log("  chapter wants from a parent: a refusal it can explain, not a guess.");

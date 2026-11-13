// Exercise 3, file 3 of 3 — the wiring, and the claim.
//
// Six renders, one audit each, priced against the answer key. The interesting
// number is not the accuracy: it is that the one miss — a control that runs off
// the card — costs twelve dollars a render while a false alarm costs fifty
// cents, which is why the cheapest judge is not always the most accurate one.

import { byId } from "../../corpus.ts";
import { truthOf } from "../../render.ts";
import type { Code } from "../../render.ts";
import { open } from "../../../lib/scenario.ts";
import { cells, catchRate, falseAlarm, ledger, totalCost } from "./ex3_matrix.ts";
import { refused, sweep } from "./ex3_sweep.ts";

const IDS = ["r01", "r03", "r05", "r06", "r07", "r08"];

export async function demo() {
  const session = open("ch7-ex3", 8);
  const results = await sweep(session.model, IDS);
  session.close();

  const truth = IDS.map((id) => truthOf(byId(id)));
  const got = results.map((r) => r.got as Code[]);
  const counts = cells(truth, got);
  const book = ledger(counts);
  const tried = results.filter((r) => r.verdict.answered).length;

  return {
    ids: IDS,
    truth,
    got,
    tried,
    refused: refused(results),
    exact: IDS.filter((id, i) => truth[i].join() === got[i].join()).length,
    catchRate: catchRate(counts),
    falseAlarm: falseAlarm(counts),
    cost: totalCost(book),
    counts,
  };
}

export function report(d: Awaited<ReturnType<typeof demo>>): void {
  console.log(`# ${d.tried} renders audited, ${d.refused.length} refused\n`);
  console.log("  render  truth               got                     cost");
  d.ids.forEach((id, i) => {
    const missed = d.truth[i].filter((c) => !d.got[i].includes(c)).length;
    const invented = d.got[i].filter((c) => !d.truth[i].includes(c)).length;
    const cost = missed * 12 + invented * 0.5;
    console.log(
      `  ${id.padEnd(7)} ${(d.truth[i].join(",") || "clean").padEnd(19)} ${(d.got[i].join(",") || "-").padEnd(23)} $${cost.toFixed(2)}`,
    );
  });
  console.log(`\n  exact match : ${d.exact}/${d.tried} (${((d.exact / d.tried) * 100).toFixed(0)}%)`);
  console.log(`  catch rate  : ${(d.catchRate * 100).toFixed(0)}% of real defects found`);
  console.log(`  false alarm : ${(d.falseAlarm * 100).toFixed(0)}% of clean renders held`);
  console.log(`  cost        : $${d.cost.toFixed(2)} for six renders`);
  console.log(`  per render  : $${(d.cost / d.tried).toFixed(2)}`);
  console.log("\n  the miss is in the expensive direction, which is the whole point:");
  console.log("  a false negative ships a broken card; a false positive asks a human to look.");
}

if (import.meta.main) report(await demo());

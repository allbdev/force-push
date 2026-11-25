/** `npx tsx tools/bots.ts [matches] [seconds]`: bot-only matches with a summary, for tuning. */
import { botInput } from "../src/core/bot";
import { scoreMatch } from "../src/core/score";
import { createMatch } from "../src/core/state";
import { stepInPlace } from "../src/core/step";
import { mapById } from "../src/content/maps";
import { TICKS_PER_SECOND } from "../src/content/rules";

const matches = Number(process.argv[2] ?? 20);
const seconds = Number(process.argv[3] ?? 180);
const map = mapById("open-space")!;
const t0 = Date.now();
let painted = 0;
let reverts = 0;
let selfReverts = 0;
let pushes = 0;
for (let m = 0; m < matches; m++) {
  const s = createMatch({ map, seed: m + 1, ticks: seconds * TICKS_PER_SECOND });
  const inputs = [0, 0, 0, 0];
  while (!s.ended) {
    for (let seat = 0; seat < 4; seat++) inputs[seat] = botInput(s, seat);
    stepInPlace(s, inputs);
    for (const e of s.events) if (e.type === "revert" && e.by === -1) selfReverts++;
  }
  const r = scoreMatch(s);
  painted += r.painted;
  reverts += r.reverts;
  pushes += r.pushes;
}
console.log(
  `${matches} matches of ${seconds}s in ${Date.now() - t0} ms: ` +
    `painted ${(painted / matches).toFixed(1)}, pushes ${(pushes / matches).toFixed(1)}, ` +
    `reverts ${(reverts / matches).toFixed(1)} (self ${(selfReverts / matches).toFixed(1)})`,
);

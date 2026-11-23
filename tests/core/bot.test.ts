import { describe, expect, it } from "vitest";
import { botInput, dangerMap } from "../../src/core/bot";
import { BOX } from "../../src/core/map";
import { createMatch, effectiveTile, IN_PUSH, IN_RIGHT, inPlay } from "../../src/core/state";
import { stepInPlace } from "../../src/core/step";
import { powerUpCode } from "../../src/content/power-ups";
import { RULES, TICKS_PER_SECOND } from "../../src/content/rules";
import { fromAscii, openSpace, run, tile } from "./helpers";

const ROOM = [
  ".........",
  ".#.#.#.#.",
  "....0....",
  ".#.#.#.#.",
  ".........",
  "####b####",
  "1.2.3....",
];

function botsPlay(s: ReturnType<typeof fromAscii>, seats: number[], ticks: number) {
  for (let k = 0; k < ticks && !s.ended; k++) {
    const inputs = [0, 0, 0, 0];
    for (const seat of seats) inputs[seat] = botInput(s, seat);
    stepInPlace(s, inputs);
  }
}

describe("danger map", () => {
  it("marks a push's cross from when it goes off until the blast ends", () => {
    const s = fromAscii(ROOM);
    stepInPlace(s, [IN_PUSH, 0, 0, 0]);
    const d = dangerMap(s);
    expect(d.from[tile(s, 6, 2)]).toBe(s.pushes[0]!.fuse);
    expect(d.to[tile(s, 6, 2)]).toBe(s.pushes[0]!.fuse + RULES.blastTicks);
    expect(d.from[tile(s, 7, 2)]).toBeGreaterThan(10_000);
  });

  it("follows chains: a push in another's cross goes off one tick after it", () => {
    const s = fromAscii(ROOM);
    stepInPlace(s, [IN_PUSH, 0, 0, 0]);
    run(s, 10, [IN_RIGHT, 0, 0, 0]);
    stepInPlace(s, [IN_PUSH, 0, 0, 0]);
    const d = dangerMap(s);
    const first = s.pushes.find((q) => q.x === 4)!;
    expect(d.from[tile(s, 8, 2)]).toBe(first.fuse + 1);
  });
});

describe("bot", () => {
  it("runs from its own push and survives it", () => {
    const s = fromAscii(ROOM);
    s.kind[tile(s, 6, 2)] = BOX;
    botsPlay(s, [0], RULES.fuseTicks * 3);
    expect(s.stats.pushes[0]).toBeGreaterThan(0);
    expect(s.stats.reverted[0]).toBe(0);
  });

  it("does not drop a push in a dead end with no way out", () => {
    // A one-tile-wide corridor: any push here reaches every tile the bot could flee to.
    const s = fromAscii(["0..b.", "####.", "1.2.3", "#####", "....."]);
    for (let k = 0; k < 40; k++) stepInPlace(s, [botInput(s, 0), 0, 0, 0]);
    expect(s.stats.pushes[0]).toBe(0);
  });

  it("walks to a power-up in reach", () => {
    const s = fromAscii(ROOM);
    s.item[tile(s, 6, 2)] = powerUpCode("coffee");
    botsPlay(s, [0], 30);
    expect(s.players[0]!.coffee).toBeGreaterThan(0);
  });

  it("sends nothing while reverted or after the end", () => {
    const s = fromAscii(ROOM);
    s.players[0]!.out = 10;
    expect(botInput(s, 0)).toBe(0);
    s.players[0]!.out = 0;
    s.ended = true;
    expect(botInput(s, 0)).toBe(0);
  });

  it("is deterministic: the same state gives the same input", () => {
    const a = createMatch({ map: openSpace(), seed: 4, ticks: 1000 });
    const b = createMatch({ map: openSpace(), seed: 4, ticks: 1000 });
    for (let k = 0; k < 500; k++) {
      const ia = [0, 1, 2, 3].map((seat) => botInput(a, seat));
      const ib = [0, 1, 2, 3].map((seat) => botInput(b, seat));
      expect(ia).toEqual(ib);
      stepInPlace(a, ia);
      stepInPlace(b, ib);
    }
  });
});

/** 100 in `npm run check`; CI runs all 1,000 with `npm run test:bots`. */
const MATCHES = Number(process.env.BOT_MATCHES ?? 100);

describe(`${MATCHES} seeded bot-only matches`, () => {
  it("never get a bot stuck and never walk into a blast they could see", () => {
    const map = openSpace();
    const seconds = 90;
    const stuckLimit = 15 * TICKS_PER_SECOND;
    for (let seed = 1; seed <= MATCHES; seed++) {
      const s = createMatch({ map, seed, ticks: seconds * TICKS_PER_SECOND });
      const still = [0, 0, 0, 0];
      const lastTile = s.players.map((p) => effectiveTile(s, p));
      const inputs = [0, 0, 0, 0];
      while (!s.ended) {
        const liveBefore = s.blast.slice();
        for (let seat = 0; seat < 4; seat++) inputs[seat] = botInput(s, seat);
        stepInPlace(s, inputs);
        const boxesLeft = s.kind.includes(BOX);
        for (let seat = 0; seat < 4; seat++) {
          const p = s.players[seat]!;
          if (!inPlay(p)) {
            still[seat] = 0;
            continue;
          }
          const t = effectiveTile(s, p);
          if (t !== lastTile[seat]) {
            // Moved onto a tile whose blast was already live (and still is): a visible blast.
            if (liveBefore[t]! > 1 && p.grace === 0)
              throw new Error(`seed ${seed} tick ${s.tick}: seat ${seat} walked into a blast`);
            still[seat] = 0;
            lastTile[seat] = t;
          } else if (boxesLeft && ++still[seat]! > stuckLimit) {
            throw new Error(`seed ${seed} tick ${s.tick}: seat ${seat} stuck`);
          }
        }
      }
      for (let seat = 0; seat < 4; seat++)
        if (s.stats.pushes[seat] === 0) throw new Error(`seed ${seed}: seat ${seat} never pushed`);
    }
  }, 300_000);
});

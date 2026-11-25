import { describe, expect, it } from "vitest";
import { blastTiles } from "../../src/core/blast";
import { BOX, FLOOR } from "../../src/core/map";
import { IN_LEFT, IN_PUSH, IN_RIGHT } from "../../src/core/state";
import { stepInPlace } from "../../src/core/step";
import { powerUpCode } from "../../src/content/power-ups";
import { RULES } from "../../src/content/rules";
import { fromAscii, only, run, tile } from "./helpers";

// A 9 × 7 room; seats 1–3 stand in a pen (behind racks) at the bottom.
const ROOM = [
  ".........",
  ".#.#.#.#.",
  "....0....",
  ".#.#.#.#.",
  ".........",
  "####b####",
  "1.2.3....",
];

const owner = (s: ReturnType<typeof fromAscii>, x: number, y: number) => s.owner[tile(s, x, y)];

describe("pushes block movement", () => {
  it("can walk off a push but not back onto it", () => {
    const s = fromAscii(["0......", ".#.#.#.", ".......", "##b####", "1.2.3##"]);
    stepInPlace(s, only(0, IN_PUSH));
    run(s, 5, only(0, IN_RIGHT));
    expect(s.players[0]!.x).toBe(1);
    run(s, 10, only(0, IN_LEFT));
    expect(s.players[0]!.x).toBe(1);
  });

  it("other players can't walk onto a push either, and are stopped mid-step", () => {
    const s = fromAscii(["0...1", "####b", "2.3..", "b####", "....."]);
    // Seat 1 starts walking left towards (2,0); seat 0 drops a push after walking there first.
    run(s, 10, [IN_RIGHT, 0, 0, 0]); // seat 0 now on (2,0)
    run(s, 5, [0, IN_LEFT, 0, 0]); // seat 1 now on (3,0)
    stepInPlace(s, [IN_PUSH, IN_LEFT, 0, 0]);
    run(s, 20, [IN_LEFT, IN_LEFT, 0, 0]);
    expect(s.players[1]!.x).toBe(3);
    expect(s.players[0]!.x).toBe(0);
  });

  it("a player halfway to a tile that just got a push is sent back", () => {
    const s = fromAscii(["0...1", "####b", "2.3..", "b####", "....."]);
    run(s, 10, [IN_RIGHT, 0, 0, 0]); // seat 0 on (2,0)
    run(s, 6, [0, IN_LEFT, 0, 0]); // seat 1 on (3,0), one tick into the next step
    expect(s.players[1]!.progress).toBe(1);
    stepInPlace(s, [IN_PUSH, IN_LEFT, 0, 0]);
    expect(s.players[1]!.dir).toBe(-1);
    run(s, 20, [0, IN_LEFT, 0, 0]);
    expect(s.players[1]!.x).toBe(3);
  });
});

describe("force-push", () => {
  it("goes off after the 3 s fuse and paints a cross of range 2 in the owner's colour", () => {
    const s = fromAscii(ROOM);
    stepInPlace(s, only(0, IN_PUSH));
    expect(s.pushes).toHaveLength(1);
    run(s, 20, only(0, IN_RIGHT)); // walk out of range to (8,2)
    run(s, RULES.fuseTicks - 22);
    expect(s.pushes).toHaveLength(1);
    run(s, 1);
    expect(s.pushes).toHaveLength(0);
    for (const [x, y] of [
      [4, 2],
      [2, 2],
      [3, 2],
      [5, 2],
      [6, 2],
      [4, 3],
      [4, 4],
      [4, 1],
      [4, 0],
    ])
      expect(owner(s, x!, y!), `${x},${y}`).toBe(1);
    expect(owner(s, 7, 2)).toBe(0);
    expect(s.plus[0]).toBe(9);
    expect(s.players[0]!.out).toBe(0);
  });

  it("stops each arm before a rack", () => {
    const s = fromAscii(ROOM);
    // From (3,2): up hits the rack at (3,1).
    const tiles = blastTiles(s, 3, 2, 2, false);
    expect(tiles).not.toContain(tile(s, 3, 1));
    expect(tiles).not.toContain(tile(s, 3, 0));
    expect(tiles).toContain(tile(s, 1, 2));
  });

  it("passes one rack with rebase", () => {
    const s = fromAscii(ROOM);
    const tiles = blastTiles(s, 3, 2, 2, true);
    expect(tiles).toContain(tile(s, 3, 0));
    expect(tiles).not.toContain(tile(s, 3, 1));
  });

  it("breaks the first box an arm hits, paints its tile and stops there", () => {
    const s = fromAscii(ROOM);
    s.kind[tile(s, 5, 2)] = BOX;
    s.kind[tile(s, 6, 2)] = BOX;
    s.hidden[tile(s, 5, 2)] = powerUpCode("coffee");
    stepInPlace(s, only(0, IN_PUSH));
    run(s, RULES.fuseTicks);
    expect(s.kind[tile(s, 5, 2)]).toBe(FLOOR);
    expect(s.kind[tile(s, 6, 2)]).toBe(BOX);
    expect(owner(s, 5, 2)).toBe(1);
    expect(owner(s, 6, 2)).toBe(0);
    expect(s.item[tile(s, 5, 2)]).toBe(powerUpCode("coffee"));
    expect(s.stats.boxes[0]).toBe(1);
  });

  it("leaves power-ups on the floor alone", () => {
    const s = fromAscii(ROOM);
    s.item[tile(s, 6, 2)] = powerUpCode("duck");
    stepInPlace(s, only(0, IN_PUSH));
    run(s, RULES.fuseTicks);
    expect(s.item[tile(s, 6, 2)]).toBe(powerUpCode("duck"));
  });

  it("carries at most two at a time", () => {
    const s = fromAscii(ROOM);
    stepInPlace(s, only(0, IN_PUSH));
    run(s, 5, only(0, IN_RIGHT));
    stepInPlace(s, only(0, IN_PUSH));
    run(s, 5, only(0, IN_RIGHT));
    stepInPlace(s, only(0, IN_PUSH));
    expect(s.pushes).toHaveLength(2);
  });

  it("needs the button released between drops", () => {
    const s = fromAscii(ROOM);
    run(s, 6, only(0, IN_PUSH | IN_RIGHT));
    expect(s.pushes).toHaveLength(1);
  });

  it("chains: a blast that reaches another push sets it off on the next tick", () => {
    const s = fromAscii(ROOM);
    stepInPlace(s, only(0, IN_PUSH)); // at (4,2), fuse 60
    run(s, 10, only(0, IN_RIGHT)); // to (6,2)
    run(s, 30); // first push has 20 ticks left
    stepInPlace(s, only(0, IN_PUSH)); // second at (6,2)
    const second = s.pushes.find((q) => q.x === 6)!;
    while (s.pushes.some((q) => q.x === 4)) run(s, 1);
    expect(s.pushes.map((q) => q.x)).toEqual([6]);
    expect(second.fuse).toBe(1);
    run(s, 1);
    expect(s.pushes).toHaveLength(0);
    expect(owner(s, 8, 2)).toBe(1);
  });

  it("paints tiles under players", () => {
    const s = fromAscii(ROOM);
    s.players[1]!.x = 4;
    s.players[1]!.y = 4;
    stepInPlace(s, only(0, IN_PUSH));
    run(s, 15, only(0, IN_RIGHT));
    run(s, RULES.fuseTicks);
    expect(owner(s, 4, 4)).toBe(1);
  });

  it("is blown one tile by wind after the delay, if the tile is free", () => {
    const s = fromAscii(ROOM, { wind: { dir: "east", delay: 20 } });
    stepInPlace(s, only(0, IN_PUSH));
    run(s, 10, [0, 0, 0, 0]);
    expect(s.pushes[0]!.x).toBe(4);
    // The owner still stands on (4,2); the push moves away from them.
    run(s, 10);
    expect(s.pushes[0]!.x).toBe(5);
  });
});

import { describe, expect, it } from "vitest";
import { IN_DOWN, IN_PUSH, IN_RIGHT, IN_UP } from "../../src/core/state";
import { stepInPlace } from "../../src/core/step";
import { powerUpCode } from "../../src/content/power-ups";
import { RULES } from "../../src/content/rules";
import { fromAscii, only, run, tile } from "./helpers";

const ROOM = [
  ".........",
  ".#.#.#.#.",
  "....0....",
  ".#.#.#.#.",
  ".........",
  "####b####",
  "1.2.3....",
];

describe("reverts", () => {
  it("stays dangerous for half a second: walking in reverts you", () => {
    const s = fromAscii(ROOM);
    s.players[1]!.x = 0;
    s.players[1]!.y = 2;
    stepInPlace(s, only(0, IN_PUSH));
    run(s, 10, only(0, IN_RIGHT)); // seat 0 escapes to (6,2)... still in range 2 → move on
    run(s, 10, only(0, IN_RIGHT)); // (8,2), out of range
    run(s, RULES.fuseTicks - 21);
    expect(s.players[0]!.out).toBe(0);
    // Blast now live on (2,2)..(6,2). Seat 1 walks from (0,2) into it.
    expect(s.blast[tile(s, 2, 2)]).toBe(RULES.blastTicks);
    run(s, 10, [0, IN_RIGHT, 0, 0]);
    expect(s.players[1]!.out).toBeGreaterThan(0);
    expect(s.players[1]!.revertedBy).toBe(0);
  });

  it("a revert costs your 3 nearest tiles, to whoever did it", () => {
    const s = fromAscii(ROOM);
    // Seat 1 owns a row of tiles; seat 0 reverts them at (0,2).
    for (let x = 0; x < 9; x++) s.owner[tile(s, x, 0)] = 2;
    s.plus[1] = 9;
    s.players[1]!.x = 2;
    s.players[1]!.y = 2;
    stepInPlace(s, only(0, IN_PUSH)); // at (4,2), reaches (2,2)
    run(s, 20, only(0, IN_RIGHT));
    run(s, RULES.fuseTicks - 21);
    expect(s.players[1]!.out).toBe(RULES.revertTicks);
    expect(s.players[1]!.revertedBy).toBe(0);
    // Nearest to (2,2) in row 0: (2,0), then (1,0) and (3,0).
    expect([1, 2, 3].map((x) => s.owner[tile(s, x, 0)])).toEqual([1, 1, 1]);
    expect(s.owner[tile(s, 0, 0)]).toBe(2);
    // 3 penalty tiles, plus (4,0) which the blast's up arm took.
    expect(s.minus[1]).toBe(4);
  });

  it("reverting yourself turns the tiles grey", () => {
    const s = fromAscii(ROOM);
    stepInPlace(s, only(0, IN_PUSH));
    run(s, RULES.fuseTicks);
    expect(s.players[0]!.out).toBeGreaterThan(0);
    expect(s.players[0]!.revertedBy).toBe(-1);
    expect(s.plus[0]! - s.minus[0]!).toBe(9 - 3);
  });

  it("you're out for 4 s, then back at your desk with 1 s of grace", () => {
    const s = fromAscii(ROOM);
    stepInPlace(s, only(0, IN_PUSH));
    run(s, 10, only(0, IN_DOWN)); // (4,4), still in the cross
    run(s, RULES.fuseTicks - 11);
    expect(s.players[0]!.out).toBe(RULES.revertTicks);
    expect([s.players[0]!.fellX, s.players[0]!.fellY]).toEqual([4, 4]);
    run(s, RULES.revertTicks - 1, only(0, IN_UP));
    expect(s.players[0]!.out).toBe(1);
    run(s, 1);
    expect(s.players[0]!.out).toBe(0);
    expect([s.players[0]!.x, s.players[0]!.y]).toEqual([4, 2]);
    expect(s.players[0]!.grace).toBe(RULES.graceTicks);
    expect(s.events.some((e) => e.type === "respawn")).toBe(true);
  });

  it("grace lets blasts pass through you", () => {
    const s = fromAscii(ROOM);
    s.players[0]!.grace = 100;
    stepInPlace(s, only(0, IN_PUSH));
    run(s, RULES.fuseTicks);
    expect(s.players[0]!.out).toBe(0);
  });

  it("a rubber duck absorbs one blast", () => {
    const s = fromAscii(ROOM);
    s.players[0]!.duck = 1;
    stepInPlace(s, only(0, IN_PUSH));
    run(s, RULES.fuseTicks);
    expect(s.players[0]!.out).toBe(0);
    expect(s.players[0]!.duck).toBe(0);
    expect(s.players[0]!.grace).toBeGreaterThan(0);
  });

  it("pushes dropped before falling still go off", () => {
    const s = fromAscii(ROOM);
    stepInPlace(s, only(0, IN_PUSH)); // A at (4,2)
    run(s, 10, only(0, IN_RIGHT)); // (6,2)
    stepInPlace(s, only(0, IN_PUSH)); // B at (6,2): chained by A, and A's blast reverts us
    run(s, RULES.fuseTicks);
    expect(s.pushes).toHaveLength(0);
    expect(s.owner[tile(s, 8, 2)]).toBe(1);
  });
});

describe("power-ups", () => {
  function pick(
    kind: Parameters<typeof powerUpCode>[0],
    setup?: (s: ReturnType<typeof fromAscii>) => void,
  ) {
    const s = fromAscii(ROOM);
    setup?.(s);
    s.item[tile(s, 5, 2)] = powerUpCode(kind);
    run(s, 5, only(0, IN_RIGHT));
    expect(s.item[tile(s, 5, 2)]).toBe(0);
    return s.players[0]!;
  }

  it("coffee: faster for 10 s", () => {
    expect(pick("coffee").coffee).toBeGreaterThan(RULES.coffeeTicks - 5);
  });

  it("rubber duck", () => {
    expect(pick("duck").duck).toBe(1);
  });

  it("Stack Overflow: +1 range, at most 6", () => {
    expect(pick("stackOverflow").range).toBe(RULES.startRange + 1);
    expect(pick("stackOverflow", (s) => (s.players[0]!.range = 6)).range).toBe(6);
  });

  it("second monitor: +1 carried, at most 4", () => {
    expect(pick("secondMonitor").carry).toBe(RULES.startCarry + 1);
    expect(pick("secondMonitor", (s) => (s.players[0]!.carry = 4)).carry).toBe(4);
  });

  it("rebase: the next push repaints through one rack, then it's used up", () => {
    const p = pick("rebase");
    expect(p.rebase).toBe(1);
    const s = fromAscii(ROOM);
    s.players[0]!.rebase = 1;
    s.players[0]!.x = 3;
    stepInPlace(s, only(0, IN_PUSH));
    expect(s.pushes[0]!.rebase).toBe(1);
    expect(s.players[0]!.rebase).toBe(0);
  });

  it("is picked up on the tile you count as standing on (halfway is enough)", () => {
    const s = fromAscii(ROOM);
    s.item[tile(s, 5, 2)] = powerUpCode("coffee");
    run(s, 3, only(0, IN_RIGHT));
    expect(s.players[0]!.coffee).toBeGreaterThan(0);
  });
});

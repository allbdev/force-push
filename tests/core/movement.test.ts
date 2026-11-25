import { describe, expect, it } from "vitest";
import { IN_DOWN, IN_LEFT, IN_RIGHT, IN_UP, effectiveTile } from "../../src/core/state";
import { fromAscii, only, run, tile } from "./helpers";

// Seats 1–3 park far away in a pen so they never interfere.
const ROOM = [
  "0......", //
  ".#.#.#.",
  ".......",
  "##b####",
  "1.2.3##",
];

describe("movement", () => {
  it("walks one tile every 5 ticks while a direction is held", () => {
    const s = fromAscii(ROOM);
    run(s, 4, only(0, IN_RIGHT));
    expect(s.players[0]!.x).toBe(0);
    run(s, 1, only(0, IN_RIGHT));
    expect(s.players[0]!.x).toBe(1);
    run(s, 10, only(0, IN_RIGHT));
    expect(s.players[0]!.x).toBe(3);
  });

  it("stops at the edge and at racks, and stands still with no input", () => {
    const s = fromAscii(ROOM);
    run(s, 50, only(0, IN_LEFT));
    expect([s.players[0]!.x, s.players[0]!.y]).toEqual([0, 0]);
    run(s, 5, only(0, IN_RIGHT));
    run(s, 20, only(0, IN_DOWN)); // (1, 1) is a rack
    expect([s.players[0]!.x, s.players[0]!.y]).toEqual([1, 0]);
    expect(s.players[0]!.facing).toBe(2);
  });

  it("is blocked by boxes", () => {
    const s = fromAscii(ROOM);
    run(s, 10, only(0, IN_RIGHT)); // to (2, 0)
    run(s, 40, only(0, IN_DOWN)); // (2, 3) is a box
    expect([s.players[0]!.x, s.players[0]!.y]).toEqual([2, 2]);
  });

  it("takes the most recently pressed open direction at a corner (corner rule)", () => {
    const s = fromAscii(ROOM);
    // Holding right, then also down: at (0,0) down is open, so down wins (pressed last).
    run(s, 1, only(0, IN_RIGHT));
    run(s, 4, only(0, IN_RIGHT | IN_DOWN));
    // Arrived at (1,0) moving right; down is preferred but (1,1) is a rack: keep going right.
    run(s, 5, only(0, IN_RIGHT | IN_DOWN));
    expect([s.players[0]!.x, s.players[0]!.y]).toEqual([2, 0]);
    // At (2,0) down is open: turn the corner.
    run(s, 5, only(0, IN_RIGHT | IN_DOWN));
    expect([s.players[0]!.x, s.players[0]!.y]).toEqual([2, 1]);
  });

  it("turns back mid-step when the opposite way is pressed", () => {
    const s = fromAscii(ROOM);
    run(s, 2, only(0, IN_RIGHT));
    run(s, 3, only(0, IN_LEFT));
    expect(s.players[0]!.dir === -1 || s.players[0]!.x === 0).toBe(true);
    run(s, 5, only(0, 0));
    expect(s.players[0]!.x).toBe(0);
  });

  it("counts the nearer tile as where you stand, mid-step", () => {
    const s = fromAscii(ROOM);
    run(s, 2, only(0, IN_RIGHT));
    expect(effectiveTile(s, s.players[0]!)).toBe(tile(s, 0, 0));
    run(s, 1, only(0, IN_RIGHT));
    expect(effectiveTile(s, s.players[0]!)).toBe(tile(s, 1, 0));
  });

  it("walks faster with coffee: one tile per 4 ticks", () => {
    const s = fromAscii(ROOM);
    s.players[0]!.coffee = 100;
    run(s, 4, only(0, IN_RIGHT));
    expect(s.players[0]!.x).toBe(1);
    run(s, 8, only(0, IN_RIGHT));
    expect(s.players[0]!.x).toBe(3);
  });

  it("ignores input bits beyond the five", () => {
    const s = fromAscii(ROOM);
    run(s, 10, only(0, 0xffe0));
    expect([s.players[0]!.x, s.players[0]!.y]).toEqual([0, 0]);
    expect(s.pushes).toHaveLength(0);
  });

  it("walks through other players", () => {
    const s = fromAscii(["0.1..", "####b", "2.3..", "b####", "....."]);
    run(s, 10, [IN_RIGHT, IN_LEFT, 0, 0]);
    expect(s.players[0]!.x).toBe(2);
    expect(s.players[1]!.x).toBe(0);
  });

  it("holding up at the top edge just faces up", () => {
    const s = fromAscii(ROOM);
    run(s, 3, only(0, IN_UP));
    expect(s.players[0]!.facing).toBe(0);
    expect(s.players[0]!.y).toBe(0);
  });
});

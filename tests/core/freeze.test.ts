import { describe, expect, it } from "vitest";
import { freezeEvery, freezeRing } from "../../src/core/freeze";
import { FROZEN } from "../../src/core/map";
import { createMatch } from "../../src/core/state";
import { RULES } from "../../src/content/rules";
import { openSpace, run, tile } from "./helpers";

describe("code freeze", () => {
  it("closes the outer ring clockwise from the north-west corner", () => {
    const s = createMatch({ map: openSpace(), seed: 1, ticks: 1000 });
    const ring = freezeRing(s);
    expect(ring).toHaveLength(2 * (13 + 11) - 4);
    expect(ring.slice(0, 3)).toEqual([0, 1, 2]);
    expect(ring[12]).toBe(12);
    expect(ring[13]).toBe(tile(s, 12, 1));
    expect(ring[ring.length - 1]).toBe(tile(s, 0, 1));
  });

  it("is off unless asked for", () => {
    const s = createMatch({ map: openSpace(), seed: 1, ticks: RULES.freezeTicks + 10 });
    run(s, RULES.freezeTicks + 10);
    expect(s.frozen).toBe(0);
  });

  it("closes the whole ring by the end, painting closed tiles grey (− for their owner)", () => {
    const ticks = RULES.freezeTicks + 100;
    const s = createMatch({ map: openSpace(), seed: 1, ticks, freeze: true });
    s.owner[0] = 1;
    s.plus[0] = 1;
    run(s, 100);
    expect(s.frozen).toBe(0);
    run(s, freezeEvery(44) + 1);
    expect(s.frozen).toBe(1);
    expect(s.kind[0]).toBe(FROZEN);
    expect(s.owner[0]).toBe(0);
    expect(s.minus[0]).toBe(1);
    run(s, RULES.freezeTicks);
    expect(s.frozen).toBe(44);
    expect(s.ended).toBe(true);
  });

  it("reverts a player standing on a tile as it closes, and respawns them on open floor", () => {
    const s = createMatch({
      map: openSpace(),
      seed: 1,
      ticks: RULES.freezeTicks + 10,
      freeze: true,
    });
    run(s, 10 + freezeEvery(44) + 1);
    expect(s.players[0]!.out).toBe(RULES.revertTicks);
    run(s, RULES.revertTicks);
    const p = s.players[0]!;
    expect(p.out).toBe(0);
    expect(s.kind[tile(s, p.x, p.y)]).not.toBe(FROZEN);
  });
});

describe("code freeze, regression", () => {
  it("stops a player who is halfway into a tile as it closes (never ends up inside it)", () => {
    const s = createMatch({
      map: openSpace(),
      seed: 1,
      ticks: RULES.freezeTicks + 10,
      freeze: true,
    });
    // Seat 0 stands on (2,0) and starts walking left into (1,0) one tick before (1,0) closes.
    const every = freezeEvery(44);
    s.players[0]!.x = 2;
    s.players[0]!.y = 0;
    // (0,0) closes at tick 10 + every; (1,0) at 10 + 2 * every.
    const closeAt = 10 + 2 * every;
    run(s, closeAt - 1);
    run(s, 2, [8, 0, 0, 0]); // left: one tick of step, then the tile closes
    run(s, 10, [8, 0, 0, 0]);
    const p = s.players[0]!;
    expect(s.kind[tile(s, p.x, p.y)]).not.toBe(FROZEN);
  });
});

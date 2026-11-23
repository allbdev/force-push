import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { botInput } from "../../src/core/bot";
import {
  biggestPushTick,
  decodeReplay,
  encodeReplay,
  MAX_REPLAY_CHARS,
  replayState,
  type Replay,
} from "../../src/core/replay";
import { createMatch, hashState, SIM_VERSION } from "../../src/core/state";
import { stepInPlace } from "../../src/core/step";
import { mapById } from "../../src/content/maps";

function recordBotMatch(seed: number, ticks: number, mapId = "open-space", closed = 0) {
  const s = createMatch({ map: mapById(mapId)!, seed, ticks, freeze: true, closed });
  const log: number[] = [];
  while (!s.ended) {
    const inputs = [0, 1, 2, 3].map((seat) => botInput(s, seat));
    log.push(...inputs);
    stepInPlace(s, inputs);
  }
  const replay: Replay = {
    version: SIM_VERSION,
    seed,
    mapId,
    ticks,
    freeze: true,
    closed,
    inputs: Uint8Array.from(log),
  };
  return { s, replay };
}

describe("replays", () => {
  it("replay a whole bot match to the same final state", () => {
    const { s, replay } = recordBotMatch(1758, 1200);
    const back = decodeReplay(encodeReplay(replay))!;
    expect(back).not.toBeNull();
    expect(hashState(replayState(back))).toBe(hashState(s));
  });

  it("replay a 1v1 (closed seats travel in the link)", () => {
    const { s, replay } = recordBotMatch(77, 1200, "data-center", 0b0110);
    const back = decodeReplay(encodeReplay(replay))!;
    expect(back.closed).toBe(0b0110);
    expect(hashState(replayState(back))).toBe(hashState(s));
  });

  it("read links made before closed seats as a full table", () => {
    // Flags byte 1 (freeze on), as every link had before closed seats existed.
    const { replay } = recordBotMatch(5, 100);
    const back = decodeReplay(encodeReplay(replay))!;
    expect([back.freeze, back.closed]).toEqual([true, 0]);
    const all = encodeReplay({ ...replay, closed: 15 });
    expect(decodeReplay(all)).toBeNull();
  });

  it("fit a 3-minute match in a link", () => {
    const { replay } = recordBotMatch(7, 3600, "data-center");
    const text = encodeReplay(replay);
    expect(text.length).toBeLessThan(MAX_REPLAY_CHARS);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("round-trip random input logs exactly", () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.array(fc.integer({ min: 0, max: 31 }), { maxLength: 400 }),
        (seed, xs) => {
          const inputs = Uint8Array.from(xs.slice(0, xs.length - (xs.length % 4)));
          const r: Replay = {
            version: SIM_VERSION,
            seed,
            mapId: "rooftop",
            ticks: 1000,
            freeze: false,
            closed: 0,
            inputs,
          };
          const back = decodeReplay(encodeReplay(r))!;
          expect(back.seed).toBe(seed | 0);
          expect(Array.from(back.inputs)).toEqual(Array.from(inputs));
        },
      ),
    );
  });

  it("refuse anything malformed, oversized, from another version or for an unknown map", () => {
    const good = encodeReplay(recordBotMatch(1, 100).replay);
    for (const bad of [
      null,
      5,
      "",
      "!!!!",
      "a".repeat(MAX_REPLAY_CHARS + 1),
      good.slice(0, -3),
      good + "AAAA",
      "<script>",
    ])
      expect(decodeReplay(bad), String(bad).slice(0, 20)).toBeNull();
    const other = encodeReplay({ ...recordBotMatch(1, 100).replay, version: SIM_VERSION + 1 });
    expect(decodeReplay(other)).toBeNull();
    const unknown = encodeReplay({ ...recordBotMatch(1, 100).replay, mapId: "nowhere" });
    expect(decodeReplay(unknown)).toBeNull();
    fc.assert(
      fc.property(fc.string({ maxLength: 300 }), (t) => {
        expect(() => decodeReplay(t)).not.toThrow();
      }),
    );
  });

  it("find the tick of the biggest push", () => {
    const { s, replay } = recordBotMatch(3, 1200);
    const t = biggestPushTick(replay);
    expect(t).toBeGreaterThan(0);
    const at = replayState(replay, t + 1);
    expect(at.events.some((e) => e.type === "blast" && e.gained === s.stats.bestGain)).toBe(true);
  });
});

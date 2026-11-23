import { describe, expect, it } from "vitest";
import { botsCanPlay, dailyId, dailyMap, parseDailyId } from "../../src/core/daily";
import { MAPS, mapById } from "../../src/content/maps";

describe("maps", () => {
  it("ships Open Space, Data Center and Rooftop Happy Hour", () => {
    expect(MAPS.map((m) => m.id)).toEqual(["open-space", "data-center", "rooftop"]);
    expect(mapById("data-center")!.racks.length).toBeGreaterThan(
      mapById("open-space")!.racks.length,
    );
    expect(mapById("rooftop")!.wind).toEqual({ dir: 1, delay: 20 });
  });

  it("bots can play every shipped map", () => {
    for (const m of MAPS)
      for (const seed of [1, 2, 3]) expect(botsCanPlay(m, seed), `${m.id} ${seed}`).toBe(true);
  });
});

describe("daily map", () => {
  it("parses only well-formed ids", () => {
    expect(parseDailyId(dailyId(2026, 11, 22))).toEqual({ year: 2026, month: 11, day: 22 });
    for (const bad of [
      "daily-2026112",
      "daily-20261322",
      "daily-1999-01-01",
      "open-space",
      "daily-20261100",
    ])
      expect(parseDailyId(bad), bad).toBeNull();
  });

  it("is the same for everyone on a day and changes between days", () => {
    const a = dailyMap(dailyId(2026, 11, 22))!;
    const b = dailyMap(dailyId(2026, 11, 22))!;
    expect(a).toBe(b);
    const days = Array.from({ length: 10 }, (_, d) =>
      JSON.stringify(dailyMap(dailyId(2026, 12, d + 1))!.racks),
    );
    expect(new Set(days).size).toBeGreaterThan(1);
  });

  it("every day of a month gives a playable map", () => {
    for (let d = 1; d <= 31; d++) {
      const m = dailyMap(dailyId(2027, 1, d));
      expect(m, `day ${d}`).toBeDefined();
    }
  });

  it("is reachable through mapById", () => {
    expect(mapById(dailyId(2026, 11, 22))?.id).toBe("daily-20261122");
    expect(mapById("daily-nope")).toBeUndefined();
  });
});

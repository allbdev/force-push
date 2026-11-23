import { describe, expect, it } from "vitest";
import { commitHash, formatClock, logLine, shareText } from "../../src/ui/format";
import { setLocale } from "../../src/ui/i18n";
import { shareData } from "../../src/core/share";
import { scoreMatch } from "../../src/core/score";
import { createMatch } from "../../src/core/state";
import { mapById } from "../../src/content/maps";
import { SITE_HOST } from "../../src/content/site";

describe("format", () => {
  it("shows the clock as mm:ss from ticks, rounding up", () => {
    expect(formatClock(3600)).toBe("03:00");
    expect(formatClock(2040)).toBe("01:42");
    expect(formatClock(1)).toBe("00:01");
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(-5)).toBe("00:00");
  });

  it("writes commit-log lines in both locales (board 3)", () => {
    setLocale("en");
    expect(logLine({ type: "blast", seat: 3, x: 0, y: 0, gained: 9, taken: 5 })!.text).toBe(
      "dev force-push +9 −5",
    );
    expect(logLine({ type: "pickup", seat: 1, kind: 1 })!.text).toBe("feature got coffee");
    expect(logLine({ type: "revert", seat: 2, by: 0, x: 0, y: 0 })!.text).toBe(
      "hotfix reverted by main",
    );
    setLocale("pt-BR");
    expect(logLine({ type: "pickup", seat: 1, kind: 1 })!.text).toBe("feature pegou café");
    expect(logLine({ type: "revert", seat: 2, by: 0, x: 0, y: 0 })!.text).toBe(
      "hotfix revertida por main",
    );
    expect(logLine({ type: "blast", seat: 3, x: 0, y: 0, gained: 0, taken: 0 })).toBeNull();
    expect(logLine({ type: "end" })).toBeNull();
    setLocale("en");
  });

  it("gives stable six-digit commit hashes", () => {
    expect(commitHash(1, 2, 3)).toMatch(/^[0-9a-f]{6}$/);
    expect(commitHash(1, 2, 3)).toBe(commitHash(1, 2, 3));
  });

  it("builds the share line: room, winner's diff, the sharer's match, the site", () => {
    const s = createMatch({ map: mapById("open-space")!, seed: 1, ticks: 10 });
    for (let i = 0; i < 31; i++) s.owner[i * 3] = 1;
    s.plus = [212, 0, 0, 0];
    s.minus = [181, 0, 0, 0];
    s.stats.pushes = [42, 1, 1, 1];
    s.stats.reverted = [2, 0, 0, 0];
    setLocale("en");
    const text = shareText(shareData(scoreMatch(s), s, "FRI-1758", 0));
    expect(text.split("\n")).toEqual([
      "Force Push · room FRI-1758",
      "main won: +212 −181 (100%)",
      "42 force-pushes · 2 reverts",
      SITE_HOST,
    ]);
    setLocale("pt-BR");
    expect(shareText(shareData(scoreMatch(s), s, "FRI-1758", 0))).toContain(
      "main venceu: +212 −181",
    );
    setLocale("en");
  });
});

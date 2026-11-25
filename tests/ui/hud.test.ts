// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createMatch } from "../../src/core/state";
import { mapById } from "../../src/content/maps";
import { Hud } from "../../src/ui/hud";
import { setLocale } from "../../src/ui/i18n";

const info = { code: null, names: ["", "", "", ""], seat: 0, touch: false, ping: null };

describe("the HUD without the 3D view", () => {
  // three.js loads after the match starts, and some browsers have no WebGL at all: the match
  // still plays, so the timer and the territory must not wait for the renderer.
  it("updates the timer and hides closed seats with no renderer", () => {
    setLocale("en");
    const s = createMatch({ map: mapById("open-space")!, seed: 1, ticks: 2400, closed: 0b0110 });
    const hud = new Hud(info, () => undefined);
    hud.update(s, s, info, null);
    expect(hud.root.querySelector("[data-testid=timer]")?.textContent).toBe("02:00");
    const chips = [...hud.root.querySelectorAll<HTMLElement>(".hud-chip")];
    expect(chips.map((c) => c.hidden)).toEqual([false, true, true, false]);
    // Nothing to pin the name tags to yet.
    const tags = [...hud.root.querySelectorAll<HTMLElement>(".name-tag")];
    expect(tags.every((t) => t.hidden)).toBe(true);
    hud.dispose();
  });
});

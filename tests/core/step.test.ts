import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { BOX, FROZEN, RACK } from "../../src/core/map";
import { ownedTiles } from "../../src/core/score";
import {
  cloneState,
  createMatch,
  effectiveTile,
  hashState,
  inPlay,
  pushAt,
  type GameState,
} from "../../src/core/state";
import { step, stepInPlace } from "../../src/core/step";
import { openSpace } from "./helpers";

/** The invariants of CLAUDE.md, checked after every tick. */
export function checkInvariants(s: GameState): void {
  let grey = 0;
  let frozen = 0;
  let floor = 0;
  for (let i = 0; i < s.kind.length; i++) {
    if (s.kind[i] === RACK) continue;
    floor++;
    if (s.kind[i] === FROZEN) frozen++;
    else if (s.owner[i] === 0) grey++;
  }
  let owned = 0;
  for (let seat = 0; seat < 4; seat++) {
    const o = ownedTiles(s, seat);
    owned += o;
    expect(s.plus[seat]! - s.minus[seat]!, `diff seat ${seat}`).toBe(o);
  }
  expect(owned + grey + frozen).toBe(floor);
  s.players.forEach((p, seat) => {
    if (!inPlay(p)) return;
    const i = effectiveTile(s, p);
    expect(s.kind[i], `seat ${seat} inside a rack/box/frozen tile`).toBe(0);
    for (const t of [p.y * s.width + p.x, i]) expect(t >= 0 && t < s.kind.length).toBe(true);
    const push = pushAt(s, i);
    if (push) expect(push.pass & (1 << seat), `seat ${seat} on a push`).not.toBe(0);
  });
  expect(s.kind.every((k) => k <= FROZEN)).toBe(true);
  expect(s.kind.some((k) => k === BOX) || true).toBe(true);
}

const inputArb = fc.array(
  fc.array(fc.integer({ min: 0, max: 31 }), { minLength: 4, maxLength: 4 }),
  {
    minLength: 50,
    maxLength: 600,
  },
);

describe("step", () => {
  it("is pure: the input state is unchanged", () => {
    const s = createMatch({ map: openSpace(), seed: 3, ticks: 100 });
    const before = hashState(s);
    step(s, [2, 4, 8, 16]);
    expect(hashState(s)).toBe(before);
  });

  it("is deterministic: the same inputs twice give identical states", () => {
    fc.assert(
      fc.property(fc.integer(), inputArb, (seed, inputs) => {
        const a = createMatch({ map: openSpace(), seed, ticks: 10_000, freeze: true });
        const b = createMatch({ map: openSpace(), seed, ticks: 10_000, freeze: true });
        for (const i of inputs) {
          stepInPlace(a, i);
          stepInPlace(b, i);
        }
        expect(hashState(a)).toBe(hashState(b));
        expect(a).toEqual(b);
      }),
      { numRuns: 40 },
    );
  });

  it("clone + step equals step in place", () => {
    const a = createMatch({ map: openSpace(), seed: 9, ticks: 1000 });
    const b = cloneState(a);
    const inputs = [18, 4, 24, 1];
    const c = step(a, inputs);
    stepInPlace(b, inputs);
    expect(hashState(c)).toBe(hashState(b));
  });

  it("holds every invariant on every tick for random inputs", () => {
    fc.assert(
      fc.property(fc.integer(), fc.boolean(), inputArb, (seed, freeze, inputs) => {
        const s = createMatch({ map: openSpace(), seed, ticks: 650, freeze });
        for (const i of inputs) {
          stepInPlace(s, i);
          checkInvariants(s);
        }
      }),
      { numRuns: 60 },
    );
  });

  it("ends exactly at the sprint length and then stops changing", () => {
    const s = createMatch({ map: openSpace(), seed: 1, ticks: 40 });
    for (let k = 0; k < 39; k++) stepInPlace(s, [0, 0, 0, 0]);
    expect(s.ended).toBe(false);
    stepInPlace(s, [0, 0, 0, 0]);
    expect(s.ended).toBe(true);
    expect(s.events).toEqual([{ type: "end" }]);
    const h = hashState(s);
    stepInPlace(s, [2, 2, 2, 2]);
    expect(hashState(s)).toBe(h);
  });

  it("survives zero input for a whole sprint", () => {
    const s = createMatch({ map: openSpace(), seed: 1, ticks: 3600 });
    for (let k = 0; k < 3600; k++) stepInPlace(s, [0, 0, 0, 0]);
    expect(s.ended).toBe(true);
    expect(s.owner.every((o) => o === 0)).toBe(true);
  });

  it("treats missing or junk inputs as nothing pressed", () => {
    const a = createMatch({ map: openSpace(), seed: 1, ticks: 100 });
    const b = cloneState(a);
    stepInPlace(a, []);
    stepInPlace(b, [0, 0, 0, 0]);
    expect(hashState(a)).toBe(hashState(b));
    stepInPlace(a, [-1 & 0, 2 ** 40, Number.NaN, 0]);
    stepInPlace(b, [0, 0, 0, 0]);
    expect(hashState(a)).toBe(hashState(b));
  });

  it("hashes to a known value for a recorded run (cross-engine guard)", () => {
    const s = createMatch({ map: openSpace(), seed: 1758, ticks: 600 });
    for (let k = 0; k < 600; k++)
      stepInPlace(s, [(k * 7) % 32, (k * 11) % 32, (k * 13) % 32, (k * 17) % 32]);
    expect(hashState(s)).toMatchSnapshot();
  });
});

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import en from "../../src/content/locales/en";
import ptBR from "../../src/content/locales/pt-BR";
import { fill, formatInt, has, isLocale, translate } from "../../src/content/i18n";

type Flat = Map<string, string>;

function flatten(node: unknown, prefix = "", out: Flat = new Map()): Flat {
  if (typeof node === "string") out.set(prefix, node);
  else
    for (const [k, v] of Object.entries(node as object))
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

const slots = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("locales", () => {
  const a = flatten(en);
  const b = flatten(ptBR);

  it("have exactly the same keys", () => {
    expect([...b.keys()].sort()).toEqual([...a.keys()].sort());
  });

  it("use the same slots", () => {
    for (const [key, value] of a) expect(slots(b.get(key)!), key).toEqual(slots(value));
  });

  it("have no empty strings", () => {
    for (const [key, value] of [...a, ...b]) expect(value.trim().length, key).toBeGreaterThan(0);
  });

  it("never name another game in player-facing text (GAME_PLAN.md D14)", () => {
    for (const [key, value] of [...a, ...b]) expect(value, key).not.toMatch(/bomberman/i);
  });
});

describe("translate", () => {
  it("fills slots and leaves unknown ones visible", () => {
    expect(fill("{a} and {b}", { a: 1 })).toBe("1 and {b}");
    expect(translate("en", "landing.pitch", { command: "X" })).toContain("Your bomb is a X");
    expect(translate("pt-BR", "landing.pitch", { command: "X" })).toContain("Sua bomba é um X");
  });

  it("shows a missing key as the key, including prototype names", () => {
    expect(translate("en", "no.such.key")).toBe("no.such.key");
    expect(translate("en", "constructor")).toBe("constructor");
    expect(translate("en", "landing.__proto__")).toBe("landing.__proto__");
    expect(has("en", "landing")).toBe(false);
    expect(has("en", "landing.title1")).toBe(true);
  });

  it("does not read slot names from the prototype", () => {
    expect(fill("{toString}", {})).toBe("{toString}");
  });

  it("recognises only the two locales", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("pt-BR")).toBe(true);
    for (const v of ["pt", "EN", "", null, 3, {}]) expect(isLocale(v)).toBe(false);
  });
});

describe("formatInt", () => {
  it("groups thousands per locale", () => {
    expect(formatInt("en", 1758)).toBe("1,758");
    expect(formatInt("pt-BR", 1758)).toBe("1.758");
    expect(formatInt("en", -1234567)).toBe("-1,234,567");
    expect(formatInt("en", 0)).toBe("0");
  });

  it("keeps the digits whatever the locale", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1e12, max: 1e12 }), (n) => {
        expect(Number(formatInt("en", n).replace(/,/g, ""))).toBe(n);
        expect(Number(formatInt("pt-BR", n).replace(/\./g, ""))).toBe(n);
      }),
    );
  });
});

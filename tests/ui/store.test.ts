import { describe, expect, it } from "vitest";
import { loadLocale, preferredLocale, saveLocale, type KeyValueStore } from "../../src/ui/store";

function memory(
  initial: Record<string, string> = {},
): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (Object.hasOwn(data, k) ? data[k]! : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

const throwing: KeyValueStore = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

describe("locale storage", () => {
  it("remembers the choice", () => {
    const store = memory();
    saveLocale(store, "pt-BR");
    expect(loadLocale(store, ["en-US"])).toBe("pt-BR");
  });

  it("falls back to the browser languages, then English", () => {
    expect(loadLocale(memory(), ["pt-PT", "en"])).toBe("pt-BR");
    expect(loadLocale(memory(), ["de", "en-GB"])).toBe("en");
    expect(loadLocale(memory(), ["fr"])).toBe("en");
    expect(preferredLocale([])).toBe("en");
  });

  it("ignores corrupt values", () => {
    for (const junk of ["", "pt", "{}", "null", "x".repeat(10_000)])
      expect(loadLocale(memory({ "force-push:locale": junk }), ["en"])).toBe("en");
  });

  it("works when storage throws or is missing", () => {
    expect(loadLocale(throwing, ["pt-BR"])).toBe("pt-BR");
    expect(() => saveLocale(throwing, "en")).not.toThrow();
    expect(loadLocale(null, ["en"])).toBe("en");
    expect(() => saveLocale(null, "en")).not.toThrow();
  });
});

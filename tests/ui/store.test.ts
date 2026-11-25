import { describe, expect, it } from "vitest";
import {
  loadLocale,
  loadMinutes,
  loadName,
  loadToken,
  preferredLocale,
  saveLocale,
  saveMinutes,
  saveName,
  saveToken,
  type KeyValueStore,
} from "../../src/ui/store";

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

describe("other settings", () => {
  it("remember the name, cleaned on the way in and out", () => {
    const store = memory();
    saveName(store, "  Ana  ");
    expect(loadName(store)).toBe("Ana");
    expect(loadName(memory({ "force-push:name": "<script>alert(1)</script>" }))).toBe("");
    expect(loadName(throwing)).toBe("");
  });

  it("remember the sprint length, ignoring anything but 2, 3 or 5", () => {
    const store = memory();
    saveMinutes(store, 5);
    expect(loadMinutes(store)).toBe(5);
    saveMinutes(store, 9);
    expect(loadMinutes(store)).toBe(5);
    for (const junk of ["", "7", "NaN", "3.5", "{}"])
      expect(loadMinutes(memory({ "force-push:minutes": junk }))).toBe(3);
    expect(loadMinutes(throwing)).toBe(3);
  });

  it("keep a rejoin token per room, only well-formed ones", () => {
    const store = memory();
    saveToken(store, "FRI-1758", "abc123");
    expect(loadToken(store, "FRI-1758")).toBe("abc123");
    expect(loadToken(store, "XYZ-0001")).toBe("");
    saveToken(store, "FRI-1758", "<bad>");
    expect(loadToken(store, "FRI-1758")).toBe("abc123");
    expect(loadToken(memory({ "force-push:token:FRI-1758": "../../x" }), "FRI-1758")).toBe("");
  });
});

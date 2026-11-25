import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";

/** The ESLint rule that keeps src/core pure (CLAUDE.md, code conventions). */
const eslint = new ESLint();

async function errors(code: string, filePath = "src/core/probe.ts"): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result!.messages.filter((m) => m.severity === 2).map((m) => m.ruleId ?? "parse");
}

describe("src/core lint bans", () => {
  it.each([
    "export const r = Math.random();",
    "export const s = Math.sin(1);",
    "export const t = Date.now();",
    "export const d = new Date();",
    "export const p = performance.now();",
    "export const w = window.innerWidth;",
    "export const q = document.body;",
    "export const l = localStorage.getItem('x');",
    "export const f = fetch('/');",
    "export const ws = new WebSocket('wss://x');",
    "setTimeout(() => {}, 1);",
  ])("rejects %s", async (code) => {
    expect((await errors(code)).length).toBeGreaterThan(0);
  });

  it("allows integer maths", async () => {
    expect(
      await errors("export const a = Math.max(1, 2) + Math.floor(7 / 2) + Math.abs(-1);"),
    ).toEqual([]);
  });

  it("does not apply outside src/core", async () => {
    expect(await errors("export const r = Math.random();", "src/ui/probe.ts")).toEqual([]);
  });
});

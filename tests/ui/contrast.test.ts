import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/** WCAG contrast of the text/background token pairs the UI uses (CLAUDE.md: 4.5:1). */
const css = readFileSync("src/styles.css", "utf8");
const token = (name: string) => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i").exec(css);
  if (!m) throw new Error(`no token ${name}`);
  return m[1]!;
};

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

describe("colour contrast", () => {
  const pairs: [string, string][] = [
    ["text", "ground"],
    ["text", "deep"],
    ["muted", "ground"],
    ["add", "ground"],
    ["remove", "ground"],
    ["on-add", "add"],
    ["on-branch", "main"],
    ["on-branch", "feature"],
    ["on-branch", "hotfix"],
    ["on-branch", "dev"],
    ["main", "ground"],
    ["feature", "ground"],
    ["hotfix", "ground"],
    ["dev", "ground"],
  ];
  it.each(pairs)("%s on %s is at least 4.5:1", (fg, bg) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
  });
});

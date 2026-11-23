/**
 * Fails when the built JS + CSS (gzipped, fonts and images aside) goes over the first-load budget
 * in CLAUDE.md (250 KB, three.js included). Runs as part of `npm run check`, after the build.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

export const BUDGET_BYTES = 250 * 1024;

export function gzippedAssetBytes(dir: string): { file: string; bytes: number }[] {
  return readdirSync(dir)
    .filter((file) => /\.(js|css)$/.test(file))
    .map((file) => ({ file, bytes: gzipSync(readFileSync(join(dir, file))).length }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sizes = gzippedAssetBytes("dist/assets");
  let total = 0;
  for (const { file, bytes } of sizes) {
    total += bytes;
    console.log(`${file.padEnd(36)} ${(bytes / 1024).toFixed(1)} KB gzipped`);
  }
  console.log(`total ${(total / 1024).toFixed(1)} KB of ${BUDGET_BYTES / 1024} KB budget`);
  if (total > BUDGET_BYTES) {
    console.error("Over the performance budget (CLAUDE.md).");
    process.exit(1);
  }
}

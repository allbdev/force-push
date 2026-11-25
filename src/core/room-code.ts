/**
 * Room codes (GAME_PLAN.md §7): three letters and four digits, `FRI-1758`. The letters skip I and
 * O so nobody mistakes them for 1 and 0. Codes are made from random numbers the host provides.
 */
export const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
/** Parsing accepts any letters (people type what they read); only generation skips I and O. */
const CODE_RE = /^([A-Z]{3})-?(\d{4})$/;

/** Builds a code from four random unsigned 32-bit integers. */
export function makeRoomCode(random: readonly number[]): string {
  const r = (k: number) => (random[k] ?? 0) >>> 0;
  const letters = [0, 1, 2].map((k) => CODE_LETTERS[r(k) % CODE_LETTERS.length]).join("");
  const digits = String(r(3) % 10_000).padStart(4, "0");
  return `${letters}-${digits}`;
}

/** Normalises what a player typed or a link carried, or null if it isn't a code. */
export function parseRoomCode(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 16) return null;
  const m = CODE_RE.exec(input.trim().toUpperCase());
  return m ? `${m[1]}-${m[2]}` : null;
}

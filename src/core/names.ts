/**
 * Player names (GAME_PLAN.md §7): optional, up to 12 characters of letters and digits in any
 * script, space, `_` and `-`. Checked on the server; shown only as text (never as markup).
 */
export const MAX_NAME = 12;

/** A cleaned name, or "" when the input isn't an acceptable name. */
export function cleanName(input: unknown): string {
  if (typeof input !== "string" || input.length > 64) return "";
  const name = input.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (!name || [...name].length > MAX_NAME) return "";
  return /^[\p{L}\p{M}\p{N} _-]+$/u.test(name) ? name : "";
}

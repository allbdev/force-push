import { DEFAULT_LOCALE, isLocale, type Locale } from "../content/i18n";
import { cleanName } from "../core/names";
import { RULES } from "../content/rules";

/**
 * Per-player conveniences in localStorage, always behind try/catch: storage can be missing,
 * full, blocked, or hold anything at all. Nothing here is ever trusted or required.
 */
export type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

const KEYS = {
  locale: "force-push:locale",
  name: "force-push:name",
  token: "force-push:token:",
  minutes: "force-push:minutes",
} as const;

/** The browser's storage, or null when touching it throws (private mode, blocked cookies). */
export function browserStore(): KeyValueStore | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function read(store: KeyValueStore | null, key: string): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(store: KeyValueStore | null, key: string, value: string): void {
  try {
    store?.setItem(key, value);
  } catch {
    // Full or blocked storage: the game works without it.
  }
}

/** The first locale the browser prefers that we have; English otherwise. */
export function preferredLocale(languages: readonly string[]): Locale {
  for (const lang of languages) {
    if (lang.toLowerCase().startsWith("pt")) return "pt-BR";
    if (lang.toLowerCase().startsWith("en")) return "en";
  }
  return DEFAULT_LOCALE;
}

export function loadLocale(store: KeyValueStore | null, languages: readonly string[]): Locale {
  const saved = read(store, KEYS.locale);
  return isLocale(saved) ? saved : preferredLocale(languages);
}

export function saveLocale(store: KeyValueStore | null, locale: Locale): void {
  write(store, KEYS.locale, locale);
}

/** The last name used, cleaned again on the way out (storage may hold anything). */
export function loadName(store: KeyValueStore | null): string {
  return cleanName(read(store, KEYS.name));
}

export function saveName(store: KeyValueStore | null, name: string): void {
  write(store, KEYS.name, cleanName(name));
}

/** The rejoin token for a room, so a dropped player gets their seat back. */
export function loadToken(store: KeyValueStore | null, code: string): string {
  const v = read(store, KEYS.token + code) ?? "";
  return /^[a-z0-9]{1,64}$/.test(v) ? v : "";
}

export function saveToken(store: KeyValueStore | null, code: string, token: string): void {
  if (/^[A-Z]{3}-\d{4}$/.test(code) && /^[a-z0-9]{1,64}$/.test(token))
    write(store, KEYS.token + code, token);
}

/** The last sprint length the player picked (2, 3 or 5), or the default. */
export function loadMinutes(store: KeyValueStore | null): number {
  const v = Number(read(store, KEYS.minutes));
  return (RULES.sprintMinutes as readonly number[]).includes(v) ? v : RULES.defaultSprintMinutes;
}

export function saveMinutes(store: KeyValueStore | null, minutes: number): void {
  if ((RULES.sprintMinutes as readonly number[]).includes(minutes))
    write(store, KEYS.minutes, String(minutes));
}

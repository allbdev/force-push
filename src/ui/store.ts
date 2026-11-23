import { DEFAULT_LOCALE, isLocale, type Locale } from "../content/i18n";

/**
 * Per-player conveniences in localStorage, always behind try/catch: storage can be missing,
 * full, blocked, or hold anything at all. Nothing here is ever trusted or required.
 */
export type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

const KEYS = { locale: "force-push:locale" } as const;

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

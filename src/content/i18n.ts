import en, { type LocaleDict } from "./locales/en";
import ptBR from "./locales/pt-BR";

/**
 * Two locales, English first. The locale changes words and number formats only: never the
 * simulation, the score or a replay.
 */
export type Locale = "en" | "pt-BR";
export const LOCALES: readonly Locale[] = ["en", "pt-BR"];
export const DEFAULT_LOCALE: Locale = "en";

export const DICTS: Record<Locale, LocaleDict> = { en, "pt-BR": ptBR };

export type Slots = Readonly<Record<string, string | number>>;

type Node = string | { readonly [k: string]: Node };

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "pt-BR";
}

function lookup(locale: Locale, key: string): Node | undefined {
  let node: Node | undefined = DICTS[locale] as unknown as Node;
  for (const part of key.split(".")) {
    if (node === undefined || typeof node === "string") return undefined;
    node = Object.hasOwn(node, part) ? node[part] : undefined;
  }
  return node;
}

/** Fills `{name}` slots; an unknown slot stays as written so it's easy to spot. */
export function fill(template: string, slots: Slots = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(slots, name) ? String(slots[name]) : match,
  );
}

/** A string by dotted key. A missing key shows the key itself. */
export function translate(locale: Locale, key: string, slots: Slots = {}): string {
  const node = lookup(locale, key);
  return typeof node === "string" ? fill(node, slots) : key;
}

export function has(locale: Locale, key: string): boolean {
  return typeof lookup(locale, key) === "string";
}

/** Whole numbers with the locale's thousands separator: "1,758" / "1.758". */
export function formatInt(locale: Locale, n: number): string {
  const sign = n < 0 ? "-" : "";
  const digits = String(Math.abs(Math.trunc(n)));
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, locale === "pt-BR" ? "." : ",");
}

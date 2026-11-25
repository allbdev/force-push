import { translate, type Locale, type Slots } from "../content/i18n";

/** The locale the interface is drawn in. Set once at boot and by the toggle. */
let current: Locale = "en";

export function setLocale(locale: Locale): void {
  current = locale;
}

export function getLocale(): Locale {
  return current;
}

/** `t("landing.pitch", { command })` in the current locale. */
export function t(key: string, slots?: Slots): string {
  return translate(current, key, slots);
}

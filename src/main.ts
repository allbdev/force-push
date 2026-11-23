import "@fontsource/space-grotesk/latin-400.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-700.css";
import "@fontsource/space-grotesk/latin-ext-400.css";
import "@fontsource/space-grotesk/latin-ext-700.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import "@fontsource/jetbrains-mono/latin-ext-400.css";
import "./styles.css";
import type { Locale } from "./content/i18n";
import { renderLanding } from "./ui/landing";
import { getLocale, setLocale, t } from "./ui/i18n";
import { browserStore, loadLocale, saveLocale } from "./ui/store";

const app = document.getElementById("app")!;
const store = browserStore();

function draw(): void {
  document.documentElement.lang = getLocale();
  document.title = t("meta.title");
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute("content", t("meta.description"));
  app.replaceChildren(
    renderLanding(() => {
      const next: Locale = getLocale() === "en" ? "pt-BR" : "en";
      setLocale(next);
      saveLocale(store, next);
      draw();
      app.querySelector<HTMLButtonElement>("[data-testid=lang]")?.focus();
    }),
  );
}

setLocale(loadLocale(store, navigator.languages ?? [navigator.language]));
draw();

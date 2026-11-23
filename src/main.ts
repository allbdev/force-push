import "@fontsource/space-grotesk/latin-400.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-700.css";
import "@fontsource/space-grotesk/latin-ext-400.css";
import "@fontsource/space-grotesk/latin-ext-700.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import "@fontsource/jetbrains-mono/latin-ext-400.css";
import "./styles.css";
import { App } from "./ui/app";
import { setLocale, t } from "./ui/i18n";
import { browserStore, loadLocale } from "./ui/store";

const store = browserStore();
setLocale(loadLocale(store, navigator.languages ?? [navigator.language]));
document.documentElement.lang = loadLocale(store, navigator.languages ?? [navigator.language]);
document.title = t("meta.title");
document.querySelector('meta[name="description"]')?.setAttribute("content", t("meta.description"));

const app = new App(document.getElementById("app")!, {
  params: new URLSearchParams(location.search),
  connect: null,
});
app.start();

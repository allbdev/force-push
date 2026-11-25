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
import { browserStore, loadLocale, loadToken, saveToken } from "./ui/store";
import { createRoom, SocketSession } from "./net/socket-session";

const store = browserStore();
setLocale(loadLocale(store, navigator.languages ?? [navigator.language]));
document.documentElement.lang = loadLocale(store, navigator.languages ?? [navigator.language]);
document.title = t("meta.title");
document.querySelector('meta[name="description"]')?.setAttribute("content", t("meta.description"));

const params = new URLSearchParams(location.search);
const ms = (key: string) =>
  Math.min(
    2000,
    Math.max(0, Number(/^\d{1,4}$/.test(params.get(key) ?? "") ? params.get(key) : 0)),
  );
const net = {
  lag: ms("lag"),
  jitter: ms("jitter"),
  loadToken: (code: string) => loadToken(store, code),
  saveToken: (code: string, token: string) => saveToken(store, code, token),
};

const app = new App(document.getElementById("app")!, {
  params,
  online: {
    async create(name) {
      const code = await createRoom();
      return code ? new SocketSession(code, name, net) : null;
    },
    join: (code, name) => new SocketSession(code, name, net),
  },
});
app.start();

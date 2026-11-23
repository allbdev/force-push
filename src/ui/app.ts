/**
 * The client app: which screen is up, the session, the fixed 20-ticks-a-second loop, and the
 * test hooks. Game rules live in src/core; this only wires input, session, renderer and DOM.
 *
 * URL options (never linked from the UI): `?room=FRI-1758` (join form filled in), `?offline=1`
 * (straight into a match against bots), `&seed=N`, `&bots=4` (watch an all-bot match),
 * `&minutes=2|3|5`, `?test=1` (exposes `window.__mc`), `&speed=N`, `&lag=` and `&jitter=` (online).
 */
import { TICKS_PER_SECOND } from "../content/rules";
import { SITE_URL } from "../content/site";
import type { Locale } from "../content/i18n";
import { parseRoomCode } from "../core/room-code";
import { scoreMatch } from "../core/score";
import { shareData } from "../core/share";
import { cleanName } from "../core/names";
import { hashState, SEATS, type GameState } from "../core/state";
import { decodeReplay, encodeReplay, replayState } from "../core/replay";
import { el } from "./dom";
import { shareText } from "./format";
import { Hud } from "./hud";
import { getLocale, setLocale, t } from "./i18n";
import { bindKeyboard, InputState } from "./input";
import type { HeroScene } from "./hero";
import type { ArenaRenderer } from "./render3d";
import {
  prNumberFor,
  renderLanding,
  renderLobby,
  renderMapSelect,
  renderMenu,
  renderHighlight,
  renderResult,
} from "./screens";
import { cryptoRandom, LocalSession, type Session } from "./session";
import {
  findHighlight,
  HIGHLIGHT_AFTER,
  HIGHLIGHT_BEFORE,
  ReplaySession,
  type Highlight,
} from "./replay-session";
import { browserStore, loadMinutes, loadName, saveLocale, saveMinutes, saveName } from "./store";
import { buildTouchControls, hasTouch } from "./touch";

const TICK_MS = 1000 / TICKS_PER_SECOND;

export type AppOptions = {
  readonly params: URLSearchParams;
  /** Online rooms: create one (null when there's no room server) or join one by code. */
  readonly online: {
    create(name: string): Promise<Session | null>;
    join(code: string, name: string): Session;
  } | null;
};

type ScreenKind = "landing" | "lobby" | "match" | "result";

type TestHooks = {
  play(inputs: readonly number[]): void;
  state(): GameState | null;
  paused: boolean;
  seat(): number;
  screen(): ScreenKind;
  hash(): number;
  /** Runs a replay to the end in this browser and returns the final state's hash (or -1). */
  replayHash(text: string): number;
};

function intParam(params: URLSearchParams, key: string): number | null {
  const v = params.get(key);
  if (v === null || !/^-?\d{1,10}$/.test(v)) return null;
  return Number(v);
}

export class App {
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly screenLayer: HTMLElement;
  private readonly hudLayer: HTMLElement;
  private readonly input = new InputState();
  private readonly store = browserStore();
  private readonly options: AppOptions;
  private readonly test: boolean;
  private readonly speed: number;
  private readonly reducedMotion: boolean;
  private readonly touch = hasTouch();
  private session: Session | null = null;
  private renderer: ArenaRenderer | null = null;
  private rendererFailed = false;
  private hero: HeroScene | null = null;
  private heroCanvas: HTMLCanvasElement | null = null;
  private heroState: "idle" | "loading" | "failed" = "idle";
  private hud: Hud | null = null;
  private screen: ScreenKind = "landing";
  private shownLobby: unknown = null;
  private menu: HTMLElement | null = null;
  private copied = "";
  private acc = 0;
  private last = 0;
  private scripted: number[] = [];
  private paused = false;
  private matchSeed = -1;
  private offlineNote = false;
  private closedNote = false;
  private pickingMap = false;
  private appliedMinutes = false;
  private replayBroken = false;
  private mainSession: Session | null = null;
  private highlight: Highlight | null = null;
  private connection: "connecting" | "open" | "lost" | "closed" = "open";

  constructor(root: HTMLElement, options: AppOptions) {
    this.root = root;
    this.options = options;
    const p = options.params;
    this.test = p.get("test") === "1";
    this.speed = Math.min(20, Math.max(1, intParam(p, "speed") ?? 1));
    this.reducedMotion =
      globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    this.canvas = el("canvas", { class: "arena", "aria-hidden": "true" });
    this.hudLayer = el("div", { class: "hud-layer" });
    this.screenLayer = el("div", { class: "screen-layer" });
    root.replaceChildren(this.canvas, this.hudLayer, this.screenLayer);
    bindKeyboard(window, this.input, () => this.toggleMenu());
    window.addEventListener("resize", () => this.resize());
    if (this.test) this.exposeHooks();
  }

  start(): void {
    const p = this.options.params;
    const replayParam = p.get("replay");
    if (replayParam !== null) this.watchReplay(replayParam);
    else if (p.get("offline") === "1") this.practice(loadName(this.store));
    else this.showLanding();
    this.resize();
    requestAnimationFrame((now) => {
      this.last = now;
      this.frame(now);
    });
  }

  // ----- screens -----------------------------------------------------------------------------

  private toggleLocale = (): void => {
    const next: Locale = getLocale() === "en" ? "pt-BR" : "en";
    setLocale(next);
    saveLocale(this.store, next);
    document.documentElement.lang = next;
    document.title = t("meta.title");
    this.shownLobby = null;
    this.rebuildHud();
    this.renderScreen(true);
    if (this.menu) {
      this.closeMenu();
      this.toggleMenu();
    }
    this.root.querySelector<HTMLButtonElement>("[data-testid=lang]")?.focus();
  };

  private showLanding(): void {
    this.screen = "landing";
    this.renderScreen(true);
  }

  private renderScreen(force = false): void {
    const client = this.session?.client;
    let next: ScreenKind = "landing";
    if (client) {
      const phase = client.lobby?.phase ?? "lobby";
      if (phase === "playing" && client.confirmed) next = "match";
      else if (phase === "result" && client.confirmed) next = "result";
      else next = "lobby";
    }
    const lobby = client?.lobby ?? null;
    // The host's last sprint length, applied once when their lobby first arrives.
    if (
      client &&
      lobby &&
      !this.appliedMinutes &&
      lobby.phase === "lobby" &&
      client.seat === lobby.host
    ) {
      this.appliedMinutes = true;
      const minutes = loadMinutes(this.store);
      if (minutes !== lobby.minutes) client.send({ t: "settings", mapId: lobby.mapId, minutes });
    }
    if (!force && next === this.screen && lobby === this.shownLobby) return;
    const entering = next !== this.screen;
    this.screen = next;
    this.shownLobby = lobby;
    document.body.dataset.screen = next;
    if (next === "landing") this.showHero();
    else this.hideHero();

    if (next === "match" && entering) this.enterMatch();
    if (next !== "match" && next !== "result") this.leaveMatchView();

    switch (next) {
      case "landing":
        this.screenLayer.replaceChildren(
          renderLanding(
            {
              onCreate: (name) => this.create(name),
              onJoin: (code, name) => this.join(code, name),
              onPractice: (name) => this.practice(name),
              onToggleLocale: this.toggleLocale,
            },
            {
              name: loadName(this.store),
              offline: this.offlineNote,
              closed: this.closedNote,
              broken: this.replayBroken,
              code: parseRoomCode(this.options.params.get("room")),
            },
          ),
        );
        break;
      case "lobby":
        if (!client || !lobby) {
          this.screenLayer.replaceChildren(
            el("p", { class: "connecting", role: "status" }, t("connection.connecting")),
          );
          break;
        }
        if (this.pickingMap && client.seat === lobby.host) {
          this.screenLayer.replaceChildren(
            renderMapSelect(
              lobby.mapId,
              (mapId) => {
                client.send({ t: "settings", mapId, minutes: lobby.minutes });
                this.pickingMap = false;
                this.renderScreen(true);
              },
              () => {
                this.pickingMap = false;
                this.renderScreen(true);
              },
            ),
          );
          break;
        }
        this.screenLayer.replaceChildren(
          renderLobby(
            lobby,
            client.seat,
            {
              onReady: (ready) => client.send({ t: "ready", ready }),
              onSettings: (mapId, minutes) => {
                saveMinutes(this.store, minutes);
                client.send({ t: "settings", mapId, minutes });
              },
              onStart: () => client.send({ t: "start" }),
              onLeave: () => this.leave(),
              onCopyLink: () => this.copyLink(),
              onPickMap: () => {
                this.pickingMap = true;
                this.renderScreen(true);
              },
            },
            { offline: this.session!.offline, copied: this.copied },
          ),
        );
        break;
      case "match":
        this.screenLayer.replaceChildren();
        break;
      case "result": {
        const s = client!.confirmed!;
        const result = scoreMatch(s);
        const code = this.session!.code;
        const text = shareText(shareData(result, s, code ?? t("hud.offline"), client!.seat));
        this.screenLayer.replaceChildren(
          renderResult(
            result,
            lobby,
            client!.seat,
            prNumberFor(code, s.seed),
            {
              onRematch: () => client!.send({ t: "rematch" }),
              onChangeMap: () => client!.send({ t: "lobby" }),
              onShare: () => this.copy(text, t("result.copied")),
              ...(client!.replay() && !(this.session instanceof ReplaySession)
                ? {
                    onHighlight: () => this.playHighlight(),
                    onCopyReplay: () => this.copyReplay(),
                  }
                : {}),
            },
            { shareText: text, copied: this.copied, offline: this.session!.offline },
          ),
        );
        break;
      }
    }
  }

  // ----- replays -----------------------------------------------------------------------------

  private watchReplay(text: string): void {
    const replay = decodeReplay(text);
    if (!replay) {
      this.replayBroken = true;
      this.showLanding();
      return;
    }
    this.open(new ReplaySession(replay), "");
  }

  private copyReplay(): void {
    const replay = this.session?.client.replay();
    if (replay) this.copy(`${SITE_URL}/?replay=${encodeReplay(replay)}`, t("result.replayCopied"));
  }

  /** Board 4: a few seconds around the biggest push, camera down close, then back. */
  private playHighlight(): void {
    const main = this.session;
    const replay = main?.client.replay();
    if (!main || !replay) return;
    const h = findHighlight(replay);
    if (!h) return;
    const n = replay.inputs.length / SEATS;
    this.mainSession = main;
    this.highlight = h;
    this.session = new ReplaySession(
      replay,
      Math.max(0, h.tick - HIGHLIGHT_BEFORE),
      Math.min(n, h.tick + HIGHLIGHT_AFTER),
      () => this.endHighlight(),
    );
    this.renderScreen(true);
    this.rebuildHud();
  }

  private endHighlight(): void {
    if (!this.mainSession) return;
    this.session = this.mainSession;
    this.mainSession = null;
    this.highlight = null;
    this.renderScreen(true);
    this.rebuildHud();
  }

  // ----- sessions ----------------------------------------------------------------------------

  private open(session: Session, name: string): void {
    this.session?.close();
    this.appliedMinutes = false;
    this.session = session;
    saveName(this.store, cleanName(name));
    session.onStatus = (status) => {
      this.connection = status;
      if (status === "closed" && this.session === session) {
        this.session = null;
        this.closedNote = true;
        this.setRoomInUrl(null);
        this.showLanding();
        return;
      }
      this.renderScreen(true);
    };
    this.renderScreen(true);
  }

  private practice(name: string): void {
    const p = this.options.params;
    const seed = intParam(p, "seed");
    let first = true;
    const random = () => {
      if (first && seed !== null) {
        first = false;
        return seed >>> 0;
      }
      return cryptoRandom();
    };
    const watch = p.get("bots") === "4";
    const session = new LocalSession(cleanName(name), random, watch);
    const minutes = intParam(p, "minutes");
    if (watch) session.startWatching();
    else {
      if (minutes) session.client.send({ t: "settings", mapId: "open-space", minutes });
      session.client.send({ t: "start" });
    }
    this.open(session, name);
  }

  private create(name: string): void {
    const online = this.options.online;
    if (!online) return this.createOffline(name);
    this.screenLayer.replaceChildren(
      el("p", { class: "connecting", role: "status" }, t("connection.connecting")),
    );
    void online.create(cleanName(name)).then((session) => {
      if (!session) return this.createOffline(name);
      this.open(session, name);
      this.setRoomInUrl(session.code);
    });
  }

  /** No room server: the same lobby, offline, bots in the other seats. */
  private createOffline(name: string): void {
    this.offlineNote = true;
    this.open(new LocalSession(cleanName(name), cryptoRandom), name);
  }

  private join(code: string, name: string): void {
    const online = this.options.online;
    if (!online) {
      this.offlineNote = true;
      this.showLanding();
      return;
    }
    const session = online.join(code, cleanName(name));
    this.open(session, name);
    this.setRoomInUrl(code);
  }

  private setRoomInUrl(code: string | null): void {
    const url = new URL(location.href);
    if (code) url.searchParams.set("room", code);
    else url.searchParams.delete("room");
    history.replaceState(null, "", url);
  }

  private leave(): void {
    this.session?.client.send({ t: "leave" });
    this.session?.close();
    this.session = null;
    this.closeMenu();
    this.leaveMatchView();
    this.setRoomInUrl(null);
    this.showLanding();
  }

  private copyLink(): void {
    const code = this.session?.code;
    if (!code) return;
    this.copy(`${SITE_URL}/?room=${code}`, t("lobby.copied"));
  }

  private copy(text: string, done: string): void {
    const finish = (ok: boolean) => {
      this.copied = ok ? done : `${t("lobby.copyFallback")} ${text}`;
      this.renderScreen(true);
      setTimeout(() => {
        this.copied = "";
      }, 4000);
    };
    if (navigator.clipboard?.writeText)
      navigator.clipboard.writeText(text).then(
        () => finish(true),
        () => finish(false),
      );
    else finish(false);
  }

  // ----- landing hero ------------------------------------------------------------------------

  /** The 3D scene behind the landing. three.js loads after first paint; no WebGL, no scene. */
  private showHero(): void {
    if (this.hero || this.heroState !== "idle") return;
    this.heroState = "loading";
    import("./hero").then(
      ({ HeroScene }) => {
        this.heroState = "idle";
        if (this.screen !== "landing" || this.hero) return;
        const canvas = el("canvas", { class: "hero", "aria-hidden": "true" });
        try {
          this.hero = new HeroScene(canvas);
        } catch {
          this.heroState = "failed";
          return;
        }
        this.heroCanvas = canvas;
        this.root.insertBefore(canvas, this.canvas);
        this.resize();
        // Fade in on the next frame, once the first picture is on the canvas.
        requestAnimationFrame(() => canvas.classList.add("is-ready"));
      },
      () => {
        this.heroState = "failed";
      },
    );
  }

  private hideHero(): void {
    this.hero?.dispose();
    this.hero = null;
    this.heroCanvas?.remove();
    this.heroCanvas = null;
  }

  // ----- match view --------------------------------------------------------------------------

  private async ensureRenderer(): Promise<ArenaRenderer | null> {
    if (this.renderer || this.rendererFailed) return this.renderer;
    try {
      const { ArenaRenderer } = await import("./render3d");
      this.renderer = new ArenaRenderer(this.canvas);
      this.resize();
    } catch {
      this.rendererFailed = true;
    }
    return this.renderer;
  }

  private enterMatch(): void {
    void this.ensureRenderer();
    this.input.clear();
    this.rebuildHud();
  }

  private rebuildHud(): void {
    this.hud?.dispose();
    this.hud = null;
    this.hudLayer.replaceChildren();
    const client = this.session?.client;
    if (!client || (this.screen !== "match" && this.screen !== "result")) return;
    if (this.highlight) {
      this.hudLayer.append(renderHighlight(this.highlight, () => this.endHighlight()));
      return;
    }
    this.hud = new Hud(this.hudInfo(), () => this.toggleMenu());
    this.hudLayer.append(this.hud.root);
    if (this.touch && client.seat >= 0) this.hudLayer.append(buildTouchControls(this.input));
  }

  private hudInfo() {
    const client = this.session!.client;
    return {
      code: this.session!.code,
      names: client.lobby?.seats.map((s) => (s.kind === "human" ? s.name : "")) ?? [],
      seat: client.seat,
      touch: this.touch,
      ping: this.session!.ping(),
    };
  }

  private leaveMatchView(): void {
    this.hud?.dispose();
    this.hud = null;
    this.hudLayer.replaceChildren();
    document.body.classList.remove("is-reverted");
  }

  private toggleMenu(): void {
    if (this.menu) return this.closeMenu();
    if (this.screen !== "match") return;
    this.menu = renderMenu(
      () => this.closeMenu(),
      () => this.leave(),
      this.toggleLocale,
    );
    this.root.append(this.menu);
  }

  private closeMenu(): void {
    this.menu?.remove();
    this.menu = null;
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer?.resize(w, h);
    if (this.hero) {
      this.hero.resize(w, h);
      // A still frame under reduced motion; otherwise the loop takes over from here.
      this.hero.draw(this.reducedMotion ? 0 : this.last / 1000);
    }
  }

  // ----- loop --------------------------------------------------------------------------------

  private frame(now: number): void {
    const dt = Math.min(0.25, (now - this.last) / 1000);
    this.last = now;
    const session = this.session;
    const client = session?.client;
    if (session && client) {
      if (!this.paused) {
        // The highlight always plays in real time.
        this.acc += dt * 1000 * (this.highlight ? 1 : this.speed);
        let steps = 0;
        // Offline the room catches up after a stall; online the server keeps its own clock and a
        // burst of stale inputs helps nobody.
        const maxSteps = session.offline ? 40 : 3;
        while (this.acc >= TICK_MS && steps < maxSteps) {
          this.acc -= TICK_MS;
          steps++;
          const bits = this.scripted.length ? this.scripted.shift()! : this.input.sample();
          session.tick(bits);
        }
        if (steps >= maxSteps) this.acc = Math.min(this.acc, TICK_MS);
      }
      const s = client.confirmed;
      if (s && s.seed !== this.matchSeed) {
        this.matchSeed = s.seed;
        if (this.renderer) this.renderer.setMatch(s);
        this.rebuildHud();
      }
      if (client.events.length && s) {
        const events = client.events.splice(0);
        this.hud?.onEvents(events, s.seed, s.tick, client.seat);
        this.renderer?.onEvents(events, this.reducedMotion);
      }
      this.renderScreen();
      if (
        s &&
        client.previous &&
        client.predicted &&
        this.renderer &&
        (this.screen === "match" || this.screen === "result")
      ) {
        const view = {
          confirmed: s,
          previous: client.previous,
          predicted: client.predicted,
          seat: client.seat,
          alpha: Math.min(1, this.acc / TICK_MS),
          reducedMotion: this.reducedMotion,
          closeUp: this.highlight ? { x: this.highlight.x, y: this.highlight.y } : null,
        };
        this.renderer.draw(view, dt, s.tick + view.alpha);
        this.hud?.update(s, client.predicted, this.hudInfo(), this.renderer);
      }
    }
    if (this.hero && !this.reducedMotion) this.hero.draw(now / 1000);
    requestAnimationFrame((t2) => this.frame(t2));
  }

  // ----- test hooks --------------------------------------------------------------------------

  private exposeHooks(): void {
    const hooks: TestHooks = {
      play: (inputs) => {
        this.scripted.push(...inputs.map((b) => b & 31));
      },
      state: () => this.session?.client.confirmed ?? null,
      get paused() {
        return app.paused;
      },
      set paused(v: boolean) {
        app.paused = v;
      },
      seat: () => this.session?.client.seat ?? -1,
      screen: () => this.screen,
      replayHash: (text) => {
        const r = decodeReplay(text);
        return r ? hashState(replayState(r)) : -1;
      },
      hash: () => {
        const st = this.session?.client.confirmed;
        return st ? hashState(st) : 0;
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const app = this;
    (window as unknown as { __mc: TestHooks }).__mc = hooks;
  }
}

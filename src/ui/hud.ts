/**
 * The match HUD (board 3) and the reverted overlay (board 5), as DOM over the canvas. Built once
 * per match; each frame only changes text and positions that moved. Text is always text.
 */
import { BRANCHES } from "../content/branches";
import { RULES } from "../content/rules";
import { freezeStart } from "../core/freeze";
import { ownedTiles, shares } from "../core/score";
import { inPlay, type GameEvent, type GameState } from "../core/state";
import { el } from "./dom";
import { branchName, commitHash, formatClock, logLine, powerUpLabel } from "./format";
import { t } from "./i18n";
import type { ArenaRenderer } from "./render3d";

export type HudInfo = {
  readonly code: string | null;
  readonly names: readonly string[];
  readonly seat: number;
  readonly touch: boolean;
  readonly ping: number | null;
};

const LOG_LINES = 4;

function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

export class Hud {
  readonly root: HTMLElement;
  private readonly timerLabel: HTMLElement;
  private readonly timer: HTMLElement;
  private readonly timerPanel: HTMLElement;
  private readonly shareValues: HTMLElement[];
  private readonly bar: HTMLElement;
  private readonly barParts: HTMLElement[];
  private readonly roomValue: HTMLElement;
  private readonly mine: HTMLElement;
  private readonly ping: HTMLElement;
  private readonly tags: HTMLElement[];
  private readonly labels: HTMLElement;
  private readonly log: HTMLElement;
  private readonly logLines: { seat: number; text: string; hash: string }[] = [];
  private readonly pushesValue: HTMLElement;
  private readonly rangeValue: HTMLElement;
  private readonly status: HTMLElement;
  private readonly reverted: HTMLElement;
  private readonly revertedCommand: HTMLElement;
  private readonly revertedBy: HTMLElement;
  private readonly revertedCount: HTMLElement;
  private readonly pool: HTMLElement[] = [];
  private seed = 0;
  private logIndex = 0;

  constructor(info: HudInfo, onMenu: () => void) {
    this.timerLabel = el("span", { class: "hud-label" }, t("hud.sprintEndsIn"));
    this.timer = el("span", { class: "hud-big", "data-testid": "timer" }, "00:00");
    this.timerPanel = el("div", { class: "panel hud-timer" }, this.timerLabel, this.timer);

    this.shareValues = BRANCHES.map(() => el("span", { class: "hud-share" }, "0%"));
    const chips = el(
      "div",
      { class: "hud-chips" },
      ...BRANCHES.map((b, seat) =>
        el(
          "div",
          { class: "hud-chip" },
          el("span", { class: `tag tag-${b}` }, b),
          this.shareValues[seat]!,
        ),
      ),
    );
    this.barParts = BRANCHES.map((b) => el("span", { class: `bar-${b}` }));
    this.bar = el("div", { class: "territory-bar", role: "img" }, ...this.barParts);
    this.mine = el("span", { class: "hud-mine" }, "");
    const territory = el("div", { class: "panel hud-territory" }, chips, this.mine, this.bar);

    this.roomValue = el(
      "span",
      { class: "hud-mid", "data-testid": "room-code" },
      info.code ?? t("hud.offline"),
    );
    this.ping = el("span", { class: "hud-ping" }, "");
    const room = el(
      "div",
      { class: "panel hud-room" },
      el("span", { class: "hud-label" }, t("hud.room")),
      this.roomValue,
      this.ping,
    );
    const menu = el(
      "button",
      { class: "hud-menu", type: "button", "aria-label": t("hud.menu") },
      "☰",
    );
    menu.addEventListener("click", onMenu);
    const top = el("div", { class: "hud-top" }, this.timerPanel, territory, room, menu);

    this.labels = el("div", { class: "hud-labels", "aria-hidden": "true" });
    this.tags = BRANCHES.map((b, seat) => {
      const name = seat === info.seat ? t("hud.you") : info.names[seat] || t("lobby.bot");
      const tag = el("span", { class: `tag tag-${b} name-tag` }, `${b} · ${name}`);
      this.labels.append(tag);
      return tag;
    });

    this.log = el("div", { class: "panel hud-log", "aria-live": "off" });
    this.pushesValue = el("span", { class: "hud-mid", "data-testid": "pushes" }, "2 / 2");
    this.rangeValue = el("span", { class: "hud-mid" }, "2");
    const stats = el(
      "div",
      { class: "panel hud-stats" },
      el(
        "div",
        { class: "hud-stat" },
        el("span", { class: "hud-label" }, t("hud.yourPushes")),
        this.pushesValue,
      ),
      el(
        "div",
        { class: "hud-stat" },
        el("span", { class: "hud-label" }, t("hud.range")),
        this.rangeValue,
      ),
      el("span", { class: "hud-hint" }, info.touch ? t("hud.hintTouch") : t("hud.hintKeys")),
    );
    if (info.seat < 0) stats.hidden = true;
    const bottom = el("div", { class: "hud-bottom" }, this.log, stats);

    this.status = el("p", { class: "sr-only", role: "status", "aria-live": "polite" });

    this.revertedCommand = el("p", { class: "rv-command" });
    this.revertedBy = el("p", { class: "rv-by" });
    this.revertedCount = el("p", { class: "rv-count", "aria-live": "assertive" });
    this.reverted = el(
      "div",
      { class: "reverted", hidden: "" },
      this.revertedCommand,
      el("h2", { class: "rv-title" }, t("reverted.title")),
      this.revertedBy,
      this.revertedCount,
      el("p", { class: "panel rv-note" }, t("reverted.note")),
    );

    this.root = el("div", { class: "hud" }, top, this.labels, bottom, this.reverted, this.status);
  }

  /** New confirmed events: commit log lines and announcements. */
  onEvents(events: readonly GameEvent[], seed: number, tick: number, seat: number): void {
    this.seed = seed;
    for (const e of events) {
      const line = logLine(e);
      if (line) {
        this.logLines.push({ ...line, hash: commitHash(this.seed, tick, this.logIndex++) });
        if (this.logLines.length > LOG_LINES) this.logLines.shift();
      }
      if (e.type === "revert" && e.seat === seat) setText(this.status, t("reverted.title"));
    }
    if (events.some((e) => logLine(e))) this.renderLog();
  }

  private renderLog(): void {
    this.log.replaceChildren(
      ...this.logLines.map((l) =>
        el("div", { class: `log-line log-${BRANCHES[l.seat]}` }, `${l.hash} ${l.text}`),
      ),
    );
  }

  update(s: GameState, predicted: GameState, info: HudInfo, renderer: ArenaRenderer): void {
    // Timer: "code freeze in" once the freeze starts.
    const left = s.endTick - s.tick;
    const frozen = s.freeze && s.tick >= freezeStart(s);
    setText(this.timerLabel, frozen ? t("hud.freezeIn") : t("hud.sprintEndsIn"));
    this.timerPanel.classList.toggle("freeze", frozen);
    setText(this.timer, formatClock(left));

    // Territory.
    const owned = BRANCHES.map((_, seat) => ownedTiles(s, seat));
    const pct = shares(owned);
    pct.forEach((p, seat) => {
      setText(this.shareValues[seat]!, `${p}%`);
      this.barParts[seat]!.style.flexGrow = String(Math.max(p, 0.0001));
    });
    this.bar.setAttribute(
      "aria-label",
      t("hud.territory", { list: BRANCHES.map((b, seat) => `${b} ${pct[seat]}%`).join(", ") }),
    );
    if (info.seat >= 0) setText(this.mine, `${t("hud.you")} ${pct[info.seat]}%`);
    if (info.ping !== null) setText(this.ping, t("hud.ping", { ms: info.ping }));

    // Name tags over the players.
    s.players.forEach((_, seat) => {
      const point = renderer.drawn[seat];
      const tag = this.tags[seat]!;
      if (!point || !renderer.visible[seat]) {
        tag.hidden = true;
        return;
      }
      tag.hidden = false;
      const p = renderer.toScreen(point.x, point.y, 1.15);
      tag.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
    });

    // Floating labels: own pending pushes, recent gains, power-ups on the floor.
    let used = 0;
    const label = (text: string, x: number, y: number, h: number, cls: string) => {
      let node = this.pool[used];
      if (!node) {
        node = el("span", {});
        this.pool.push(node);
        this.labels.append(node);
      }
      used++;
      node.hidden = false;
      if (node.className !== cls) node.className = cls;
      setText(node, text);
      const p = renderer.toScreen(x, y, h);
      node.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -50%)`;
    };
    for (const q of predicted.pushes) {
      if (q.owner !== info.seat) continue;
      const secs = Math.max(1, Math.ceil(q.fuse / 20));
      label(t("hud.pushIn", { s: secs }), q.x, q.y, 1.0, "float-label panel-chip");
    }
    for (const g of renderer.gains) {
      label(
        t("hud.gain", { n: g.n, branch: branchName(g.seat) }),
        g.x,
        g.y,
        0.9 + g.age * 0.5,
        `float-label panel-chip gain-${BRANCHES[g.seat]}`,
      );
    }
    for (let i = 0; i < s.item.length; i++) {
      if (!s.item[i]) continue;
      label(
        powerUpLabel(s.item[i]!),
        i % s.width,
        i / s.width - (i % s.width) / s.width + 0.45,
        0.05,
        "float-label item-label",
      );
    }
    for (let k = used; k < this.pool.length; k++) this.pool[k]!.hidden = true;

    // Your pushes and range.
    if (info.seat >= 0) {
      const me = predicted.players[info.seat]!;
      const placed = predicted.pushes.filter((q) => q.owner === info.seat).length;
      setText(this.pushesValue, `${me.carry - placed} / ${me.carry}`);
      setText(this.rangeValue, String(me.range));

      // Reverted overlay.
      const conf = s.players[info.seat]!;
      const out = !inPlay(conf);
      this.reverted.hidden = !out;
      document.body.classList.toggle("is-reverted", out);
      if (out) {
        const by = conf.revertedBy;
        setText(this.revertedCommand, t("reverted.command", { branch: branchName(info.seat) }));
        const frozenTile = s.kind[conf.fellY * s.width + conf.fellX] === 3;
        setText(
          this.revertedBy,
          by >= 0
            ? t("reverted.by", { branch: branchName(by) })
            : frozenTile
              ? t("reverted.freeze")
              : t("reverted.self"),
        );
        setText(this.revertedCount, String(Math.max(1, Math.ceil(conf.out / 20))));
        this.revertedCount.dataset.seconds = String(Math.ceil(conf.out / 20));
        void RULES;
      }
    }
  }

  dispose(): void {
    document.body.classList.remove("is-reverted");
  }
}

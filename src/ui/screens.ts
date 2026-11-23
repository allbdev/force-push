/**
 * The DOM screens: landing (board 1), lobby (board 2), result (board 7) and the menu. Each is a
 * function from state to elements plus callbacks; the app swaps them in. Real buttons, labels on
 * everything, text as text.
 */
import { BRANCHES } from "../content/branches";
import { mapById, MAPS } from "../content/maps";
import { RULES } from "../content/rules";
import type { LobbyView } from "../core/protocol";
import { parseRoomCode } from "../core/room-code";
import type { MatchResult } from "../core/score";
import { el, withSlot } from "./dom";
import { branchName } from "./format";
import { getLocale, t } from "./i18n";

export type LandingHandlers = {
  readonly onCreate: (name: string) => void;
  readonly onJoin: (code: string, name: string) => void;
  readonly onPractice: (name: string) => void;
  readonly onToggleLocale: () => void;
};

function button(
  label: string,
  cls: string,
  onClick: () => void,
  attrs: Record<string, string> = {},
) {
  const b = el("button", { type: "button", class: cls, ...attrs }, label);
  b.addEventListener("click", onClick);
  return b;
}

function langToggle(onToggle: () => void): HTMLButtonElement {
  return button(t("lang.short"), "lang", onToggle, {
    "aria-label": t("lang.switchTo"),
    "data-testid": "lang",
  });
}

function tags(): HTMLElement {
  return el(
    "ul",
    { class: "tags" },
    ...BRANCHES.map((b) => el("li", { class: `tag tag-${b}` }, b)),
  );
}

export function renderLanding(
  h: LandingHandlers,
  opts: { name: string; offline: boolean; code: string | null; closed?: boolean },
): HTMLElement {
  const nameInput = el("input", {
    id: "player-name",
    class: "field",
    type: "text",
    maxlength: "12",
    autocomplete: "nickname",
    placeholder: t("landing.namePlaceholder"),
    "data-testid": "name",
  });
  nameInput.value = opts.name;
  const name = () => nameInput.value;

  const codeInput = el("input", {
    id: "room-code",
    class: "field field-code",
    type: "text",
    maxlength: "8",
    autocomplete: "off",
    autocapitalize: "characters",
    spellcheck: "false",
    placeholder: t("landing.codePlaceholder"),
    "data-testid": "code",
  });
  if (opts.code) codeInput.value = opts.code;
  const codeError = el("p", { class: "field-error", role: "alert", id: "code-error" });
  const joinForm = el(
    "form",
    { class: "join-form", hidden: "" },
    el("label", { for: "room-code", class: "field-label" }, t("landing.codeLabel")),
    el(
      "div",
      { class: "row" },
      codeInput,
      el(
        "button",
        { type: "submit", class: "btn btn-primary", "data-testid": "join-go" },
        t("landing.codeGo"),
      ),
    ),
    codeError,
  );
  joinForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const code = parseRoomCode(codeInput.value);
    if (!code) {
      codeError.textContent = t("landing.codeInvalid");
      codeInput.setAttribute("aria-invalid", "true");
      codeInput.setAttribute("aria-describedby", "code-error");
      codeInput.focus();
      return;
    }
    h.onJoin(code, name());
  });

  const actions = el(
    "div",
    { class: "row actions" },
    button(t("landing.create"), "btn btn-primary", () => h.onCreate(name()), {
      "data-testid": "create",
    }),
    button(
      t("landing.join"),
      "btn",
      () => {
        joinForm.hidden = false;
        codeInput.focus();
      },
      { "data-testid": "join" },
    ),
    button(t("landing.practice"), "btn btn-quiet", () => h.onPractice(name()), {
      "data-testid": "practice",
    }),
  );
  if (opts.code) joinForm.hidden = false;

  return el(
    "main",
    { class: "landing" },
    langToggle(h.onToggleLocale),
    el("p", { class: "marker marker-ours", "aria-hidden": "true" }, t("landing.ours")),
    el("h1", { class: "title" }, t("landing.title1"), el("br"), t("landing.title2")),
    el("p", { class: "marker marker-theirs", "aria-hidden": "true" }, t("landing.theirs")),
    el(
      "p",
      { class: "pitch" },
      ...withSlot(t("landing.pitch"), "command", el("code", {}, t("landing.command"))),
    ),
    el(
      "div",
      { class: "name-row" },
      el("label", { for: "player-name", class: "field-label" }, t("landing.nameLabel")),
      nameInput,
    ),
    actions,
    joinForm,
    opts.offline ? el("p", { class: "note", role: "status" }, t("landing.offline")) : el("span"),
    opts.closed ? el("p", { class: "note", role: "status" }, t("connection.closed")) : el("span"),
    el("div", { class: "facts" }, tags(), el("p", {}, t("landing.facts"))),
    el(
      "a",
      {
        class: "source",
        href: "https://github.com/allbdev/force-push",
        rel: "noopener",
        target: "_blank",
      },
      t("landing.source"),
    ),
  );
}

export type LobbyHandlers = {
  readonly onReady: (ready: boolean) => void;
  readonly onSettings: (mapId: string, minutes: number) => void;
  readonly onStart: () => void;
  readonly onLeave: () => void;
  readonly onCopyLink: () => void;
};

/** The host starts the sprint, so they always count as ready (board 2: "you · ready"). */
function isReady(lobby: LobbyView, seat: number): boolean {
  const s = lobby.seats[seat]!;
  return s.kind === "human" && !s.away && (s.ready || seat === lobby.host);
}

function seatState(lobby: LobbyView, seat: number): string {
  const s = lobby.seats[seat]!;
  if (s.kind === "empty" || s.kind === "bot") return t("lobby.botWaiting");
  if (s.away) return t("lobby.away");
  return isReady(lobby, seat) ? t("lobby.ready") : t("lobby.notReady");
}

function seatName(lobby: LobbyView, seat: number, me: number): string {
  const s = lobby.seats[seat]!;
  if (seat === me) return t("lobby.you");
  if (s.kind !== "human") return t("lobby.bot");
  return s.name || branchName(seat);
}

/** The status terminal's last line (board 2). */
export function lobbyStatus(lobby: LobbyView, me: number): string {
  const humans = lobby.seats
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.kind === "human" && !s.away);
  const ready = humans.filter(({ i }) => isReady(lobby, i)).length;
  const waiting = humans.find(({ i }) => !isReady(lobby, i));
  if (waiting)
    return t("lobby.statusWaiting", {
      ready,
      total: humans.length,
      name: seatName(lobby, waiting.i, me),
    });
  if (lobby.host !== me) return t("lobby.statusHost", { name: seatName(lobby, lobby.host, me) });
  return t("lobby.statusReady", { ready, total: humans.length });
}

export function renderLobby(
  lobby: LobbyView,
  me: number,
  h: LobbyHandlers,
  opts: { offline: boolean; copied: string },
): HTMLElement {
  const isHost = me === lobby.host;
  const seats = el(
    "ul",
    { class: "seats", "aria-label": t("lobby.kicker") },
    ...BRANCHES.map((b, seat) => {
      const state = seatState(lobby, seat);
      const name = seatName(lobby, seat, me);
      const ready = isReady(lobby, seat);
      return el(
        "li",
        {
          class: `panel seat seat-${b}`,
          "aria-label": t("lobby.seatLabel", { branch: b, name, state }),
          "data-testid": `seat-${seat}`,
        },
        el("div", { class: `seat-art seat-art-${b}`, "aria-hidden": "true" }),
        el("span", { class: `tag tag-${b}` }, b),
        el("span", { class: "seat-name" }, name),
        el("span", { class: ready ? "seat-state is-ready" : "seat-state" }, state),
      );
    }),
  );

  const map = mapById(lobby.mapId) ?? MAPS[0]!;
  const minuteButtons = RULES.sprintMinutes.map((m) =>
    button(
      t("lobby.minutes", { n: m }),
      m === lobby.minutes ? "btn btn-primary btn-small" : "btn btn-small",
      () => h.onSettings(lobby.mapId, m),
    ),
  );
  minuteButtons.forEach((b, k) => {
    b.setAttribute("aria-pressed", String(RULES.sprintMinutes[k] === lobby.minutes));
    if (!isHost) {
      b.disabled = true;
      b.title = t("lobby.hostOnly");
    }
  });
  const mapButtons = MAPS.map((m) =>
    button(
      t(`maps.${m.id}`),
      m.id === lobby.mapId ? "map-pick is-on" : "map-pick",
      () => h.onSettings(m.id, lobby.minutes),
      {
        "aria-pressed": String(m.id === lobby.mapId),
      },
    ),
  );
  if (!isHost) mapButtons.forEach((b) => (b.disabled = true));

  const branch = me >= 0 ? BRANCHES[me]! : "main";
  const terminal = el(
    "div",
    { class: "panel terminal", role: "status", "aria-live": "polite" },
    el("div", { class: "term-cmd" }, t("lobby.terminalCheckout", { branch })),
    el("div", {}, t("lobby.terminalSwitched", { branch })),
    el("div", { class: "term-cmd" }, t("lobby.terminalStatus")),
    el("div", { class: "term-ok", "data-testid": "lobby-status" }, lobbyStatus(lobby, me)),
  );

  const myReady = me >= 0 && lobby.seats[me]!.ready;
  const controls = el(
    "div",
    { class: "row lobby-actions" },
    isHost
      ? button(t("lobby.start"), "btn btn-primary btn-big", h.onStart, { "data-testid": "start" })
      : button(
          myReady ? t("lobby.notReadyButton") : t("lobby.readyButton"),
          "btn btn-primary btn-big",
          () => h.onReady(!myReady),
          {
            "data-testid": "ready",
            "aria-pressed": String(myReady),
          },
        ),
    button(t("lobby.leave"), "btn btn-danger", h.onLeave, { "data-testid": "leave" }),
    el("span", { class: "lobby-note" }, t("lobby.bots")),
  );

  return el(
    "main",
    { class: "lobby" },
    el(
      "div",
      { class: "lobby-head" },
      el("span", { class: "hud-label" }, t("lobby.kicker")),
      el(
        "div",
        { class: "row" },
        el(
          "span",
          { class: "lobby-code", "data-testid": "lobby-code" },
          opts.offline ? t("hud.offline") : lobby.code,
        ),
        opts.offline
          ? el("span")
          : button(t("lobby.copyLink"), "btn", h.onCopyLink, { "data-testid": "copy-link" }),
        el("span", { class: "copied", role: "status" }, opts.copied),
      ),
    ),
    el(
      "div",
      { class: "lobby-body" },
      seats,
      el(
        "div",
        { class: "lobby-side" },
        el(
          "div",
          { class: "panel lobby-settings" },
          el("span", { class: "hud-label" }, t("lobby.map")),
          el(
            "div",
            { class: "map-row" },
            el("div", { class: "map-thumb", "aria-hidden": "true" }),
            el(
              "div",
              {},
              el("div", { class: "map-name" }, t(`maps.${map.id}`)),
              el(
                "div",
                { class: "map-detail" },
                t("lobby.mapDetail", { w: map.width, h: map.height }),
              ),
            ),
          ),
          MAPS.length > 1 ? el("div", { class: "row map-picks" }, ...mapButtons) : el("span"),
          el("span", { class: "hud-label" }, t("lobby.sprint")),
          el("div", { class: "row" }, ...minuteButtons),
        ),
        terminal,
      ),
    ),
    controls,
  );
}

export type ResultHandlers = {
  readonly onRematch: () => void;
  readonly onChangeMap: () => void;
  readonly onShare: () => void;
};

export function renderResult(
  result: MatchResult,
  lobby: LobbyView | null,
  me: number,
  prNumber: number,
  h: ResultHandlers,
  opts: { shareText: string; copied: string; offline: boolean },
): HTMLElement {
  const winners = result.winners;
  const title =
    winners.length > 1
      ? el(
          "h1",
          { class: "result-title" },
          t("result.tie", { branches: winners.map(branchName).join(" + ") }),
        )
      : el(
          "h1",
          { class: "result-title" },
          ...withSlot(
            t("result.won", { branch: "{branch}" }),
            "branch",
            el("span", { class: `win-${BRANCHES[winners[0]!]}` }, branchName(winners[0]!)),
          ),
        );
  const rows = result.rows.map((r) => {
    const s = lobby?.seats[r.seat];
    const who =
      r.seat === me
        ? winners.includes(me)
          ? t("result.youMerged")
          : t("result.you")
        : s && s.kind === "human" && s.name
          ? s.name
          : s?.kind === "human"
            ? branchName(r.seat)
            : t("result.bot");
    return el(
      "tr",
      {},
      el("td", {}, el("span", { class: `tag tag-${BRANCHES[r.seat]}` }, branchName(r.seat))),
      el("td", { class: "who" }, who),
      el("td", { class: "plus" }, `+${r.plus}`),
      el("td", { class: "minus" }, `−${r.minus}`),
      el("td", { class: "final" }, `${r.share}%`),
    );
  });
  const bar = el(
    "div",
    {
      class: "territory-bar result-bar",
      role: "img",
      "aria-label": t("result.territory", {
        list: BRANCHES.map(
          (b, seat) => `${b} ${result.rows.find((r) => r.seat === seat)!.share}%`,
        ).join(", "),
      }),
    },
    ...BRANCHES.map((b, seat) => {
      const span = el("span", { class: `bar-${b}` });
      span.style.flexGrow = String(
        Math.max(0.0001, result.rows.find((r) => r.seat === seat)!.share),
      );
      return span;
    }),
  );
  const table = el(
    "table",
    { class: "diff" },
    el(
      "thead",
      {},
      el(
        "tr",
        {},
        ...["colBranch", "colWho", "colPainted", "colLost", "colFinal"].map((k) =>
          el("th", { scope: "col" }, t(`result.${k}`)),
        ),
      ),
    ),
    el("tbody", {}, ...rows),
  );

  const highlights = el(
    "div",
    { class: "panel highlights" },
    el("span", { class: "hud-label" }, t("result.highlights")),
    result.bestSeat >= 0
      ? el(
          "p",
          {},
          t("result.biggest", { branch: branchName(result.bestSeat), n: result.bestGain }),
        )
      : el("span"),
    el(
      "p",
      {},
      result.mostRevertedSeat >= 0
        ? t("result.mostReverted", {
            branch: branchName(result.mostRevertedSeat),
            n: result.mostReverted,
          })
        : t("result.neverReverted"),
    ),
    el("p", {}, t("result.legacy", { n: result.boxes })),
  );

  const isHost = !lobby || lobby.host === me;
  const humans = lobby ? lobby.seats.filter((s) => s.kind === "human" && !s.away).length : 1;
  const wanting = lobby ? lobby.rematch.filter(Boolean).length : 0;
  const rematchNote =
    lobby && humans > 1 && wanting > 0
      ? t("result.rematchWaiting", { n: wanting, total: humans }) +
        (isHost ? "" : ` ${t("result.rematchHost")}`)
      : "";

  const shareBox = el(
    "pre",
    {
      class: "panel share-line",
      "data-testid": "share",
      tabindex: "0",
      "aria-label": t("result.share"),
    },
    opts.shareText,
  );

  return el(
    "main",
    { class: "result", "aria-labelledby": "result-title" },
    el(
      "div",
      { class: "result-main" },
      el("p", { class: "result-pr" }, t("result.pr", { n: prNumber })),
      Object.assign(title, { id: "result-title" }),
      el("div", { class: "panel diff-panel" }, table, bar),
      el(
        "div",
        { class: "row" },
        me >= 0
          ? button(t("result.rematch"), "btn btn-primary", h.onRematch, {
              "data-testid": "rematch",
            })
          : el("span"),
        isHost && !opts.offline
          ? button(t("result.changeMap"), "btn", h.onChangeMap, { "data-testid": "change-map" })
          : el("span"),
        button(t("result.share"), "btn", h.onShare, { "data-testid": "share-button" }),
      ),
      el("p", { class: "copied", role: "status" }, opts.copied || rematchNote),
    ),
    el("div", { class: "result-side" }, shareBox, highlights),
  );
}

export function renderMenu(
  onResume: () => void,
  onLeave: () => void,
  onToggleLocale: () => void,
): HTMLElement {
  const resume = button(t("menu.resume"), "btn btn-primary", onResume, { "data-testid": "resume" });
  const dialog = el(
    "div",
    { class: "menu", role: "dialog", "aria-modal": "true", "aria-labelledby": "menu-title" },
    el(
      "div",
      { class: "panel menu-box" },
      el("h2", { id: "menu-title" }, t("menu.title")),
      el("p", { class: "note" }, t("menu.note")),
      resume,
      button(t("menu.leave"), "btn btn-danger", onLeave, { "data-testid": "menu-leave" }),
      langToggle(onToggleLocale),
    ),
  );
  queueMicrotask(() => resume.focus());
  return dialog;
}

/** The locale-aware PR number shown on the result: the room's four digits. */
export function prNumberFor(code: string | null, seed: number): number {
  const m = code ? /(\d{4})$/.exec(code) : null;
  return m ? Number(m[1]) : (seed >>> 0) % 10_000;
}

void getLocale;

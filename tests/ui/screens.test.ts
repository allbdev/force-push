// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type { LobbyView } from "../../src/core/protocol";
import { scoreMatch } from "../../src/core/score";
import { createMatch } from "../../src/core/state";
import { mapById } from "../../src/content/maps";
import { setLocale } from "../../src/ui/i18n";
import {
  lobbyStatus,
  prNumberFor,
  renderLanding,
  renderLobby,
  renderResult,
} from "../../src/ui/screens";

const landing = (over: Partial<Parameters<typeof renderLanding>[0]> = {}) => ({
  onCreate: vi.fn(),
  onJoin: vi.fn(),
  onPractice: vi.fn(),
  onToggleLocale: vi.fn(),
  ...over,
});

function lobby(over: Partial<LobbyView> = {}): LobbyView {
  return {
    code: "FRI-1758",
    phase: "lobby",
    seats: [
      { kind: "human", name: "Vini", ready: true, away: false },
      { kind: "human", name: "Bia", ready: true, away: false },
      { kind: "human", name: "Rafa", ready: false, away: false },
      { kind: "empty", name: "", ready: false, away: false },
    ],
    host: 0,
    mapId: "open-space",
    minutes: 3,
    rematch: [false, false, false, false],
    ...over,
  };
}

const buttonsHaveNames = (root: HTMLElement) => {
  for (const b of root.querySelectorAll("button"))
    expect(
      (b.getAttribute("aria-label") ?? b.textContent ?? "").trim().length,
      b.outerHTML,
    ).toBeGreaterThan(0);
};

describe("landing (board 1)", () => {
  it("has create, join and practice buttons with labels, in that focus order", () => {
    setLocale("en");
    const root = renderLanding(landing(), { name: "", offline: false, code: null });
    buttonsHaveNames(root);
    const order = [...root.querySelectorAll<HTMLElement>("button, input, a")].map(
      (n) => n.dataset.testid ?? n.tagName,
    );
    expect(order.indexOf("name")).toBeLessThan(order.indexOf("create"));
    expect(order.indexOf("create")).toBeLessThan(order.indexOf("join"));
    expect(root.querySelector("label[for=player-name]")).not.toBeNull();
  });

  it("rejects a bad room code with a message and accepts a good one", () => {
    const h = landing();
    const root = renderLanding(h, { name: "Ana", offline: false, code: null });
    document.body.append(root);
    (root.querySelector("[data-testid=join]") as HTMLButtonElement).click();
    const input = root.querySelector<HTMLInputElement>("[data-testid=code]")!;
    const form = root.querySelector("form")!;
    input.value = "<b>x";
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    expect(h.onJoin).not.toHaveBeenCalled();
    expect(root.querySelector("[role=alert]")!.textContent).toContain("FRI-1758");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    input.value = "fri1758";
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    expect(h.onJoin).toHaveBeenCalledWith("FRI-1758", "Ana");
    root.remove();
  });

  it("opens the join form when a link carries a room code", () => {
    const root = renderLanding(landing(), { name: "", offline: false, code: "FRI-1758" });
    expect(root.querySelector("form")!.hidden).toBe(false);
    expect(root.querySelector<HTMLInputElement>("[data-testid=code]")!.value).toBe("FRI-1758");
  });

  it("names never go in as markup", () => {
    const root = renderLanding(landing(), {
      name: "<img src=x onerror=alert(1)>",
      offline: false,
      code: null,
    });
    expect(root.querySelector("img")).toBeNull();
  });
});

describe("lobby (board 2)", () => {
  it("reads the status like the board's terminal", () => {
    setLocale("pt-BR");
    expect(lobbyStatus(lobby(), 0)).toBe("2 de 3 prontos. Aguardando Rafa.");
    setLocale("en");
    expect(lobbyStatus(lobby(), 0)).toBe("2 of 3 ready. Waiting for Rafa.");
  });

  it("shows four seats with branch, name and state, and start for the host", () => {
    const h = {
      onReady: vi.fn(),
      onSettings: vi.fn(),
      onStart: vi.fn(),
      onLeave: vi.fn(),
      onCopyLink: vi.fn(),
    };
    const root = renderLobby(lobby(), 0, h, { offline: false, copied: "" });
    buttonsHaveNames(root);
    const seats = root.querySelectorAll("[data-testid^=seat-]");
    expect(seats).toHaveLength(4);
    expect(seats[0]!.getAttribute("aria-label")).toBe("main: you, ready");
    expect(seats[3]!.textContent).toContain("joins if nobody comes");
    (root.querySelector("[data-testid=start]") as HTMLButtonElement).click();
    expect(h.onStart).toHaveBeenCalled();
    expect(root.querySelector("[data-testid=lobby-code]")!.textContent).toBe("FRI-1758");
  });

  it("guests get a ready toggle and can't change the settings", () => {
    const h = {
      onReady: vi.fn(),
      onSettings: vi.fn(),
      onStart: vi.fn(),
      onLeave: vi.fn(),
      onCopyLink: vi.fn(),
    };
    const root = renderLobby(lobby(), 2, h, { offline: false, copied: "" });
    expect(root.querySelector("[data-testid=start]")).toBeNull();
    (root.querySelector("[data-testid=ready]") as HTMLButtonElement).click();
    expect(h.onReady).toHaveBeenCalledWith(true);
    for (const b of root.querySelectorAll<HTMLButtonElement>(".lobby-settings button"))
      expect(b.disabled).toBe(true);
  });
});

describe("result (board 7)", () => {
  it("lists every branch with its diff and share, winner first", () => {
    setLocale("en");
    const s = createMatch({ map: mapById("open-space")!, seed: 1, ticks: 10 });
    for (let i = 0; i < 20; i++) s.owner[i * 2] = i < 12 ? 1 : 4;
    s.plus = [15, 0, 0, 9];
    s.minus = [3, 0, 0, 1];
    const result = scoreMatch(s);
    const root = renderResult(
      result,
      lobby(),
      0,
      1758,
      { onRematch: vi.fn(), onChangeMap: vi.fn(), onShare: vi.fn() },
      {
        shareText: "Force Push · room FRI-1758",
        copied: "",
        offline: false,
      },
    );
    buttonsHaveNames(root);
    expect(root.querySelector(".result-pr")!.textContent).toBe("Pull request #1758 · merged");
    expect(root.querySelector("h1")!.textContent).toBe("main won the sprint");
    const first = root.querySelector("tbody tr")!;
    expect(first.textContent).toContain("+15");
    expect(first.textContent).toContain("−3");
    expect(first.textContent).toContain("60%");
    expect(first.textContent).toContain("you · merged");
    expect(root.querySelector("[data-testid=share]")!.textContent).toContain("FRI-1758");
  });

  it("uses the room's digits for the PR number", () => {
    expect(prNumberFor("FRI-1758", 99)).toBe(1758);
    expect(prNumberFor(null, 123456)).toBe(3456);
  });
});

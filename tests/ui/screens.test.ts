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
  showPortraits,
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
      { kind: "human", name: "Vini", ready: false, away: false },
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
      onPickMap: vi.fn(),
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
      onPickMap: vi.fn(),
    };
    const root = renderLobby(lobby(), 2, h, { offline: false, copied: "" });
    expect(root.querySelector("[data-testid=start]")).toBeNull();
    (root.querySelector("[data-testid=ready]") as HTMLButtonElement).click();
    expect(h.onReady).toHaveBeenCalledWith(true);
    for (const b of root.querySelectorAll<HTMLButtonElement>(".lobby-settings button"))
      expect(b.disabled).toBe(true);
  });
});

describe("seat portraits (board 2)", () => {
  const handlers = () => ({
    onReady: vi.fn(),
    onSettings: vi.fn(),
    onStart: vi.fn(),
    onLeave: vi.fn(),
    onCopyLink: vi.fn(),
    onPickMap: vi.fn(),
  });
  const png = (n: number) => `data:image/png;base64,AAAA${n}`;
  const four = [png(0), png(1), png(2), png(3)];

  it("keeps the placeholder figure until the portraits are rendered", () => {
    const root = renderLobby(lobby(), 0, handlers(), { offline: false, copied: "" });
    expect(root.querySelectorAll(".seat-art")).toHaveLength(4);
    expect(root.querySelectorAll(".seat-art img")).toHaveLength(0);
    expect(root.querySelectorAll(".has-portrait")).toHaveLength(0);
    const none = renderLobby(lobby(), 0, handlers(), {
      offline: false,
      copied: "",
      portraits: null,
    });
    expect(none.querySelectorAll(".seat-art img")).toHaveLength(0);
  });

  it("shows each seat's portrait as a decorative image, in seat order", () => {
    const root = renderLobby(lobby(), 0, handlers(), {
      offline: false,
      copied: "",
      portraits: four,
    });
    const images = [...root.querySelectorAll<HTMLImageElement>(".seat-art img")];
    expect(images.map((img) => img.getAttribute("src"))).toEqual(four);
    for (const img of images) {
      expect(img.getAttribute("alt")).toBe("");
      expect(img.parentElement!.classList.contains("has-portrait")).toBe(true);
      expect(img.parentElement!.getAttribute("aria-hidden")).toBe("true");
    }
    expect(root.querySelector(".seat-art-hotfix img")!.getAttribute("src")).toBe(png(2));
    // The seat is still named by its label, not by the picture.
    expect(root.querySelector("[data-testid=seat-0]")!.getAttribute("aria-label")).toBe(
      "main: you, ready",
    );
  });

  it("fills a lobby that is already on screen, once", () => {
    const root = renderLobby(lobby(), 0, handlers(), { offline: false, copied: "" });
    showPortraits(root, four);
    showPortraits(root, four);
    expect(root.querySelectorAll(".seat-art img")).toHaveLength(4);
  });

  it("only takes pictures we rendered: PNG data URLs and blob URLs", () => {
    const root = renderLobby(lobby(), 0, handlers(), { offline: false, copied: "" });
    showPortraits(root, [
      "https://example.com/tracker.png",
      "javascript:alert(1)",
      "blob:http://localhost/1b2c",
      "data:text/html;base64,AAAA",
    ]);
    const images = [...root.querySelectorAll<HTMLImageElement>(".seat-art img")];
    expect(images.map((img) => img.getAttribute("src"))).toEqual(["blob:http://localhost/1b2c"]);
    expect(root.querySelectorAll(".has-portrait")).toHaveLength(1);
    // A short list leaves the other seats alone.
    const other = renderLobby(lobby(), 0, handlers(), { offline: false, copied: "" });
    showPortraits(other, [png(0)]);
    expect(other.querySelectorAll(".seat-art img")).toHaveLength(1);
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

describe("map select (board 8)", () => {
  it("shows the three maps and the map of the day, and picks one", async () => {
    const { renderMapSelect } = await import("../../src/ui/screens");
    setLocale("en");
    const onPick = vi.fn();
    const onBack = vi.fn();
    const root = renderMapSelect("open-space", onPick, onBack);
    const cards = root.querySelectorAll(".map-card");
    expect(cards).toHaveLength(3);
    expect(cards[0]!.getAttribute("aria-pressed")).toBe("true");
    expect(cards[0]!.textContent).toContain("selected");
    expect(cards[2]!.textContent).toContain("Rooftop Happy Hour");
    (root.querySelector("[data-testid=map-data-center]") as HTMLButtonElement).click();
    expect(onPick).toHaveBeenCalledWith("data-center");
    (root.querySelector("[data-testid=map-daily]") as HTMLButtonElement).click();
    expect(onPick.mock.calls[1]![0]).toMatch(/^daily-\d{8}$/);
    (root.querySelector("[data-testid=map-back]") as HTMLButtonElement).click();
    expect(onBack).toHaveBeenCalled();
  });
});

describe("menu and highlight", () => {
  it("the menu is a labelled modal dialog that focuses 'back to the sprint'", async () => {
    const { renderMenu } = await import("../../src/ui/screens");
    setLocale("en");
    const onResume = vi.fn();
    const root = renderMenu(onResume, vi.fn(), vi.fn());
    document.body.append(root);
    await Promise.resolve();
    expect(root.getAttribute("role")).toBe("dialog");
    expect(root.getAttribute("aria-modal")).toBe("true");
    expect(document.getElementById(root.getAttribute("aria-labelledby")!)!.textContent).toBe(
      "Menu",
    );
    expect(document.activeElement?.textContent).toBe("Back to the sprint");
    buttonsHaveNames(root);
    root.remove();
  });

  it("the highlight overlay lists the push's diff per branch (board 4)", async () => {
    const { renderHighlight } = await import("../../src/ui/screens");
    setLocale("pt-BR");
    const root = renderHighlight({ seat: 3, gained: 9, lost: [0, 5, 0, 0], boxes: 1 }, vi.fn());
    const text = root.textContent!;
    expect(text).toContain("$ git push --force origin dev");
    expect(text).toContain("+ 9 tiles    dev");
    expect(text).toContain("− 5 tiles    feature");
    expect(text).toContain("legado/NÃO_MEXER");
    expect(text).toContain("A câmera só aproxima");
    buttonsHaveNames(root);
    setLocale("en");
  });
});

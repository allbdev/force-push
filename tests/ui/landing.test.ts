// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderLanding } from "../../src/ui/landing";
import { setLocale } from "../../src/ui/i18n";
import { withSlot } from "../../src/ui/dom";

describe("landing (placeholder)", () => {
  it("shows the title frame, pitch, branch tags and a labelled toggle", () => {
    setLocale("en");
    const root = renderLanding(() => {});
    expect(root.querySelector("h1")!.textContent).toBe("ForcePush");
    expect(root.querySelector(".pitch code")!.textContent).toBe("git push --force");
    expect(root.querySelector(".pitch")!.textContent).not.toContain("{command}");
    expect([...root.querySelectorAll(".tag")].map((n) => n.textContent)).toEqual([
      "main",
      "feature",
      "hotfix",
      "dev",
    ]);
    const toggle = root.querySelector<HTMLButtonElement>("button.lang")!;
    expect(toggle.getAttribute("aria-label")).toBe("Mudar para português");
    expect(toggle.type).toBe("button");
  });

  it("is drawn in Portuguese when the locale is pt-BR", () => {
    setLocale("pt-BR");
    const root = renderLanding(() => {});
    expect(root.querySelector(".pitch")!.textContent).toContain("Guerra de território");
    expect(root.querySelector("button.lang")!.getAttribute("aria-label")).toBe("Switch to English");
    setLocale("en");
  });

  it("calls back when the toggle is pressed", () => {
    const onToggle = vi.fn();
    renderLanding(onToggle).querySelector<HTMLButtonElement>("button.lang")!.click();
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("puts a slot node into a sentence as text, never as markup", () => {
    const parts = withSlot("<b>{x}</b>", "x", document.createElement("code"));
    expect(parts[0]).toBe("<b>");
    expect(withSlot("no slot", "x", document.createElement("i"))).toEqual(["no slot"]);
  });
});

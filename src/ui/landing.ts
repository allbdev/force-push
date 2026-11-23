import { el, withSlot } from "./dom";
import { t } from "./i18n";
import { BRANCHES } from "../content/branches";

export const SOURCE_URL = "https://github.com/allbdev/force-push";

/**
 * The placeholder landing for Phase 0: the title frame from board 1, the pitch, the branch tags
 * and the language toggle. The real landing (board 1, with create room / join) is roadmap task 25.
 */
export function renderLanding(onToggleLocale: () => void): HTMLElement {
  const toggle = el(
    "button",
    { class: "lang", type: "button", "aria-label": t("lang.switchTo"), "data-testid": "lang" },
    t("lang.short"),
  );
  toggle.addEventListener("click", onToggleLocale);

  const tags = el(
    "ul",
    { class: "tags" },
    ...BRANCHES.map((b) => el("li", { class: `tag tag-${b}` }, b)),
  );

  return el(
    "main",
    { class: "landing" },
    toggle,
    el("p", { class: "marker marker-ours", "aria-hidden": "true" }, t("landing.ours")),
    el("h1", { class: "title" }, t("landing.title1"), el("br"), t("landing.title2")),
    el("p", { class: "marker marker-theirs", "aria-hidden": "true" }, t("landing.theirs")),
    el(
      "p",
      { class: "pitch" },
      ...withSlot(t("landing.pitch"), "command", el("code", {}, t("landing.command"))),
    ),
    el("p", { class: "soon", "data-testid": "soon" }, t("landing.soon")),
    el("div", { class: "facts" }, tags, el("p", {}, t("landing.facts"))),
    el(
      "a",
      { class: "source", href: SOURCE_URL, rel: "noopener", target: "_blank" },
      t("landing.source"),
    ),
  );
}

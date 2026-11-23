/**
 * Touch controls for phones (board "Phone layouts"): a four-way stick on the left, the push -f
 * button on the right, both at least 48 px. Pointer events, so a mouse can test them too.
 */
import { el } from "./dom";
import { t } from "./i18n";
import { stickBits, type InputState } from "./input";

export function hasTouch(): boolean {
  return globalThis.matchMedia?.("(pointer: coarse)").matches ?? false;
}

export function buildTouchControls(input: InputState): HTMLElement {
  const knob = el("div", { class: "stick-knob" });
  const stick = el("div", { class: "stick", role: "group", "aria-label": t("touch.stick") }, knob);
  let pointer = -1;
  let cx = 0;
  let cy = 0;
  const move = (e: PointerEvent) => {
    const r = stick.getBoundingClientRect();
    const radius = r.width / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, radius / len);
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    input.setStick(stickBits(dx, dy, radius));
  };
  stick.addEventListener("pointerdown", (e) => {
    pointer = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    const r = stick.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    move(e);
    e.preventDefault();
  });
  stick.addEventListener("pointermove", (e) => {
    if (e.pointerId === pointer) move(e);
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== pointer) return;
    pointer = -1;
    knob.style.transform = "";
    input.setStick(0);
  };
  stick.addEventListener("pointerup", end);
  stick.addEventListener("pointercancel", end);

  const push = el(
    "button",
    { type: "button", class: "push-button", "data-testid": "push-button" },
    t("touch.push"),
  );
  push.addEventListener("pointerdown", (e) => {
    input.setTouchPush(true);
    e.preventDefault();
  });
  const release = () => input.setTouchPush(false);
  push.addEventListener("pointerup", release);
  push.addEventListener("pointercancel", release);
  push.addEventListener("pointerleave", release);
  push.addEventListener("contextmenu", (e) => e.preventDefault());

  return el("div", { class: "touch" }, stick, push);
}

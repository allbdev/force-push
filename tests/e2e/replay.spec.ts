import { expect, test } from "@playwright/test";
import { botInput } from "../../src/core/bot";
import { encodeReplay, replayState, type Replay } from "../../src/core/replay";
import { createMatch, hashState, SIM_VERSION } from "../../src/core/state";
import { stepInPlace } from "../../src/core/step";
import { mapById } from "../../src/content/maps";
import { open } from "./helpers";

/** A recorded 3-minute bot match on the windy map, with the code freeze. */
function recorded(): string {
  const s = createMatch({ map: mapById("rooftop")!, seed: 1758, ticks: 3600, freeze: true });
  const log: number[] = [];
  while (!s.ended) {
    const inputs = [0, 1, 2, 3].map((seat) => botInput(s, seat));
    log.push(...inputs);
    stepInPlace(s, inputs);
  }
  const r: Replay = {
    version: SIM_VERSION,
    seed: 1758,
    mapId: "rooftop",
    ticks: 3600,
    freeze: true,
    closed: 0,
    inputs: Uint8Array.from(log),
  };
  return encodeReplay(r);
}

test("every browser ends a recorded match in the same state as Node", async ({ page }) => {
  const text = recorded();
  const { decodeReplay } = await import("../../src/core/replay");
  const node = hashState(replayState(decodeReplay(text)!));
  await open(page, "/?test=1");
  const browser = await page.evaluate(
    (t) => (window as unknown as { __mc: { replayHash(t: string): number } }).__mc.replayHash(t),
    text,
  );
  expect(browser).toBe(node);
});

test("a replay link plays the match and ends on the result", async ({ page }) => {
  const errors = await open(page, `/?test=1&speed=20&replay=${recorded()}`);
  await expect(page.getByTestId("timer")).toBeVisible();
  await expect(page.locator(".result-title")).toBeVisible({ timeout: 60_000 });
  expect(errors).toEqual([]);
});

test("a broken replay link lands on the landing page with a message", async ({ page }) => {
  await open(page, "/?replay=not-a-replay");
  await expect(page.getByRole("status").filter({ hasText: "replay" })).toBeVisible();
});

test("after a match, the biggest push plays again with the close camera and comes back", async ({
  page,
}) => {
  const errors = await open(page, "/?offline=1&test=1&seed=5&minutes=2&speed=20");
  await expect(page.locator(".result-title")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("watch-highlight").click();
  await expect(page.getByTestId("highlight")).toBeVisible();
  await expect(page.getByTestId("highlight")).toContainText("$ git push --force origin");
  await expect(page.locator(".result-title")).toBeVisible({ timeout: 30_000 });
  expect(errors).toEqual([]);
});

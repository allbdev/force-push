import { expect, test, type Page } from "@playwright/test";
import { open } from "./helpers";

/** Waits for the landing's 3D scene; false where the browser has no WebGL to give. */
async function heroShown(page: Page): Promise<boolean> {
  try {
    await page.locator("canvas.hero.is-ready").waitFor({ state: "visible", timeout: 8_000 });
    return true;
  } catch {
    return false;
  }
}

test("the landing's hero scene sits behind the text and never gets in its way", async ({
  page,
}) => {
  const errors = await open(page, "/");
  // The text and the buttons don't wait for three.js.
  await expect(page.locator("h1")).toContainText("Force");
  await expect(page.getByTestId("create")).toBeVisible();
  await expect(page.getByTestId("code")).toBeHidden();
  if (await heroShown(page)) {
    const hero = page.locator("canvas.hero");
    await expect(hero).toHaveCount(1);
    await expect(hero).toHaveAttribute("aria-hidden", "true");
    await expect(hero).toHaveCSS("pointer-events", "none");
  }
  // The scene belongs to the landing: it goes away with it.
  await page.getByTestId("practice").click();
  await expect(page.locator("canvas.hero")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the hero is a still picture under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = await open(page, "/");
  test.skip(!(await heroShown(page)), "no WebGL in this browser");
  const hero = page.locator("canvas.hero");
  const first = await hero.screenshot();
  await page.waitForTimeout(700);
  const second = await hero.screenshot();
  expect(second.equals(first)).toBe(true);
  expect(errors).toEqual([]);
});

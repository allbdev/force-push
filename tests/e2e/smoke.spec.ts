import { expect, test } from "@playwright/test";
import { open, type Hooks } from "./helpers";

test("the landing loads with the title, the buttons and no errors", async ({ page }) => {
  const errors = await open(page, "/");
  await expect(page).toHaveTitle(/Force Push/);
  await expect(page.locator("h1")).toContainText("Force");
  await expect(page.getByTestId("create")).toBeVisible();
  await expect(page.getByTestId("practice")).toBeVisible();
  // The room-code form stays folded away until "join with a code" is pressed.
  await expect(page.getByTestId("code")).toBeHidden();
  expect(errors).toEqual([]);
});

test("the language toggle switches to Portuguese and is remembered", async ({ page }) => {
  await open(page, "/");
  await page.getByRole("button", { name: "Mudar para português" }).click();
  await expect(page.locator(".pitch")).toContainText("Guerra de território");
  await expect(page.getByTestId("create")).toHaveText("Criar sala");
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expect(page.getByRole("button", { name: "Switch to English" })).toBeFocused();
  await page.reload();
  await expect(page.locator(".pitch")).toContainText("Guerra de território");
});

test("a bad room code is refused with a message", async ({ page }) => {
  await open(page, "/");
  await page.getByTestId("join").click();
  await page.getByTestId("code").fill("nope");
  await page.getByTestId("join-go").click();
  await expect(page.getByRole("alert")).toContainText("FRI-1758");
});

test("an offline match against bots: walk, push, HUD, and a 2-minute sprint to the result", async ({
  page,
}) => {
  const errors = await open(page, "/?offline=1&test=1&seed=1758&minutes=2&speed=20");
  await expect(page.getByTestId("timer")).toBeVisible();
  await expect(page.getByTestId("room-code")).toHaveText("offline");
  const before = await page.evaluate(() => (window as unknown as Hooks).__mc.state()!.players[0]);
  // Walk right two tiles, then drop a push.
  await page.evaluate(() => (window as unknown as Hooks).__mc.play([...Array(10).fill(2), 16, 0]));
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Hooks).__mc.state()!.players[0]!.x), {
      timeout: 10_000,
    })
    .toBeGreaterThan(before!.x);
  await expect(page.getByTestId("result-title").or(page.locator(".result-title"))).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByTestId("share")).toContainText("Force Push");
  await expect(page.getByTestId("rematch")).toBeVisible();
  await page.getByTestId("rematch").click();
  await expect(page.getByTestId("timer")).toBeVisible();
  expect(errors).toEqual([]);
});

test("watching an all-bot match", async ({ page }) => {
  const errors = await open(page, "/?offline=1&test=1&bots=4&seed=3&speed=10");
  await expect(page.getByTestId("timer")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as Hooks).__mc.seat())).toBe(-1);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Hooks).__mc.state()!.tick), {
      timeout: 10_000,
    })
    .toBeGreaterThan(100);
  expect(errors).toEqual([]);
});

test("the menu opens with Esc, traps nothing, and closes with Esc", async ({ page }) => {
  await open(page, "/?offline=1&test=1&seed=2");
  await expect(page.getByTestId("timer")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByTestId("resume")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("prefers-reduced-motion turns the transitions off", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "/?offline=1&test=1&seed=2");
  await expect(page.getByTestId("timer")).toBeVisible();
  const transition = await page
    .locator(".territory-bar span")
    .first()
    .evaluate((n) => getComputedStyle(n).transitionDuration);
  expect(transition).toBe("0s");
});

test("the landing can be used with the keyboard alone", async ({ page, browserName }) => {
  // WebKit on macOS only tabs to buttons with Option+Tab (a system setting), not plain Tab.
  test.skip(browserName === "webkit", "WebKit tabs to buttons only with Option+Tab on macOS");
  await open(page, "/");
  await page.keyboard.press("Tab");
  const order: string[] = [];
  for (let k = 0; k < 6; k++) {
    order.push(
      await page.evaluate(
        () =>
          document.activeElement?.getAttribute("data-testid") ??
          document.activeElement?.tagName ??
          "",
      ),
    );
    await page.keyboard.press("Tab");
  }
  expect(order).toEqual(expect.arrayContaining(["lang", "name", "create", "join", "practice"]));
});

test("link previews have a title, a description in both languages and the image", async ({
  page,
  request,
}) => {
  await open(page, "/");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /og\.jpg$/);
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    "content",
    /turf war.*Guerra de território/,
  );
  await expect(page.locator('meta[property="og:locale:alternate"]')).toHaveAttribute(
    "content",
    "pt_BR",
  );
  const img = await request.get("/og.jpg");
  expect(img.status()).toBe(200);
  expect(img.headers()["content-type"]).toContain("image/jpeg");
});

import { expect, test, type Page } from "@playwright/test";
import { open, type Hooks } from "./helpers";

/** Runs against `wrangler dev` (the real Worker and Durable Object), see playwright.config.ts. */
test.describe.configure({ mode: "serial" });

const hooks = (page: Page) =>
  page.evaluate(() => {
    const h = (window as unknown as Hooks & { __mc: { hash(): number } }).__mc;
    const s = h.state();
    return {
      tick: s?.tick ?? -1,
      ended: s?.ended ?? false,
      hash: h.hash(),
      seat: h.seat(),
      screen: h.screen(),
    };
  });

test("two players and two bots play a whole sprint through the server and agree on the result", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const a = await browser.newPage();
  const b = await browser.newPage();
  // Pages opened on the browser outlive the test: close them, or they keep drawing the result
  // screen and starve the next test on a two-core CI runner.
  try {
    const errors = [...(await open(a, "/?test=1")), ...(await open(b, "/?test=1"))];

    await a.getByTestId("name").fill("Ana");
    await a.getByTestId("create").click();
    const code = (await a.getByTestId("lobby-code").textContent())!.trim();
    expect(code).toMatch(/^[A-Z]{3}-\d{4}$/);
    await expect(a).toHaveURL(new RegExp(`room=${code}`));

    // The second player opens the link: the join form is filled in.
    await b.goto(`/?test=1&room=${code}`);
    await b.getByTestId("name").fill("Bia");
    await b.getByTestId("join-go").click();
    await expect(b.getByTestId("seat-1")).toContainText("you");
    await expect(a.getByTestId("seat-1")).toContainText("Bia");

    // Ready, 2-minute sprint, start.
    await b.getByTestId("ready").click();
    await expect(a.getByTestId("lobby-status")).toContainText("2 of 2 ready");
    await a.getByRole("button", { name: "2 min" }).click();
    await a.getByTestId("start").click();
    await expect(a.getByTestId("timer")).toBeVisible();
    await expect(b.getByTestId("timer")).toBeVisible();
    await expect(b.getByTestId("room-code")).toHaveText(code);

    // Both walk and drop pushes.
    await a.evaluate(() =>
      (window as unknown as Hooks).__mc.play([...Array(10).fill(2), 16, 0, ...Array(10).fill(4)]),
    );
    await b.evaluate(() =>
      (window as unknown as Hooks).__mc.play([...Array(10).fill(8), 16, 0, ...Array(10).fill(4)]),
    );

    await expect(a.locator(".result-title")).toBeVisible({ timeout: 200_000 });
    await expect(b.locator(".result-title")).toBeVisible({ timeout: 20_000 });
    const [ha, hb] = [await hooks(a), await hooks(b)];
    expect(ha.ended && hb.ended).toBe(true);
    expect(ha.hash).toBe(hb.hash);
    expect(await a.locator(".result-title").textContent()).toBe(
      await b.locator(".result-title").textContent(),
    );
    // Same numbers on both screens (each sees themselves as "you", so names differ).
    const numbers = (page: Page) =>
      page.locator(".diff td.plus, .diff td.minus, .diff td.final").allTextContents();
    expect(await numbers(a)).toEqual(await numbers(b));
    expect(errors).toEqual([]);
  } finally {
    await a.close();
    await b.close();
  }
});

test("a room code that doesn't exist sends you back with a message", async ({ page }) => {
  await open(page, "/?test=1&room=ZZZ-0000");
  await page.getByTestId("join-go").click();
  await expect(page.getByRole("status").filter({ hasText: "closed" })).toBeVisible({
    timeout: 15_000,
  });
});

test("the server refuses a page from another site", async ({ request }) => {
  const res = await request.post("/api/room", { headers: { origin: "https://evil.example" } });
  expect(res.status()).toBe(403);
});

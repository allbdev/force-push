import { expect, test } from "@playwright/test";
import { open } from "./helpers";

test("the page loads with the title and no errors", async ({ page }) => {
  const errors = await open(page, "/");
  await expect(page).toHaveTitle(/Force Push/);
  await expect(page.locator("h1")).toContainText("Force");
  expect(errors).toEqual([]);
});

test("the language toggle switches to Portuguese and is remembered", async ({ page }) => {
  await open(page, "/");
  await page.getByRole("button", { name: "Mudar para português" }).click();
  await expect(page.locator(".pitch")).toContainText("Guerra de território");
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expect(page.getByRole("button", { name: "Switch to English" })).toBeFocused();
  await page.reload();
  await expect(page.locator(".pitch")).toContainText("Guerra de território");
});

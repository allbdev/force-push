import type { Page } from "@playwright/test";

/** Opens a page and collects uncaught errors, so every test can assert there were none. */
export async function open(page: Page, url: string): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(url);
  return errors;
}

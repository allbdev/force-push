import type { Page } from "@playwright/test";

/** Opens a page and collects uncaught errors, so every test can assert there were none. */
export async function open(page: Page, url: string): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(url);
  if (url.includes("test=1")) await page.waitForFunction(() => "__mc" in window);
  return errors;
}

export type Hooks = {
  __mc: {
    play(inputs: number[]): void;
    state(): {
      tick: number;
      ended: boolean;
      players: { x: number; y: number; out: number }[];
      pushes: unknown[];
    } | null;
    paused: boolean;
    seat(): number;
    screen(): string;
  };
};

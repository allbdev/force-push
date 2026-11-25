/**
 * `npm run designs`: captures every screen board from the real game (roadmap task 52) with a fixed
 * seed, fixed inputs and a fixed tick, at board size, in both locales:
 *   design-captures/en/NN-Name.png and design-captures/pt-BR/NN-Name.png (+ .jpg on macOS, via sips)
 * `npm run designs -- 02b` captures only the shots whose name contains "02b".
 * Then: compare with the canvas, and only replace a mockup with a capture that's at least as good
 * (CLAUDE.md, "no downgrades").
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { chromium, type Page } from "@playwright/test";

const PORT = 4176;
const BASE = `http://localhost:${PORT}`;
const OUT = "design-captures";
const LOCALES = ["en", "pt-BR"] as const;

type Hooks = {
  __mc: {
    play(i: number[]): void;
    state(): { tick: number; endTick: number; ended: boolean } | null;
    paused: boolean;
    screen(): string;
  };
};

async function untilTick(page: Page, tick: number): Promise<void> {
  await page.waitForFunction(
    (t) => ((window as unknown as Hooks).__mc.state()?.tick ?? 0) >= t,
    tick,
    { timeout: 120_000 },
  );
  await page.evaluate(() => ((window as unknown as Hooks).__mc.paused = true));
  await page.waitForTimeout(500);
}

async function setLocale(page: Page, locale: string): Promise<void> {
  await page.addInitScript((l) => localStorage.setItem("force-push:locale", l), locale);
}

const DESKTOP = { width: 1280, height: 720 };
const PHONE = { width: 390, height: 844 };

type Shot = { name: string; viewport: typeof DESKTOP; run: (page: Page) => Promise<void> };

const SHOTS: Shot[] = [
  {
    name: "01-Main",
    viewport: DESKTOP,
    run: async (p) => {
      await p.goto(`${BASE}/?test=1`);
      await p.waitForTimeout(2500);
    },
  },
  {
    name: "02-Lobby",
    viewport: DESKTOP,
    run: async (p) => {
      await p.goto(`${BASE}/?test=1`);
      await p.getByTestId("create").click();
      await p.waitForTimeout(2500);
    },
  },
  {
    name: "02b-Lobby-1v1",
    viewport: DESKTOP,
    run: async (p) => {
      // The offline lobby set up for a 1v1: hotfix and dev closed, one bot on feature.
      await p.goto(`${BASE}/?test=1`);
      await p.getByTestId("practice").click();
      await p.getByTestId("switch-2-closed").click();
      await p.getByTestId("switch-3-closed").click();
      await p.waitForTimeout(2500);
    },
  },
  {
    name: "03-Match",
    viewport: DESKTOP,
    run: async (p) => {
      await p.goto(`${BASE}/?offline=1&test=1&seed=1758&speed=6`);
      await untilTick(p, 1560);
    },
  },
  {
    name: "05-Reverted",
    viewport: DESKTOP,
    run: async (p) => {
      await p.goto(`${BASE}/?offline=1&test=1&seed=1758&speed=6`);
      await untilTick(p, 1200);
      await p.evaluate(() => {
        const h = (window as unknown as Hooks).__mc;
        h.paused = false;
        h.play([16, ...Array(70).fill(0)]);
      });
      await p.waitForFunction(() => document.body.classList.contains("is-reverted"), null, { timeout: 30_000 });
      await p.waitForTimeout(800);
      await p.evaluate(() => ((window as unknown as Hooks).__mc.paused = true));
      await p.waitForTimeout(400);
    },
  },
  {
    name: "06-Freeze",
    viewport: DESKTOP,
    run: async (p) => {
      await p.goto(`${BASE}/?offline=1&test=1&seed=1758&speed=10&minutes=2`);
      await untilTick(p, 2400 - 27 * 20 - 40);
    },
  },
  {
    name: "07-Result",
    viewport: DESKTOP,
    run: async (p) => {
      await p.goto(`${BASE}/?offline=1&test=1&seed=1758&speed=20&minutes=2`);
      await p.locator(".result-title").waitFor({ timeout: 120_000 });
      await p.waitForTimeout(800);
    },
  },
  {
    name: "04-Blast",
    viewport: DESKTOP,
    run: async (p) => {
      await p.goto(`${BASE}/?offline=1&test=1&seed=1758&speed=20&minutes=2`);
      await p.locator(".result-title").waitFor({ timeout: 120_000 });
      await p.getByTestId("watch-highlight").click();
      await p.waitForTimeout(3600);
      await p.evaluate(() => ((window as unknown as Hooks).__mc.paused = true));
      await p.waitForTimeout(300);
    },
  },
  {
    name: "08-Maps",
    viewport: DESKTOP,
    run: async (p) => {
      await p.goto(`${BASE}/?test=1`);
      await p.getByTestId("create").click();
      await p.getByTestId("change-map-lobby").click();
      await p.waitForTimeout(800);
    },
  },
  {
    name: "09-Mobile-match",
    viewport: PHONE,
    run: async (p) => {
      await p.goto(`${BASE}/?offline=1&test=1&seed=1758&speed=6`);
      await untilTick(p, 1560);
    },
  },
  {
    name: "09-Mobile-lobby",
    viewport: PHONE,
    run: async (p) => {
      await p.goto(`${BASE}/?test=1`);
      await p.getByTestId("create").click();
      await p.waitForTimeout(2500);
    },
  },
  {
    name: "09-Mobile-result",
    viewport: PHONE,
    run: async (p) => {
      await p.goto(`${BASE}/?offline=1&test=1&seed=1758&speed=20&minutes=2`);
      await p.locator(".result-title").waitFor({ timeout: 120_000 });
      await p.waitForTimeout(800);
    },
  },
];

async function main(): Promise<void> {
  if (!existsSync("dist/index.html")) execFileSync("npm", ["run", "build"], { stdio: "inherit" });
  const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
  try {
    for (let k = 0; k < 50; k++) {
      try {
        if ((await fetch(BASE)).ok) break;
      } catch {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader"] });
    for (const locale of LOCALES) {
      mkdirSync(`${OUT}/${locale}`, { recursive: true });
      for (const shot of SHOTS.filter((s) => !process.argv[2] || s.name.includes(process.argv[2]))) {
        const page = await browser.newPage({
          viewport: shot.viewport,
          deviceScaleFactor: 2,
          isMobile: shot.viewport === PHONE,
          hasTouch: shot.viewport === PHONE,
        });
        await setLocale(page, locale);
        await shot.run(page);
        const png = `${OUT}/${locale}/${shot.name}.png`;
        await page.screenshot({ path: png });
        await page.close();
        if (process.platform === "darwin") {
          const jpg = png.replace(/\.png$/, ".jpg");
          const resample = shot.viewport === PHONE ? [] : ["--resampleWidth", "1920"];
          execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "82", ...resample, png, "--out", jpg], {
            stdio: "ignore",
          });
        }
        console.log(`captured ${png}`);
      }
    }
    await browser.close();
  } finally {
    server.kill();
  }
}

void main();

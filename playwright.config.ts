import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4174",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: /online/ },
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, testIgnore: /online/ },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, testIgnore: /online/ },
    { name: "phone", use: { ...devices["Pixel 7"] }, testIgnore: /online/ },
    // Two browsers through the real Worker and Durable Object (wrangler dev).
    {
      name: "online",
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:8787" },
      testMatch: /online/,
      // A whole real-time sprint through a real server: one retry for a stalled run (seen once
      // in three local runs; see TODO_FOR_YOU.md).
      retries: 1,
    },
  ],
  webServer: [
    {
      command: "npm run build && npm run preview",
      url: "http://localhost:4174",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npx wrangler dev --port 8787 --var ALLOW_DEV_ORIGINS:1",
      url: "http://localhost:8787",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});

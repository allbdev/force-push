/// <reference types="vitest/config" />
import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  build: {
    target: "es2022",
    sourcemap: true,
    chunkSizeWarningLimit: 700,
  },
  server: {
    // `npm run server` runs the Worker (rooms) on 8787; the dev server forwards /api to it.
    proxy: { "/api": { target: "http://localhost:8787", ws: true, changeOrigin: false } },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    environment: "node",
  },
});

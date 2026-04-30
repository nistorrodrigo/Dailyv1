/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Dedicated vitest config so component tests have a DOM. The plain
 * `vite.config.js` doesn't pull in vitest types or set an environment;
 * keeping this separate also avoids running tailwind/PostCSS during
 * the test run (which is unnecessary for unit tests).
 */
export default defineConfig({
  plugins: [react()],
  test: {
    // happy-dom is faster and lighter than jsdom for the small surface
    // we need (DOM events, query selectors, getBoundingClientRect, etc.).
    environment: "happy-dom",
    globals: false,
    setupFiles: ["./src/__tests__/setup.ts"],
    // Vitest's default scan picks up any `*.spec.ts` file, including the
    // Playwright suite under e2e/. Those import from @playwright/test and
    // call test.describe() at module scope, which throws under vitest.
    // Explicit include keeps the scan tight to the unit-test dir.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "dist", "e2e", ".github"],
  },
});

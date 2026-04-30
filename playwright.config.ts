import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for end-to-end smoke testing.
 *
 * The vitest suite covers pure logic (utils, generateHTML, store reducers)
 * and component rendering in isolation via @testing-library/react with a
 * mocked DOM. What it can't catch is integration regressions — the kind
 * where each unit works individually but they don't compose right at
 * runtime: tab routing, the daily-store autosave wiring, the send-panel
 * mount/unmount lifecycle, drag-to-reorder in real DOM.
 *
 * E2E covers exactly that gap. Each spec opens the built bundle in a
 * real Chromium and drives it through high-value flows: app loads, tabs
 * switch, editor inputs accept text, the send panel renders correctly
 * without auth.
 *
 * Auth handling: we run the dev server with `VITE_SUPABASE_URL` empty.
 * That makes LoginGate fall through to the children (see line 39 of
 * LoginGate.tsx), so every test starts at the editor without needing
 * a real Supabase account. Tests that exercise authed-only behaviour
 * (the actual send) live in a separate auth-injected suite — not yet
 * implemented; this is the smoke baseline.
 */
export default defineConfig({
  testDir: "./e2e",

  // Per-test timeout. The build is fast and most actions are instant;
  // 15s leaves headroom for any animation or network idle without
  // letting flaky tests hang the suite forever.
  timeout: 15 * 1000,
  expect: { timeout: 5 * 1000 },

  // CI: don't allow `.only` slipping through, retry once on flake. Locally,
  // skip retries so failures are loud.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,

  // Single reporter: the HTML report is dropped in playwright-report/ on
  // failure for diffing. Stdout stays terse so CI logs are scannable.
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Build then serve the production bundle. `vite preview` is closer to
  // what runs in production than `vite dev`, and it's fast enough not to
  // matter (~3s build). reuseExistingServer skips the rebuild when the
  // server is already up locally.
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    // Force the dev bundle to omit Supabase env vars so LoginGate
    // short-circuits and the editor renders immediately. See the file
    // header for why.
    env: {
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_ANON_KEY: "",
    },
  },
});

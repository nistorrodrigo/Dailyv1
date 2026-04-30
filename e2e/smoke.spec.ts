import { test, expect } from "@playwright/test";

/**
 * Smoke baseline. These tests exist to catch the "shipped a broken
 * bundle" class of regression — the app doesn't load, an import path
 * resolves to undefined, the editor crashes on first render. They
 * intentionally cover breadth (every tab renders without throwing)
 * over depth.
 *
 * Auth: the webServer config in playwright.config.ts runs the build
 * with VITE_SUPABASE_URL empty, so LoginGate falls through and the
 * editor loads directly. Useful corollary — we also implicitly test
 * the "Supabase not configured" code paths in every component, which
 * is the same code path that runs when a forked dev environment lacks
 * the env vars.
 */

test.describe("smoke: app loads", () => {
  test("renders without uncaught console errors", async ({ page }) => {
    // Collect console errors, ignoring noisy expected ones (the analytics
    // endpoint 404s are normal when Supabase isn't configured).
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      // Filter expected dev-mode noise.
      if (text.includes("404") && text.includes("/api/")) return;
      if (text.includes("Failed to load resource")) return;
      if (text.includes("[Sentry]")) return;
      errors.push(text);
    });

    await page.goto("/");
    // Wait for the header to render — proves React mounted, not just HTML.
    await expect(page.getByRole("button", { name: /Send Email/i })).toBeVisible();

    // No uncaught errors should have surfaced during initial render.
    expect(errors, `Console errors during load:\n${errors.join("\n")}`).toEqual([]);
  });

  test("default tab is the editor", async ({ page }) => {
    await page.goto("/");
    // The Editor tab button has the active style — and the General Card
    // with the Date input is the first thing rendered.
    await expect(page.getByLabel("Date")).toBeVisible();
  });
});

test.describe("smoke: tab navigation", () => {
  test("each main tab renders without throwing", async ({ page }) => {
    await page.goto("/");

    // Click each tab in order. The success criterion is "the click
    // doesn't throw and the page doesn't show an ErrorBoundary
    // fallback". We don't assert on specific tab content — that's
    // what the per-tab specs are for. We just want breadth coverage
    // here so if e.g. the AI Draft tab crashes on mount, we know.
    const tabs = ["Analysts", "AI Draft", "Preview", "HTML Editor", "Dashboard", "Editor"];
    for (const name of tabs) {
      await page.getByRole("button", { name, exact: true }).click();
      // ErrorBoundary shows "Something went wrong" — the absence of
      // that string means the tab rendered.
      await expect(page.getByText(/Something went wrong/i)).not.toBeVisible();
    }
  });
});

test.describe("smoke: editor input persistence", () => {
  test("typing in Date persists across a tab switch", async ({ page }) => {
    await page.goto("/");

    const dateInput = page.getByLabel("Date");
    await dateInput.fill("2026-12-31");
    await expect(dateInput).toHaveValue("2026-12-31");

    // Switch away and back. The store is global Zustand state, but the
    // tab wrapper has a `key={tab}` that forces remount — this checks
    // both directions: the input rehydrates from store, AND the store
    // wasn't cleared on unmount.
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await page.getByRole("button", { name: "Editor", exact: true }).click();

    await expect(page.getByLabel("Date")).toHaveValue("2026-12-31");
  });
});

test.describe("smoke: Send Email panel", () => {
  test("opens and shows the no-auth banner without a session", async ({ page }) => {
    await page.goto("/");

    // The "Send Email" button in the Header opens the slide-in panel.
    await page.getByRole("button", { name: /Send Email/i }).click();

    // Without a Supabase session, the panel renders the amber "Not
    // signed in" notice and disables the send buttons. This is the
    // production behaviour an analyst would see if their JWT expired.
    await expect(page.getByText(/Not signed in/i)).toBeVisible();

    // Both action buttons should be disabled.
    const sendBtn = page.getByRole("button", { name: /Send Daily Email/i });
    const testBtn = page.getByRole("button", { name: /^Test Email$/ });
    await expect(sendBtn).toBeDisabled();
    await expect(testBtn).toBeDisabled();
  });

  test("can be dismissed", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /Send Email/i }).click();
    await expect(page.getByText(/Not signed in/i)).toBeVisible();

    // The panel header has an × close button. Clicking it should
    // remove the panel from the DOM.
    await page.locator("button").filter({ hasText: /^×$/ }).first().click();
    await expect(page.getByText(/Not signed in/i)).not.toBeVisible();
  });
});

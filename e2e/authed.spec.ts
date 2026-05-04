import { test, expect } from "@playwright/test";

/**
 * Authed E2E suite — exercises UI surfaces that require a live
 * Supabase session, without standing up a real auth backend.
 *
 * Strategy: the app's `useCurrentUser` hook has a dev-only escape
 * hatch that reads from `window.__TEST_SESSION__` before falling
 * through to Supabase (see src/hooks/useCurrentUser.ts). The
 * fixture below uses Playwright's `addInitScript` to inject a
 * synthetic session into the page BEFORE any of the app's JS
 * runs. The hook then returns the synthetic user directly and the
 * UI behaves as though the analyst is signed in.
 *
 * What this catches:
 *   - The "logged-in" branch of EmailSendPanel renders correctly
 *     (no "Not signed in" amber banner; Send button enabled).
 *   - Identity chip in the Header populates the user's name.
 *   - SendConfirmModal's authMethod="session" path renders the
 *     green "Authenticated session" pill.
 *
 * What it DOESN'T catch:
 *   - Real network round-trips against /api/send-email or
 *     /api/analytics. Those require either Playwright route()
 *     intercepts (mocking) or a live test backend. Out of scope
 *     for this baseline.
 *
 * Adding new authed tests: extend the `injectSession` fixture or
 * use `page.addInitScript` directly inside the test body.
 */

const TEST_USER_EMAIL = "rodrigo.nistor@latinsecurities.ar";
const TEST_USER_NAME = "Rodrigo Nistor";

/**
 * Inject a synthetic Supabase session into `window.__TEST_SESSION__`
 * before any app JS runs. Must be called via `addInitScript` (which
 * fires before `goto`) — running it after page load is too late;
 * the hook's `useEffect` has already run with no test flag set.
 *
 * The shape mirrors what `useCurrentUser` expects: `{ user, session }`
 * where each carries enough fields for the UI to render. We don't
 * include real JWTs because the API isn't being hit.
 */
async function injectSession(page: import("@playwright/test").Page) {
  // `window.__TEST_SESSION__` is declared globally in
  // `src/hooks/useCurrentUser.ts` (gate against the hook's escape
  // hatch). The browser-context body of `addInitScript` runs under
  // the same TS project, so the property is typed and no cast is
  // needed here.
  await page.addInitScript(
    ({ email }) => {
      window.__TEST_SESSION__ = {
        user: {
          id: "test-user-id",
          email,
          user_metadata: {},
          app_metadata: {},
          aud: "authenticated",
          created_at: "2026-01-01T00:00:00Z",
        } as unknown as import("@supabase/supabase-js").User,
        session: {
          access_token: "fake-jwt-for-e2e",
          refresh_token: "fake-refresh",
          expires_in: 3600,
          token_type: "bearer",
          user: { id: "test-user-id", email },
        } as unknown as import("@supabase/supabase-js").Session,
      };
    },
    { email: TEST_USER_EMAIL },
  );
}

test.describe("authed: identity chip + Send panel", () => {
  test("Header shows the test user identity chip", async ({ page }) => {
    await injectSession(page);
    await page.goto("/");

    // The chip renders the email's local-part — see Header.tsx
    // around the `header-user-chip-text` className. On desktop
    // viewports both the avatar and the text are visible.
    await expect(page.getByText("rodrigo.nistor", { exact: false })).toBeVisible();
  });

  test("Send Email panel renders the authed branch", async ({ page }) => {
    await injectSession(page);
    await page.goto("/");

    await page.getByRole("button", { name: /Send Email/i }).click();

    // No amber "Not signed in" banner — that's the unauthed branch.
    await expect(page.getByText(/Not signed in/i)).not.toBeVisible();

    // Both action buttons enabled now that a session is present.
    await expect(page.getByRole("button", { name: /^Test Email$/ })).toBeEnabled();
    await expect(page.getByRole("button", { name: /Send Daily Email/i })).toBeEnabled();
  });

  test("AI Review panel renders pre-flight checks block", async ({ page }) => {
    await injectSession(page);
    await page.goto("/");

    // AI Review opens via a Header button.
    await page.getByRole("button", { name: /AI Review/i }).click();

    // The "Quick checks (no API call)" block should be visible —
    // it runs synchronously on mount, no auth round-trip needed,
    // but it's gated on the panel rendering.
    await expect(page.getByText(/Quick checks/i)).toBeVisible();
  });
});

// Sanity check that the escape hatch is genuinely dev-only.
// Without `injectSession`, the unauthed UI should still work
// (this is the same as the smoke suite, but here we pin the
// guarantee that adding the hatch didn't accidentally turn it
// on for non-test pages).
test.describe("authed: escape hatch is opt-in", () => {
  test("without injection, the unauthed banner still appears", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Send Email/i }).click();
    await expect(page.getByText(/Not signed in/i)).toBeVisible();
  });
});

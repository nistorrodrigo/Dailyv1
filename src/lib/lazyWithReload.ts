import { lazy, type ComponentType } from "react";

// Sentinel localStorage key — when a chunk-load failure forces a
// reload, we set this so a second consecutive failure doesn't loop
// the page. After a clean session lands the flag is cleared so the
// next stale-bundle event still triggers a recovery reload.
const RELOAD_FLAG = "ls-chunk-reload-attempted";

// Stale-bundle errors look like one of these strings. Modern Vite
// emits the first; older browsers / older builds throw the second.
// Match defensively because the exact wording differs by engine
// (Chrome / Firefox / Safari) and we don't want to miss a recovery
// opportunity over phrasing.
const STALE_BUNDLE_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Loading chunk \d+ failed/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
];

function isStaleBundleError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return STALE_BUNDLE_PATTERNS.some((re) => re.test(msg));
}

/**
 * Wrap React.lazy with a one-shot reload on stale-bundle errors.
 *
 * The failure mode this fixes: an analyst keeps a tab open across
 * a Vercel deploy. Their tab still has the old `index.js` loaded,
 * which references chunks by content-hash (e.g. `DashboardTab-
 * u6KTXhtE.js`). The new deploy's `index.js` references different
 * hashes; the old chunks are no longer served by the CDN. When the
 * analyst clicks a tab that triggers a lazy() import, the request
 * 404s and React's Suspense throws "Failed to fetch dynamically
 * imported module".
 *
 * The fix: catch that specific error class and force-reload once.
 * The reload picks up the new index.html with the new chunk hashes
 * and the analyst's session resumes (state is persisted in
 * localStorage, so they don't lose their daily). One-shot so a
 * genuine network outage doesn't loop the page indefinitely.
 *
 * Use everywhere we currently call React.lazy — drop-in
 * replacement, same signature.
 */
// Constraint matches React.lazy's own signature — ComponentType<any>
// rather than ComponentType<object>, so wrapped components can have
// required props without TS narrowing them away.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithReload<T extends ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
): ReturnType<typeof lazy<T>> {
  return lazy(() =>
    loader().catch((err: unknown) => {
      if (isStaleBundleError(err)) {
        // Only reload once per session — if the reload itself loads
        // a still-broken bundle, surfacing the error is more useful
        // than a redirect loop.
        const alreadyReloaded =
          typeof sessionStorage !== "undefined" &&
          sessionStorage.getItem(RELOAD_FLAG) === "1";

        if (!alreadyReloaded && typeof window !== "undefined") {
          try {
            sessionStorage.setItem(RELOAD_FLAG, "1");
          } catch {
            // ignore quota / disabled-storage issues — worst case we
            // skip the dedupe and may reload again, no harm
          }
          window.location.reload();
          // Return a never-resolving promise so React doesn't try to
          // render a fallback (the tab is reloading anyway).
          return new Promise<{ default: T }>(() => {});
        }
      }
      throw err;
    }),
  );
}

/**
 * Clear the reload-attempted flag. Called once on App mount when
 * the bundle has loaded successfully, so a future stale-bundle
 * event in the same browser session can trigger a fresh recovery
 * reload (rather than being suppressed by the leftover flag from
 * an earlier deploy).
 */
export function clearReloadFlag(): void {
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    // ignore
  }
}

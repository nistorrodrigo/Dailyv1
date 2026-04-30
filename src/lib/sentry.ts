import * as Sentry from "@sentry/react";

/**
 * Sentry initialisation.
 *
 * No-op when VITE_SENTRY_DSN is not set, so dev builds and forks
 * without a Sentry account work exactly as before. Set the env var in
 * Vercel (Production + Preview at minimum) to start receiving events.
 *
 * What we capture:
 *   - Uncaught exceptions in React render/lifecycle (via the
 *     ErrorBoundary's `onError` prop, see main.tsx).
 *   - window.error and unhandledrejection (also via ErrorBoundary).
 *   - Anything else hitting Sentry.captureException(...) anywhere
 *     in the codebase.
 *
 * What we deliberately DON'T do:
 *   - sessionReplay or browserTracing — would balloon the bundle for
 *     no clear win on an internal tool of this size. Easy to add
 *     later by extending the integrations array.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE,
    // Strip query strings + fragments off URLs in breadcrumbs / events;
    // some of our endpoints carry tokens (the unsubscribe substitution
    // in particular) we don't want sitting in error reports.
    beforeSend(event) {
      if (event.request?.url) {
        try {
          const u = new URL(event.request.url);
          event.request.url = u.origin + u.pathname;
        } catch { /* keep as-is */ }
      }
      return event;
    },
  });
}

/** Forward an error to Sentry. Safe to call before init() (no-op then). */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/**
 * Resolve the absolute URL of a hosted logo asset for use in
 * generated email HTML.
 *
 * Why absolute (not relative, not base64-inline):
 *
 *   - **Relative paths (/logo.png)**: ALWAYS broken in sent emails.
 *     A relative URL in `<img src="/logo.png">` resolves against
 *     the recipient's mail-client domain, not against
 *     latinsecurities.ar. The image 404s in every inbox.
 *
 *   - **Inline base64 data URIs**: works in Gmail / Apple Mail /
 *     Yahoo, but Outlook desktop's Word renderer has known
 *     intermittent failures with large data URIs (~30% of
 *     institutional readers). Also bloats every email by ~94 KB.
 *     The previous lazy-load + fallback design also had a race:
 *     if the analyst clicked Send within ~100 ms of page load the
 *     base64 cache hadn't populated yet and the HTML emitted the
 *     relative-URL fallback above.
 *
 *   - **Absolute hosted URL**: works in every email client, no
 *     race conditions, native client-side caching, smaller HTML.
 *     Recipients have already established trust with the sender
 *     domain (they subscribed) so image-loading is enabled.
 *
 * Configuration:
 *
 *   `VITE_PUBLIC_BASE_URL` env var overrides the default. Useful
 *   when migrating to a custom domain — set `VITE_PUBLIC_BASE_URL=
 *   https://daily.latinsecurities.ar` and every email points there
 *   without code changes.
 *
 *   Default `https://dailyv1.vercel.app` matches the current
 *   Vercel-hosted deployment. Tests run with no env var set and
 *   get the default — snapshots are stable.
 */

const DEFAULT_BASE = "https://dailyv1.vercel.app";

function getBase(): string {
  // Vite inlines `import.meta.env.*` at build time. Empty string,
  // undefined, or unset all fall back to the default.
  const fromEnv =
    typeof import.meta !== "undefined" ? import.meta.env?.VITE_PUBLIC_BASE_URL : undefined;
  if (typeof fromEnv === "string" && fromEnv.trim()) {
    // Strip a trailing slash so callers can always concat
    // `${base}/logo.png` without doubling.
    return fromEnv.trim().replace(/\/+$/, "");
  }
  return DEFAULT_BASE;
}

export type LogoVariant = "white" | "orig";

const FILENAMES: Record<LogoVariant, string> = {
  white: "logo-white.png",
  orig: "logo.png",
};

/** Absolute URL of a hosted logo for use in email HTML / print HTML. */
export function getEmailLogoUrl(variant: LogoVariant): string {
  return `${getBase()}/${FILENAMES[variant]}`;
}

/**
 * Escape HTML metacharacters so a string can be safely interpolated
 * into an HTML body or attribute context.
 *
 * The previous `nl2br` quietly let `<`, `>`, `&`, `"`, `'` through
 * unchanged — every prose field the analyst typed went straight into
 * the email HTML, the in-app preview iframe (which uses
 * dangerouslySetInnerHTML), and the print-window PDF export.
 * Pasting copy from a research note that happened to contain
 * `<img src=x onerror=...>` would execute in the analyst's own
 * origin with their Supabase session live. This helper closes that
 * gap for every concat site in the renderer.
 *
 * Returns `""` for null/undefined so callers can drop it inline
 * without guarding.
 */
export function escapeHtml(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * URL allowlist + attribute-safe encoding for `href` / `src` values.
 *
 * Two failure modes the previous renderer was open to:
 *
 *   1. `javascript:` / `data:` / `vbscript:` URLs — an analyst
 *      pasting a tampered link from a phishing email landed an
 *      executable `<a href="javascript:...">` in the rendered HTML.
 *      Most email clients strip these, but the in-app preview and
 *      PDF export do not.
 *   2. Attribute-context break: a URL containing `"` would close
 *      the surrounding quote and the rest of the URL could be
 *      interpreted as additional attributes (`onclick`, `onerror`).
 *
 * Allowlist is conservative: only `http`, `https`, `mailto`, `tel`,
 * plus relative paths starting with `/` (used by unsubscribeUrl and
 * potentially future flows). Anything else returns `""` — callers
 * already guard on emptiness before emitting the wrapping `<a>`.
 *
 * The returned URL has its `"` and `<` characters percent-encoded
 * so it's safe to drop into `href="${url}"` directly. Other special
 * chars are left alone (they're legal in URL form).
 */
export function safeUrl(u: string | null | undefined): string {
  if (u == null) return "";
  const trimmed = String(u).trim();
  if (!trimmed) return "";
  // Allowlist by scheme. Relative paths (starting with `/`) are
  // also OK — used by unsubscribeUrl and the email's footer links.
  if (
    !/^https?:/i.test(trimmed) &&
    !/^mailto:/i.test(trimmed) &&
    !/^tel:/i.test(trimmed) &&
    !/^\//.test(trimmed)
  ) {
    return "";
  }
  // Attribute-context escape — close-quote and angle-bracket are
  // the two characters that can break out of a quoted attribute.
  return trimmed.replace(/"/g, "%22").replace(/</g, "%3C").replace(/>/g, "%3E");
}

/**
 * Replace newlines with `<br>` for inline rendering AFTER escaping
 * every other HTML metacharacter. This is the safe replacement for
 * the previous `nl2br` which silently passed everything through.
 */
export function nl2br(t: string | null | undefined): string {
  return escapeHtml(t).replace(/\n/g, "<br>");
}

export function mdToHtml(text: string | null | undefined): string {
  if (!text) return "";
  // Escape first so user-input metacharacters can't break out.
  // Markdown markers (`**`, `*`, `- `) are ASCII and survive the
  // escape, so the subsequent replace steps still pattern-match
  // correctly. Inline literal `<` inside the analyst's text now
  // renders as `&lt;` instead of opening a tag.
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match: string) => `<ul>${match}</ul>`);
  html = html.replace(/\n/g, "<br>");
  return html;
}

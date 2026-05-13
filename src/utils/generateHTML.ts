import { BRAND } from "../constants/brand";
import { getEmailLogoUrl } from "./emailLogoUrl";
import { formatDate, fmtEventDate, fmtTime } from "./dates";
import { rc, rb, ra, resolveCorporateBlock } from "./ratings";
import { fmtUpside, upsideColor, calcUpside } from "./prices";
import { nl2br, escapeHtml, safeUrl } from "./text";
import type { DailyState, NewsLink } from "../types";

/** Hostname-only fallback when a NewsLink has no label, e.g. "ft.com". */
function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

/**
 * Substitution token replaced per-recipient by SendGrid's `substitutions`
 * map (see api/send-email.js). When sent via the /api/send-email path,
 * each recipient's email is encoded into the URL so the unsubscribe form
 * comes pre-filled. When the HTML is pasted directly into SendGrid's
 * Code Editor (no per-recipient substitution), the token survives but
 * /api/unsubscribe handles a literal `?email=__LS_RECIPIENT_EMAIL__`
 * gracefully — it shows the form blank.
 */
export const UNSUBSCRIBE_EMAIL_TOKEN = "__LS_RECIPIENT_EMAIL__";
/**
 * SendGrid substitution token replaced at send time with an HMAC of
 * the recipient's email. Lets /api/unsubscribe verify that the
 * person clicking the link genuinely received the email — without
 * the HMAC, anyone on the internet could suppress arbitrary
 * addresses by guessing them in the query string.
 *
 * api/send-email.js generates the HMAC per recipient (via
 * `UNSUBSCRIBE_HMAC_SECRET` env var) and substitutes it into the
 * HTML body before posting to SendGrid.
 */
export const UNSUBSCRIBE_HMAC_TOKEN = "__LS_RECIPIENT_HMAC__";

/**
 * Public URL for the /api/unsubscribe endpoint. Resolves at runtime so the
 * link works whether the email is generated locally (`http://localhost:5173`)
 * or in production (`https://dailyv1.vercel.app`). Falls back to the prod
 * URL when there's no `window` (i.e. inside vitest's happy-dom tests).
 *
 * Two SendGrid substitutions are baked into the URL:
 *   - `?email=__LS_RECIPIENT_EMAIL__` — the recipient's email
 *   - `&t=__LS_RECIPIENT_HMAC__`     — HMAC-SHA256(email, secret),
 *                                       first 16 hex chars
 * /api/unsubscribe verifies that the HMAC matches the email before
 * suppressing. Without both substitutions matching, the request
 * falls through to the manual-form path (rate-limited).
 */
function unsubscribeUrl(): string {
  const origin = typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : "https://dailyv1.vercel.app";
  return `${origin}/api/unsubscribe?email=${UNSUBSCRIBE_EMAIL_TOKEN}&t=${UNSUBSCRIBE_HMAC_TOKEN}`;
}

/** Tiny "Sources: <a> · <a>" footer for blocks that have news links. */
function renderNewsLinks(links: NewsLink[] | undefined): string {
  if (!links || !links.length) return "";
  // Filter on a SAFE url — `safeUrl` returns "" for `javascript:`,
  // `data:`, malformed schemes, etc. so a tampered NewsLink doesn't
  // emit an anchor with an unsafe href. Then escape the label /
  // hostname for body-context interpolation.
  const valid = links
    .map((l) => ({ url: safeUrl(l.url), label: l.label ?? "" }))
    .filter((l) => l.url);
  if (!valid.length) return "";
  const items = valid
    .map((l) => '<a href="' + l.url + '" style="color:#1e5ab0;text-decoration:none;font-weight:600;">' + escapeHtml(l.label.trim() || hostOf(l.url)) + ' ↗</a>')
    .join('<span style="color:#bbb;margin:0 6px;">·</span>');
  return '<div style="margin-top:10px;font-size:11.5px;line-height:1.6;color:#888;"><span style="font-weight:600;text-transform:uppercase;letter-spacing:0.5px;font-size:10px;margin-right:6px;">Sources</span>' + items + '</div>';
}

/**
 * Shared call-to-action button — one filled-blue style applied
 * uniformly across every per-item "click here for more" link in the
 * daily (Corporate, Research, Latest Reports, Tweets, Events). The
 * desk wants every CTA to look the same so institutional readers
 * scanning the email recognise "this takes me somewhere" at a
 * glance, no matter which section.
 *
 * Auxiliary links (the multi-link "Sources" footer under macro
 * blocks, the TOC anchor jumps, the email footer's unsubscribe /
 * website link) stay plain — they're not the same concept and a
 * row of buttons would clutter.
 *
 * Returns "" when no URL is present so callers can string-concat
 * it unconditionally. `label` defaults to "Full report →" because
 * that's the most common case.
 */
function renderReportLink(
  url: string | undefined,
  opts: { wrap?: boolean; label?: string; compact?: boolean } = {},
): string {
  // Allowlist-check the URL: `javascript:` / `data:` URLs return ""
  // and the whole CTA is suppressed.
  const safe = safeUrl(url);
  if (!safe) return "";
  // Labels can contain HTML entities like `&#8594;` (callers use
  // those intentionally for arrows) so we don't escape `label` —
  // it's controlled at the call site and never user input.
  const label = opts.label || "Full report &#8594;";
  const padding = opts.compact ? "3px 10px" : "6px 14px";
  const fontSize = opts.compact ? "11px" : "12px";
  const link =
    '<a href="' + safe +
    '" style="font-size:' + fontSize + ';color:#fff;background:#1e5ab0;padding:' + padding + ';border-radius:4px;text-decoration:none;font-weight:600;display:inline-block;">' +
    label + '</a>';
  return opts.wrap ? '<div style="margin-top:' + (opts.compact ? "4px" : "8px") + ';">' + link + '</div>' : link;
}

/**
 * Render the earnings / investor call CTA — used by Corporate
 * blocks during earnings season. Visually distinct from
 * `renderReportLink` so the analyst's eye separates "join the
 * call" from "read the report":
 *
 *   - Outlined sky-blue button (not the filled accent-blue used
 *     by report links)
 *   - Phone glyph + the analyst's free-text date/time inline
 *
 * Returns "" when no URL is set so callers can string-concat
 * unconditionally. The dateTime label is optional — past-replay
 * scenarios often don't need one ("Replay →").
 */
function renderCallLink(url: string | undefined, dateTime: string | undefined): string {
  const safe = safeUrl(url);
  if (!safe) return "";
  // dateTime is analyst-supplied free-text → must escape before
  // interpolation. URL is already attribute-safe-encoded by safeUrl.
  const dt = (dateTime || "").trim();
  const dtLabel = dt ? '<span style="color:' + DS.textLight + ';margin-right:8px;font-size:11.5px;">' + escapeHtml(dt) + '</span>' : '';
  // Outlined button (transparent bg, sky border + text) so it
  // reads as a *secondary* CTA when sitting next to the filled
  // "Full report →" — earnings emails often have both, and the
  // visual hierarchy needs to be: report > call.
  const link =
    '<a href="' + safe +
    '" style="font-size:12px;color:' + DS.accent + ';background:transparent;padding:5px 13px;border:1.5px solid ' + DS.accent + ';border-radius:4px;text-decoration:none;font-weight:600;display:inline-block;">' +
    '☎ Join call &#8594;</a>';
  return '<div style="margin-top:8px;">' + dtLabel + link + '</div>';
}

const DS = {
  maxW: 640,
  navy: "#000039",
  accent: "#1e5ab0",
  sky: "#3399ff",
  text: "#2c2c2c",
  textLight: "#5a5a5a",
  textMuted: "#8a8a8a",
  border: "#d4d8dd",
  borderLight: "#e8eaed",
  bgAlt: "#f7f8fa",
  green: "#1a7a3a",
  red: "#c0392b",
  greenBg: "#edf7ed",
} as const;

function secHdr(title: string, id?: string): string {
  return '<tr><td style="padding:28px 40px 0;" id="sec-' + (id || title) + '"><div style="font-size:11px;font-weight:700;color:' + DS.navy + ';text-transform:uppercase;letter-spacing:2px;padding-bottom:8px;border-bottom:2px solid ' + DS.navy + ';margin-bottom:16px;">' + title + '</div></td></tr>';
}

// Section label map for TOC
const SEC_LABELS: Record<string, string> = {
  watchToday: "What to Watch This Week",
  marketComment: "Market Comment",
  macro: "Macro / Political", tradeIdeas: "Trade Ideas", flows: "Market Color",
  corporate: "Corporate", research: "Research Reports",
  latestReports: "Latest Research Reports",
  bondPipeline: "Bond Pipeline",
  topMovers: "Top Movers", tweets: "Market Intelligence", latam: "LatAm Context",
  bcra: "BCRA Dashboard", events: "Events and Webinars", macroEstimates: "Macro Estimates",
  chart: "Chart of the Day",
};

// mode: "full" (default) | "toc" (with table of contents) | "compact" (summary only)
// template: "formal" (default) | "flash" | "executive"
//
// Memoized: zustand emits a new state ref only when something changes, so a
// WeakMap keyed on state lets multiple subscribers (Header, PreviewTab, the
// send-confirmation modal, EmailSendPanel) read the same HTML for free.
// We additionally key on `${mode}|${template}` since those args change the
// output but state can be the same.
const htmlCache: WeakMap<DailyState, Record<string, string>> = new WeakMap();

export function generateHTML(s: DailyState, mode: string = "full", template: string = "formal"): string {
  const variantKey = `${mode}|${template}`;
  const variants = htmlCache.get(s);
  if (variants && variants[variantKey] !== undefined) return variants[variantKey];

  const result = generateHTMLImpl(s, mode, template);

  if (variants) {
    variants[variantKey] = result;
  } else {
    htmlCache.set(s, { [variantKey]: result });
  }
  return result;
}

function generateHTMLImpl(s: DailyState, mode: string = "full", template: string = "formal"): string {
  // Hosted absolute URLs for the email logo. See ./emailLogoUrl
  // for the full rationale — short version: base64-inline had a
  // race condition (cache not warm before user clicked Send),
  // intermittent Outlook desktop bugs, and a relative-URL fallback
  // that always 404s in sent emails. Absolute URLs to the deployed
  // Vercel-hosted PNG fix all three at once.
  const logo: string = getEmailLogoUrl("orig");
  const logoW: string = getEmailLogoUrl("white");
  const allTickers = s.analysts.flatMap(a => a.coverage.map(c => ({ ticker: c.ticker, rating: c.rating, tp: c.tp, last: c.last || "", analyst: a.name })));

  // Market Snapshot and Yesterday in Review were retired from the
  // section catalogue — the desk decided they didn't earn their
  // space. Underlying state fields (`s.snapshot`, `s.yesterdayRecap`)
  // are preserved on the type for backwards compat with persisted
  // dailies that still hold those values; nothing renders them now.

  // WHAT TO WATCH (this week) — bullet list of free-text items;
  // each entry escaped before interpolation.
  const watchItems = (s.watchToday || []).filter((w: string) => w.trim());
  const watchToday = s.sections.find(x => x.key === "watchToday")?.on && watchItems.length ? secHdr("What to Watch This Week") + '<tr><td style="padding:0 40px 8px;">' + watchItems.map((w: string) => '<div style="padding:6px 0;font-size:13.5px;line-height:1.55;color:' + DS.text + ';"><span style="color:#e67e22;font-weight:700;margin-right:8px;">&#9656;</span>' + escapeHtml(w) + '</div>').join("") + '</td></tr>' : "";

  // MARKET COMMENT — single free-form prose block.
  const marketComment = s.sections.find(x => x.key === "marketComment")?.on && s.marketComment?.trim()
    ? secHdr("Market Comment") + '<tr><td style="padding:0 40px 8px;"><div style="font-size:13.5px;line-height:1.65;color:' + DS.text + ';text-align:justify;">' + nl2br(s.marketComment) + '</div></td></tr>'
    : "";

  // LATAM CONTEXT
  const latam = s.sections.find(x => x.key === "latam")?.on && s.latam ? secHdr("LatAm Context") + '<tr><td style="padding:0 40px 8px;"><div style="font-size:13.5px;line-height:1.65;color:' + DS.text + ';text-align:justify;">' + nl2br(s.latam) + '</div></td></tr>' : "";

  // MACRO — `b.title` is a single-line heading (escape, no nl2br);
  // `b.body` and `b.lsPick` are prose (nl2br already escapes).
  const macro = s.sections.find(x => x.key === "macro")?.on ? secHdr("Macro / Political") + '<tr><td style="padding:0 40px 8px;">' + s.macroBlocks.map(b => '<div style="margin-bottom:20px;"><div style="font-size:13px;font-weight:700;color:' + DS.navy + ';text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">' + escapeHtml(b.title) + '</div><div style="font-size:13.5px;line-height:1.65;color:' + DS.text + ';text-align:justify;">' + nl2br(b.body) + '</div>' + (b.lsPick ? '<div style="background:' + DS.greenBg + ';border-left:3px solid ' + DS.green + ';padding:10px 14px;margin-top:10px;font-size:13px;line-height:1.55;color:' + DS.green + ';"><span style="font-weight:700;">LS View:</span> ' + nl2br(b.lsPick) + '</div>' : '') + renderNewsLinks(b.newsLinks) + '</div>').join("") + '</td></tr>' : "";

  // TRADE IDEAS
  const trade = s.sections.find(x => x.key === "tradeIdeas")?.on ? secHdr("Trade Ideas") + '<tr><td style="padding:0 40px 8px;"><div style="font-size:11px;font-weight:700;color:' + DS.navy + ';text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;padding-bottom:4px;">Equity \u2014 Research Top Picks</div>' + s.equityPicks.filter(p => p.ticker).map(p => {
    const info = allTickers.find(x => x.ticker === p.ticker);
    const ratingColor = info ? rc(info.rating) : DS.navy;
    // Exit-trigger renders as a "Change my mind:" callout below the
    // body when set. Visually compressed (smaller font, italic
    // muted) but with a tag so foreign PMs see the explicit
    // invalidation criterion at a glance \u2014 the thing that
    // distinguishes a real recommendation from a generic buy.
    const exitBlock = p.exitTrigger?.trim()
      ? '<div style="font-size:11px;color:' + DS.textMuted + ';margin-top:4px;padding-top:4px;border-top:1px dashed ' + DS.borderLight + ';"><span style="font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:' + DS.text + ';">Change my mind:</span> ' + escapeHtml(p.exitTrigger) + '</div>'
      : '';
    return '<div style="margin-bottom:10px;padding:10px 12px;background:' + DS.bgAlt + ';border-radius:4px;border-left:3px solid ' + ratingColor + ';"><div style="margin-bottom:3px;"><span style="font-size:14px;font-weight:700;color:' + DS.navy + ';letter-spacing:0.5px;">' + escapeHtml(p.ticker) + '</span>' + (info ? ' <span style="display:inline-block;font-size:10px;font-weight:700;color:' + ratingColor + ';background:' + rb(info.rating) + ';padding:2px 6px;border-radius:3px;margin-left:6px;text-transform:uppercase;">' + escapeHtml(info.rating) + '</span>' : '') + '</div>' + (info ? '<div style="font-size:11.5px;color:' + DS.textLight + ';margin-bottom:2px;">TP ' + escapeHtml(info.tp) + (info.last ? ' \u00B7 Last ' + escapeHtml(info.last) : '') + (info.tp && info.last ? ' \u00B7 <span style="color:' + upsideColor(info.tp, info.last) + ';font-weight:700;">' + fmtUpside(info.tp, info.last) + '</span>' : '') + '</div>' : '') + (p.reason ? '<div style="font-size:12.5px;color:' + DS.textMuted + ';font-style:italic;margin-top:2px;">' + escapeHtml(p.reason) + '</div>' : '') + exitBlock + '</div>';
  }).join("") + '<div style="border-top:1px solid ' + DS.borderLight + ';margin:18px 0;"></div><div style="font-size:11px;font-weight:700;color:' + DS.navy + ';text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;padding-bottom:4px;">Fixed Income</div>' + s.fiIdeas.filter(f => f.idea).map(f => '<div style="margin-bottom:10px;padding:10px 12px;background:' + DS.bgAlt + ';border-radius:4px;border-left:3px solid ' + DS.accent + ';"><div style="font-size:13.5px;line-height:1.55;color:' + DS.text + ';font-weight:600;">' + escapeHtml(f.idea) + '</div>' + (f.reason ? '<div style="font-size:12px;color:' + DS.textLight + ';font-style:italic;margin-top:3px;">' + escapeHtml(f.reason) + '</div>' : '') + '</div>').join("") + '</td></tr>' : "";

  // FLOWS — two instrument cards side by side. Each card has a
  // colored top stripe (navy for Equities, accent-blue for FI),
  // a tinted background to separate it from the white email body,
  // and a caps header that matches the stripe colour. Replaces the
  // previous "two unstyled columns separated by a thin gray border"
  // — the desk reported that layout made it hard to tell at a
  // glance which side was which instrument.
  //
  // Direction labels are now "Net Buyer" / "Net Seller" (was
  // "Buy" / "Sell") and rendered in the green / red brand colours
  // for a quick scan. Bold weight so the eye lands on direction
  // before reading the ticker list.
  //
  // Layout: 3-column outer table (card · spacer · card) so a CSS-
  // free email client still gets clean spacing. The middle td is
  // a thin gap rather than the previous border-left, which gives
  // each card breathing room without a hairline rule.
  const flowsCard = (
    label: string,
    headerColor: string,
    buyer: string,
    seller: string,
  ): string =>
    '<td width="48%" valign="top" style="background:' + DS.bgAlt + ';border:1px solid ' + DS.borderLight + ';border-top:3px solid ' + headerColor + ';border-radius:4px;">' +
      '<div style="padding:12px 14px;">' +
        '<div style="font-size:11px;font-weight:700;color:' + headerColor + ';text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;">' + label + '</div>' +
        '<div style="font-size:13px;line-height:1.8;color:' + DS.text + ';">' +
          '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + DS.green + ';margin-right:8px;vertical-align:middle;"></span>' +
          '<span style="font-weight:700;color:' + DS.green + ';">Net Buyer</span> ' + escapeHtml(buyer) +
          '<br>' +
          '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + DS.red + ';margin-right:8px;vertical-align:middle;"></span>' +
          '<span style="font-weight:700;color:' + DS.red + ';">Net Seller</span> ' + escapeHtml(seller) +
        '</div>' +
      '</div>' +
    '</td>';
  const flow = s.sections.find(x => x.key === "flows")?.on
    ? secHdr("LS Trading Desk Flows") + '<tr><td style="padding:0 40px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
        flowsCard("Equities", DS.navy, s.eqBuyer, s.eqSeller) +
        '<td width="4%" style="font-size:0;line-height:0;">&nbsp;</td>' +
        flowsCard("Fixed Income", DS.accent, s.fiBuyer, s.fiSeller) +
      '</tr></table></td></tr>'
    : "";

  // MACRO ESTIMATES — every user-input cell (source, col header,
  // row label, value) is escaped before interpolation.
  const mEst = s.sections.find(x => x.key === "macroEstimates")?.on ? secHdr("Macro Estimates") + '<tr><td style="padding:0 40px 8px;"><div style="font-size:10.5px;color:' + DS.textMuted + ';margin-bottom:8px;">Source: ' + escapeHtml(s.macroSource) + '</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ' + DS.border + ';"><tr style="background:' + DS.bgAlt + ';"><td style="padding:8px 12px;font-size:11px;font-weight:700;color:' + DS.navy + ';width:40%;border-bottom:1px solid ' + DS.border + ';"></td>' + s.macroCols.map(c => '<td style="padding:8px 12px;font-size:11px;font-weight:700;color:' + DS.navy + ';text-align:center;border-bottom:1px solid ' + DS.border + ';border-left:1px solid ' + DS.borderLight + ';">' + escapeHtml(c) + '</td>').join("") + '</tr>' + s.macroRows.map((r, i) => '<tr style="background:' + (i % 2 === 0 ? "#fff" : DS.bgAlt) + ';"><td style="padding:7px 12px;font-size:12.5px;font-weight:600;color:' + DS.text + ';border-bottom:1px solid ' + DS.borderLight + ';">' + escapeHtml(r.label) + '</td>' + s.macroCols.map(c => '<td style="padding:7px 12px;font-size:12.5px;color:' + DS.text + ';text-align:center;border-bottom:1px solid ' + DS.borderLight + ';border-left:1px solid ' + DS.borderLight + ';">' + escapeHtml(r.vals[c] || "") + '</td>').join("") + '</tr>').join("") + '</table></td></tr>' : "";

  // CORPORATE
  // Each block lists every ticker it covers as a coloured chip.
  // When a block covers 3+ tickers (e.g. a Banks 1Q26 wrap that
  // spans BBAR / BMA / GGAL / SUPV), the verbose "Overweight \u00B7 TP
  // US$XX.XX \u00B7 Last $YY.YY \u00B7 +Z%" chip wraps every chip onto its
  // own row \u2014 the section becomes a stack of fat chips that pushes
  // the body text well below the fold. Switch to a sell-side
  // shorthand ("OW", "TP", upside) for those crowded blocks; the
  // common 1-2 ticker case keeps the verbose treatment.
  const corp = s.sections.find(x => x.key === "corporate")?.on ? secHdr("Corporate") + '<tr><td style="padding:0 40px 8px;">' + s.corpBlocks.map(c => {
    const r = resolveCorporateBlock(c, s.analysts);
    const dense = r.covs.filter(cv => cv.ticker).length >= 3;
    const chipPad = dense ? "3px 8px" : "4px 10px";
    const chipFontSize = dense ? "10.5px" : "11px";
    const chipMargin = dense ? "margin-right:6px;margin-bottom:4px;" : "margin-right:8px;margin-bottom:4px;";
    const chips = r.covs.filter(cv => cv.ticker).map(cv => {
      // Rating label can be either the verbose word ("Overweight")
      // or the abbreviation (`ra(...)` returns "OW"). Both come from
      // the catalogue but escape defensively in case future data is
      // free-text. tp/last/ticker are all analyst-typed strings.
      const ratingLabel = dense ? ra(cv.rating) : cv.rating;
      const upside = cv.tp && cv.last
        ? ' \u00B7 <span style="color:' + upsideColor(cv.tp, cv.last) + ';font-weight:700;">' + escapeHtml(fmtUpside(cv.tp, cv.last)) + '</span>'
        : '';
      const last = !dense && cv.last ? ' \u00B7 ' + escapeHtml(cv.last) : '';
      return '<span style="display:inline-block;' + chipMargin + 'padding:' + chipPad + ';border-radius:4px;font-size:' + chipFontSize + ';background:' + rb(cv.rating) + ';border:1px solid ' + rc(cv.rating) + '30;"><span style="font-weight:700;color:' + rc(cv.rating) + ';">' + escapeHtml(cv.ticker) + '</span> <span style="color:' + DS.textLight + ';">' + escapeHtml(ratingLabel) + (cv.tp ? ' \u00B7 TP ' + escapeHtml(cv.tp) : '') + last + upside + '</span></span>';
    }).join("");
    // Tickers join is a plain `/` separator \u2014 each ticker escaped.
    // Headline + analyst-name strings are free-text \u2192 escape.
    return '<div style="margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid ' + DS.borderLight + ';"><div style="font-size:14px;font-weight:700;color:' + DS.navy + ';text-transform:uppercase;letter-spacing:0.3px;margin-bottom:8px;">' + r.tickers.map(escapeHtml).join(" / ") + ' \u2014 ' + escapeHtml(r.headline) + '</div><div style="margin-bottom:8px;">' + chips + '</div><div style="font-size:11.5px;color:' + DS.textMuted + ';font-style:italic;margin-bottom:6px;">' + escapeHtml(r.analyst) + '</div><div style="font-size:13.5px;line-height:1.65;color:' + DS.text + ';text-align:justify;">' + nl2br(r.body) + '</div>' + renderReportLink(r.link, { wrap: true }) + renderCallLink(c.callUrl, c.callDateTime) + renderNewsLinks(c.newsLinks) + '</div>';
  }).join("") + '</td></tr>' : "";

  // RESEARCH
  // Author resolution: prefer the catalogue analyst's display name
  // (via analystId) over the free-text `author` field — same pattern
  // as LatestReports / Corporate. Falls back to `author` for
  // external contributors.
  const research = s.sections.find(x => x.key === "research")?.on && s.researchReports?.length ? secHdr("Research Reports") + '<tr><td style="padding:0 40px 8px;">' + (s.researchReports || []).filter(r => r.title).map(r => {
    const resolvedAnalyst = r.analystId ? s.analysts.find((a) => a.id === r.analystId) : null;
    const authorName = resolvedAnalyst ? resolvedAnalyst.name : r.author;
    return '<div style="margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid ' + DS.borderLight + ';"><div style="margin-bottom:3px;"><span style="font-size:10px;font-weight:700;color:' + DS.accent + ';text-transform:uppercase;letter-spacing:1px;">' + escapeHtml(r.type) + '</span></div><div style="font-size:13.5px;font-weight:700;color:' + DS.navy + ';margin-bottom:2px;">' + escapeHtml(r.title) + '</div>' + (authorName ? '<div style="font-size:11.5px;color:' + DS.textMuted + ';font-style:italic;margin-bottom:4px;">' + escapeHtml(authorName) + '</div>' : '') + (r.body ? '<div style="font-size:13px;line-height:1.6;color:' + DS.text + ';text-align:justify;">' + nl2br(r.body) + '</div>' : '') + renderReportLink(r.link, { wrap: true }) + '</div>';
  }).join("") + '</td></tr>' : "";

  // LATEST RESEARCH REPORTS — compact one-line-per-deal digest.
  // Each row: [TYPE] Title — Author · Date            [Full report]
  // The desk wants every report to fit on a single line so a quick
  // scan of the section reads like a publishing index, not a list
  // of mini-articles. Email-safe two-column table layout: meta on
  // the left, CTA pinned to the right. Wraps gracefully on narrow
  // mobile widths (the right cell drops below the left).
  //
  // Author resolution: prefers `analystId` (catalogue analyst's
  // display name + title) over the free-text `author` field.
  // publishedDate is rendered through fmtEventDate for "May 6,
  // 2026" formatting — matches Events / Bond Pipeline.
  const latestReportsRows = (s.latestReports || []).filter(r => r.title?.trim());
  const latestReports = s.sections.find(x => x.key === "latestReports")?.on && latestReportsRows.length
    ? secHdr("Latest Research Reports") + '<tr><td style="padding:0 40px 8px;">' + latestReportsRows.map(r => {
        const tag = r.type?.trim() ? '<span style="display:inline-block;font-size:9.5px;font-weight:700;color:' + DS.accent + ';text-transform:uppercase;letter-spacing:1px;background:' + DS.bgAlt + ';padding:2px 8px;border-radius:3px;margin-right:8px;vertical-align:middle;">' + escapeHtml(r.type) + '</span>' : '';
        const titleEl = '<span style="color:' + DS.navy + ';font-weight:700;">' + escapeHtml(r.title) + '</span>';
        const resolvedAnalyst = r.analystId ? s.analysts.find((a) => a.id === r.analystId) : null;
        const authorName = resolvedAnalyst ? resolvedAnalyst.name : r.author?.trim();
        const dateLabel = r.publishedDate?.trim() ? fmtEventDate(r.publishedDate) : "";
        // Pre-escape meta parts individually so any embedded HTML
        // metacharacter in author name / date is neutralised.
        const metaParts = [authorName, dateLabel].filter(Boolean).map(escapeHtml).join(" · ");
        const metaEl = metaParts
          ? '<span style="font-size:11.5px;color:' + DS.textMuted + ';font-style:italic;margin-left:6px;white-space:nowrap;">— ' + metaParts + '</span>'
          : "";
        const safeLink = safeUrl(r.link);
        const ctaEl = safeLink
          ? '<a href="' + safeLink + '" style="font-size:11px;color:#fff;background:' + DS.accent + ';padding:3px 10px;border-radius:4px;text-decoration:none;font-weight:600;display:inline-block;white-space:nowrap;">Full report &#8594;</a>'
          : "";
        // Email-safe table for the row — `<table>` rather than flex
        // because Outlook desktop doesn't honour flex. Left cell
        // takes the natural width of the content; right cell stays
        // tight to the CTA, right-aligned.
        return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid ' + DS.borderLight + ';margin:0;"><tr>' +
          '<td valign="middle" style="padding:8px 0;font-size:13px;line-height:1.5;">' + tag + titleEl + metaEl + '</td>' +
          (ctaEl ? '<td valign="middle" align="right" style="padding:8px 0 8px 10px;white-space:nowrap;">' + ctaEl + '</td>' : '') +
        '</tr></table>';
      }).join("") + '</td></tr>'
    : "";

  // BOND PIPELINE — primary-market new-issue tracker. 3-column
  // table (Issuer · Pricing date · Estimated size). Rows with
  // empty issuer are filtered (analysts often add a placeholder
  // row then remove it). Date is rendered through fmtEventDate
  // for "May 12, 2026" style consistency with the rest of the
  // email; pre-announcement deals with no firm date show "TBD".
  const bondPipelineRows = (s.bondPipeline || []).filter(b => b.issuer?.trim());
  const bondPipeline = s.sections.find(x => x.key === "bondPipeline")?.on && bondPipelineRows.length
    ? secHdr("Bond Pipeline") + '<tr><td style="padding:0 40px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ' + DS.border + ';">' +
        '<tr style="background:' + DS.bgAlt + ';">' +
          '<td style="padding:7px 12px;font-size:11px;font-weight:700;color:' + DS.navy + ';border-bottom:1px solid ' + DS.border + ';">Issuer</td>' +
          '<td style="padding:7px 12px;font-size:11px;font-weight:700;color:' + DS.navy + ';border-bottom:1px solid ' + DS.border + ';border-left:1px solid ' + DS.borderLight + ';">Pricing</td>' +
          '<td style="padding:7px 12px;font-size:11px;font-weight:700;color:' + DS.navy + ';text-align:right;border-bottom:1px solid ' + DS.border + ';border-left:1px solid ' + DS.borderLight + ';">Estimated Size</td>' +
        '</tr>' +
        bondPipelineRows.map((b, i) => {
          const date = b.pricingDate?.trim() ? fmtEventDate(b.pricingDate) : "TBD";
          const size = b.estimatedSize?.trim() || "—";
          return '<tr style="background:' + (i % 2 === 0 ? "#fff" : DS.bgAlt) + ';">' +
            '<td style="padding:7px 12px;font-size:13px;font-weight:600;color:' + DS.text + ';border-bottom:1px solid ' + DS.borderLight + ';">' + escapeHtml(b.issuer) + '</td>' +
            '<td style="padding:7px 12px;font-size:12.5px;color:' + DS.text + ';border-bottom:1px solid ' + DS.borderLight + ';border-left:1px solid ' + DS.borderLight + ';">' + escapeHtml(date) + '</td>' +
            '<td style="padding:7px 12px;font-size:12.5px;color:' + DS.text + ';text-align:right;border-bottom:1px solid ' + DS.borderLight + ';border-left:1px solid ' + DS.borderLight + ';">' + escapeHtml(size) + '</td>' +
          '</tr>';
        }).join("") +
      '</table></td></tr>'
    : "";

  // TOP MOVERS
  const topMoversGainers: typeof s.topMovers.gainers = s.topMovers?.gainers?.filter(m => m.ticker) || [];
  const topMoversLosers: typeof s.topMovers.losers = s.topMovers?.losers?.filter(m => m.ticker) || [];
  const topMovers = s.sections.find(x => x.key === "topMovers")?.on && (topMoversGainers.length || topMoversLosers.length) ? secHdr("Top Movers") + '<tr><td style="padding:0 40px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ' + DS.border + ';"><tr style="background:' + DS.bgAlt + ';"><td style="padding:7px 12px;font-size:11px;font-weight:700;color:' + DS.navy + ';border-bottom:1px solid ' + DS.border + ';">Ticker</td><td style="padding:7px 12px;font-size:11px;font-weight:700;color:' + DS.navy + ';text-align:right;border-bottom:1px solid ' + DS.border + ';">Chg</td><td style="padding:7px 12px;font-size:11px;font-weight:700;color:' + DS.navy + ';border-bottom:1px solid ' + DS.border + ';">Comment</td></tr>' + topMoversGainers.map((m, i) => '<tr style="background:' + (i % 2 === 0 ? "#fff" : DS.bgAlt) + ';"><td style="padding:6px 12px;font-size:12.5px;font-weight:600;color:' + DS.text + ';border-bottom:1px solid ' + DS.borderLight + ';">' + escapeHtml(m.ticker) + '</td><td style="padding:6px 12px;font-size:12.5px;font-weight:700;color:' + DS.green + ';text-align:right;border-bottom:1px solid ' + DS.borderLight + ';">+' + escapeHtml(m.chgPct) + '%</td><td style="padding:6px 12px;font-size:12px;color:' + DS.textLight + ';border-bottom:1px solid ' + DS.borderLight + ';">' + escapeHtml(m.comment || "") + '</td></tr>').join("") + topMoversLosers.map((m, i) => '<tr style="background:' + (i % 2 === 0 ? "#fff" : DS.bgAlt) + ';"><td style="padding:6px 12px;font-size:12.5px;font-weight:600;color:' + DS.text + ';border-bottom:1px solid ' + DS.borderLight + ';">' + escapeHtml(m.ticker) + '</td><td style="padding:6px 12px;font-size:12.5px;font-weight:700;color:' + DS.red + ';text-align:right;border-bottom:1px solid ' + DS.borderLight + ';">' + escapeHtml(m.chgPct) + '%</td><td style="padding:6px 12px;font-size:12px;color:' + DS.textLight + ';border-bottom:1px solid ' + DS.borderLight + ';">' + escapeHtml(m.comment || "") + '</td></tr>').join("") + '</table></td></tr>' : "";

  // TWEETS
  const tweets = s.sections.find(x => x.key === "tweets")?.on && s.tweets?.length ? secHdr("Market Noise") + '<tr><td style="padding:0 40px 8px;">' + s.tweets.filter(t => t.content).map(t => { const sColor = t.sentiment === "Bullish" ? DS.green : t.sentiment === "Bearish" ? DS.red : DS.textMuted; return '<div style="margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid ' + DS.borderLight + ';"><div style="margin-bottom:4px;font-size:11px;"><span style="color:' + sColor + ';font-weight:700;text-transform:uppercase;">' + escapeHtml(t.sentiment) + '</span>' + (t.impactType && t.impactValue ? ' <span style="color:' + DS.textMuted + ';"> \u00B7 ' + escapeHtml(t.impactType) + ': ' + escapeHtml(t.impactValue) + '</span>' : '') + (t.time ? ' <span style="color:' + DS.textMuted + ';"> \u00B7 ' + escapeHtml(t.time) + '</span>' : '') + '</div><div style="font-size:13.5px;line-height:1.6;color:' + DS.text + ';text-align:justify;">' + nl2br(t.content) + '</div>' + renderReportLink(t.link, { wrap: true, label: "Source &#8594;" }) + '</div>'; }).join("") + '</td></tr>' : "";

  // BCRA
  const bcra = s.sections.find(x => x.key === "bcra")?.on && s.bcraData ? (() => { const hidden = s.bcraHiddenRows || {}; const entries = Object.entries(s.bcraData).filter(([k]) => !hidden[k]); if (!entries.length) return ""; return secHdr("BCRA Dashboard") + '<tr><td style="padding:0 40px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ' + DS.border + ';"><tr style="background:' + DS.bgAlt + ';"><td style="padding:7px 12px;font-size:11px;font-weight:700;color:' + DS.navy + ';border-bottom:1px solid ' + DS.border + ';">Indicator</td><td style="padding:7px 12px;font-size:11px;font-weight:700;color:' + DS.navy + ';text-align:right;border-bottom:1px solid ' + DS.border + ';">Value</td></tr>' + entries.map(([k, v], i) => '<tr style="background:' + (i % 2 === 0 ? "#fff" : DS.bgAlt) + ';"><td style="padding:6px 12px;font-size:12.5px;font-weight:600;color:' + DS.text + ';border-bottom:1px solid ' + DS.borderLight + ';">' + escapeHtml(k) + '</td><td style="padding:6px 12px;font-size:12.5px;color:' + DS.text + ';text-align:right;border-bottom:1px solid ' + DS.borderLight + ';">' + escapeHtml(String(v)) + '</td></tr>').join("") + '</table></td></tr>'; })() : "";

  // EVENTS AND WEBINARS — analyst access events, conference calls,
  // earnings webinars, etc. The catalogue label was renamed in the
  // same pass that removed yesterdayRecap and snapshot.
  const events = s.sections.find(x => x.key === "events")?.on && s.events?.length ? secHdr("Events and Webinars") + '<tr><td style="padding:0 40px 8px;">' + s.events.filter(e => e.title).map(e => {
    const times = [e.timeET ? 'ET ' + fmtTime(e.timeET) : '', e.timeBUE ? 'BUE ' + fmtTime(e.timeBUE) : '', e.timeLON ? 'LON ' + fmtTime(e.timeLON) : ''].filter(Boolean).map(escapeHtml).join(' \u00B7 ');
    return '<div style="margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid ' + DS.borderLight + ';">' +
      '<div style="margin-bottom:3px;"><span style="font-size:10px;font-weight:700;color:' + DS.accent + ';text-transform:uppercase;letter-spacing:1px;">' + escapeHtml(e.type) + '</span></div>' +
      '<div style="font-size:13.5px;font-weight:700;color:' + DS.navy + ';margin-bottom:2px;">' + escapeHtml(e.title) + '</div>' +
      '<div style="font-size:11.5px;color:' + DS.textMuted + ';margin-bottom:4px;">' + (e.date ? escapeHtml(fmtEventDate(e.date)) : '') + (times ? ' \u00B7 ' + times : '') + '</div>' +
      (e.description ? '<div style="font-size:13px;line-height:1.6;color:' + DS.text + ';text-align:justify;">' + nl2br(e.description) + '</div>' : '') +
      renderReportLink(e.link, { wrap: true, label: "Register / Details &#8594;" }) +
      '</div>';
  }).join("") + '</td></tr>' : "";

  // KEY EVENTS
  const keyEvents = s.sections.find(x => x.key === "keyEvents")?.on && s.keyEvents?.length ? secHdr("Key Events Calendar") + '<tr><td style="padding:0 40px 8px;">' + s.keyEvents.filter(e => e.event).map(e => '<div style="padding:4px 0;font-size:13px;color:' + DS.text + ';"><span style="font-weight:700;color:' + DS.navy + ';margin-right:10px;">' + escapeHtml(e.date ? fmtEventDate(e.date) : "") + '</span>' + escapeHtml(e.event) + '</div>').join("") + '</td></tr>' : "";

  // CHART \u2014 base64 src is generated by the analyst's browser via
  // FileReader; not directly user-typed text but defensive escape
  // on title / caption / alt attrs to neutralise quotes that would
  // break out of the attribute context.
  const chart = s.sections.find(x => x.key === "chart")?.on && s.chartImage?.base64 ? secHdr("Chart of the Day") + '<tr><td style="padding:0 40px 8px;">' + (s.chartImage.title ? '<div style="font-size:13.5px;font-weight:700;color:' + DS.navy + ';margin-bottom:10px;">' + escapeHtml(s.chartImage.title) + '</div>' : '') + '<img src="' + s.chartImage.base64 + '" alt="' + escapeHtml(s.chartImage.title || "Chart") + '" style="max-width:100%;height:auto;display:block;border:1px solid ' + DS.borderLight + ';" />' + (s.chartImage.caption ? '<div style="font-size:11px;color:' + DS.textMuted + ';font-style:italic;margin-top:6px;">' + escapeHtml(s.chartImage.caption) + '</div>' : '') + '</td></tr>' : "";

  // SIGNATURES \u2014 `email` is rendered as plain text (not a mailto:);
  // every field is analyst-typed, so escape all three.
  const sig = s.signatures.map(x => '<div style="margin-bottom:6px;"><span style="font-size:13px;font-weight:600;color:' + DS.navy + ';">' + escapeHtml(x.name) + '</span><span style="font-size:12px;color:' + DS.textLight + ';margin-left:6px;">' + escapeHtml(x.role) + '</span><br><span style="font-size:12px;color:' + DS.accent + ';">' + escapeHtml(x.email) + '</span></div>').join("");

  // SECTION MAP
  const sectionMap: Record<string, string> = { watchToday, marketComment, macro, tradeIdeas: trade, flows: flow, corporate: corp, research, latestReports, bondPipeline, topMovers, tweets, latam, bcra, events, macroEstimates: mEst, chart };
  const enabledSections = s.sections.filter(x => x.on);

  // Build Table of Contents
  const tocBlock = '<tr><td style="padding:20px 40px 4px;"><div style="font-size:10px;font-weight:700;color:' + DS.navy + ';text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">In This Issue</div>' + enabledSections.map((sec, i) => '<a href="#sec-' + sec.key + '" style="display:inline-block;font-size:12px;color:' + DS.accent + ';text-decoration:none;margin-right:6px;margin-bottom:4px;">' + SEC_LABELS[sec.key] + (i < enabledSections.length - 1 ? ' <span style="color:' + DS.textMuted + ';">&middot;</span>' : '') + '</a>').join("") + '</td></tr>';

  // Build compact summaries (1-line per section). All free-text
  // strings pass through escapeHtml when written into compactBlock
  // below (a single escape at the consumer site is simpler than
  // escaping each leaf above).
  const compactSummaries = {
    macro: s.macroBlocks.length ? s.macroBlocks.map(b => b.title).join(", ") : "",
    tradeIdeas: s.equityPicks.filter(p => p.ticker).map(p => p.ticker).join(", ") + (s.fiIdeas.filter(f => f.idea).length ? " + " + s.fiIdeas.filter(f => f.idea).length + " FI ideas" : ""),
    flows: "EQ Net Buyer: " + (s.eqBuyer || "...").substring(0, 30) + " | FI Net Buyer: " + (s.fiBuyer || "...").substring(0, 30),
    macroEstimates: s.macroRows.length + " metrics, " + s.macroCols.join("/"),
    marketComment: (() => {
      const t = s.marketComment?.trim() || "";
      return t ? t.slice(0, 80) + (t.length > 80 ? "…" : "") : "";
    })(),
    corporate: s.corpBlocks.map(c => (c.tickers || []).join("/")).filter(Boolean).join(", "),
    research: (s.researchReports || []).filter(r => r.title).map(r => r.title).join(", "),
    latestReports: (s.latestReports || []).filter(r => r.title).map(r => r.title).join(", "),
    bondPipeline: (s.bondPipeline || []).filter(b => b.issuer).length ? (s.bondPipeline || []).filter(b => b.issuer).length + " deals" : "",
    topMovers: topMoversGainers.map(m => m.ticker + " +" + m.chgPct + "%").concat(topMoversLosers.map(m => m.ticker + " " + m.chgPct + "%")).join(", "),
    tweets: s.tweets?.length ? s.tweets.length + " posts" : "",
    bcra: s.bcraData ? Object.keys(s.bcraData).length + " indicators" : "",
    events: s.events?.length ? s.events.length + " events" : "",
    keyEvents: s.keyEvents?.length ? s.keyEvents.length + " events" : "",
    chart: s.chartImage?.title || "Chart attached",
  };

  const compactBlock = enabledSections.map(sec => {
    const summary = compactSummaries[sec.key as keyof typeof compactSummaries];
    if (!summary) return "";
    // Use an email-safe `<table>` row rather than `display:flex` —
    // Word renderer ignores flex and stacks the label / summary.
    return '<tr><td style="padding:4px 40px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid ' + DS.borderLight + ';"><tr><td valign="top" style="padding:8px 0;font-size:11px;font-weight:700;color:' + DS.navy + ';text-transform:uppercase;letter-spacing:1px;width:140px;">' + escapeHtml(SEC_LABELS[sec.key] || sec.key) + '</td><td valign="top" style="padding:8px 0 8px 12px;font-size:12.5px;color:' + DS.textLight + ';">' + escapeHtml(summary) + '</td></tr></table></td></tr>';
  }).join("");

  let sectionContent: string;
  if (mode === "compact") {
    sectionContent = '<tr><td style="padding:20px 40px 4px;"><div style="font-size:10px;font-weight:700;color:' + DS.navy + ';text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;">Summary</div></td></tr>' + compactBlock;
  } else if (mode === "toc") {
    sectionContent = tocBlock + enabledSections.map(x => sectionMap[x.key] || "").join("");
  } else if (template === "flash") {
    // Flash template: only snapshot, watch, macro (first block), and picks
    const flashKeys = ["snapshot", "watchToday", "macro", "tradeIdeas"];
    sectionContent = enabledSections.filter(x => flashKeys.includes(x.key)).map(x => sectionMap[x.key] || "").join("");
  } else if (template === "executive") {
    // Executive: summary bar + macro + trade ideas + corporate headlines only
    const execKeys = ["macro", "tradeIdeas", "corporate"];
    sectionContent = enabledSections.filter(x => execKeys.includes(x.key)).map(x => sectionMap[x.key] || "").join("");
  } else {
    sectionContent = enabledSections.map(x => sectionMap[x.key] || "").join("");
  }

  // FULL TEMPLATE
  // MSO conditional: tells Outlook (Word renderer) to use 96 DPI, allow PNGs,
  // and apply Arial-fallback for cells. The xmlns:v and xmlns:o on <html> are
  // required for the v:* / o:* tags Outlook relies on. The color-scheme metas
  // tell Apple Mail to NOT auto-invert this email's palette in dark mode (we
  // already use a navy/white scheme that reads well on both).
  return '<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="format-detection" content="telephone=no, date=no, address=no, email=no"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"><title>Argentina Daily</title>'
    + '<!--[if mso]><style type="text/css">table,td,div,h1,h2,p,a {font-family:Arial,Helvetica,sans-serif !important;} table {border-collapse:collapse !important;} img {border:0;line-height:100%;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}</style><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch><o:AllowPNG/></o:OfficeDocumentSettings></xml><![endif]-->'
    + '</head><body style="margin:0;padding:0;background:#f4f5f7;font-family:\'Segoe UI\',Calibri,Arial,Helvetica,sans-serif;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f5f7;"><tr><td align="center" style="padding:24px 10px;"><table role="presentation" width="' + DS.maxW + '" cellpadding="0" cellspacing="0" border="0" style="max-width:' + DS.maxW + 'px;width:100%;background:#fff;border:1px solid ' + DS.borderLight + ';">'

    // HEADER
    + '<tr><td style="background:' + DS.navy + ';padding:36px 40px 30px;">'
    + '<img src="' + logoW + '" alt="Latin Securities" width="180" height="45" style="width:180px;height:45px;display:block;margin-bottom:24px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />'
    + '<div style="font-size:24px;font-weight:300;color:#fff;letter-spacing:-0.3px;">Argentina Daily</div>'
    + '<div style="margin-top:6px;"><span style="font-size:13px;color:rgba(255,255,255,0.55);font-weight:400;">' + formatDate(s.date) + '</span><span style="font-size:10px;color:' + DS.sky + ';font-weight:600;text-transform:uppercase;letter-spacing:1.5px;margin-left:16px;border:1px solid rgba(51,153,255,0.3);padding:3px 10px;border-radius:3px;">Sales &amp; Trading</span></div>'
    + '</td></tr>'

    // ACCENT LINE
    + '<tr><td style="height:3px;background:linear-gradient(90deg,' + DS.sky + ',' + DS.accent + ');"></td></tr>'

    // SUMMARY BAR — `s.summaryBar` is analyst free-text → escape.
    + (s.summaryBar ? '<tr><td style="padding:20px 40px 0;"><div style="border-left:3px solid ' + DS.accent + ';padding:12px 16px;background:' + DS.bgAlt + ';font-size:13.5px;line-height:1.6;color:' + DS.text + ';text-align:justify;"><strong style="color:' + DS.navy + ';">Today</strong> ' + escapeHtml(s.summaryBar) + '</div></td></tr>' : '')

    // SECTIONS
    + sectionContent

    // SIGNATURE
    // Width/height match the source PNG's 3.98:1 aspect (1600×402).
    // 120×30 is the correct fit; 120×32 was vertically squashing the
    // glyphs ~6% — analysts described it as "looking cut off".
    + '<tr><td style="padding:24px 40px 0;border-top:1px solid ' + DS.border + ';"><img src="' + logo + '" alt="Latin Securities" width="120" height="30" style="width:120px;height:30px;display:block;margin-bottom:14px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />' + sig + '</td></tr>'

    // FOOTER \u2014 disclaimer is analyst-editable (legal team can swap
    // it via the editor), so escape. Unsubscribe URL is built from
    // window.location.origin + a constant token; safe to interpolate
    // raw but pass through safeUrl as defensive measure.
    + '<tr><td style="padding:20px 40px 24px;"><div style="border-top:1px solid ' + DS.borderLight + ';padding-top:16px;"><div style="font-size:10px;font-weight:600;color:' + DS.textMuted + ';text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Latin Securities S.A.</div><div style="font-size:9.5px;color:' + DS.textMuted + ';line-height:1.6;">Arenales 707, 6th Floor \u00B7 Buenos Aires, Argentina \u00B7 <a href="https://www.latinsecurities.com.ar" style="color:' + DS.accent + ';text-decoration:none;">latinsecurities.com.ar</a></div><div style="font-size:10px;color:' + DS.textMuted + ';line-height:1.6;margin-top:10px;">Don\'t want these emails? <a href="' + safeUrl(unsubscribeUrl()) + '" style="color:' + DS.accent + ';text-decoration:underline;">Unsubscribe</a>.</div><div style="font-size:9px;color:#b0b0b0;line-height:1.5;margin-top:10px;">' + escapeHtml(s.disclaimer || 'This material has been prepared by Latin Securities S.A. for informational purposes only.') + ' \u00A9 ' + new Date().getFullYear() + ' Latin Securities S.A. All rights reserved.</div></div></td></tr>'

    + '</table></td></tr></table></body></html>';
}

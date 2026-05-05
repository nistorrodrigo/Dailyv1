import { BRAND } from "../constants/brand";
import { getLogoWhiteB64, getLogoOrigB64 } from "../constants/logos";
import { formatDate, fmtEventDate, fmtTime } from "./dates";
import { rc, rb, ra, resolveCorporateBlock } from "./ratings";
import { fmtUpside, upsideColor, calcUpside } from "./prices";
import { nl2br } from "./text";
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
 * Public URL for the /api/unsubscribe endpoint. Resolves at runtime so the
 * link works whether the email is generated locally (`http://localhost:5173`)
 * or in production (`https://dailyv1.vercel.app`). Falls back to the prod
 * URL when there's no `window` (i.e. inside vitest's happy-dom tests).
 */
function unsubscribeUrl(): string {
  const origin = typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : "https://dailyv1.vercel.app";
  return `${origin}/api/unsubscribe?email=${UNSUBSCRIBE_EMAIL_TOKEN}`;
}

/** Tiny "Sources: <a> · <a>" footer for blocks that have news links. */
function renderNewsLinks(links: NewsLink[] | undefined): string {
  if (!links || !links.length) return "";
  const valid = links.filter((l) => l.url && l.url.trim());
  if (!valid.length) return "";
  const items = valid
    .map((l) => '<a href="' + l.url + '" style="color:#1e5ab0;text-decoration:none;font-weight:600;">' + (l.label.trim() || hostOf(l.url)) + ' ↗</a>')
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
  if (!url || !url.trim()) return "";
  const label = opts.label || "Full report &#8594;";
  // Compact variant — half the padding and a tick smaller font, for
  // digest-style sections (Latest Reports) where the button sits
  // inside a tight one-line-per-item row and a full-size CTA looks
  // out of proportion.
  const padding = opts.compact ? "3px 10px" : "6px 14px";
  const fontSize = opts.compact ? "11px" : "12px";
  const link =
    '<a href="' + url +
    '" style="font-size:' + fontSize + ';color:#fff;background:#1e5ab0;padding:' + padding + ';border-radius:4px;text-decoration:none;font-weight:600;display:inline-block;">' +
    label + '</a>';
  // `wrap` adds a small top margin so the button sits cleanly below
  // a body paragraph (Corporate / Research bodies). Skip wrapping
  // when the caller is placing the button inline in a compact row
  // (Latest Reports digest, Events row).
  return opts.wrap ? '<div style="margin-top:' + (opts.compact ? "4px" : "8px") + ';">' + link + '</div>' : link;
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
  yesterdayRecap: "Yesterday in Review",
  snapshot: "Market Snapshot", watchToday: "What to Watch Today",
  marketComment: "Market Comment",
  macro: "Macro / Political", tradeIdeas: "Trade Ideas", flows: "Market Color",
  corporate: "Corporate", research: "Research Reports",
  latestReports: "Latest Research Reports",
  topMovers: "Top Movers", tweets: "Market Intelligence", latam: "LatAm Context",
  bcra: "BCRA Dashboard", events: "Upcoming", macroEstimates: "Macro Estimates",
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
  const logo: string = getLogoOrigB64();
  const logoW: string = getLogoWhiteB64();
  const allTickers = s.analysts.flatMap(a => a.coverage.map(c => ({ ticker: c.ticker, rating: c.rating, tp: c.tp, last: c.last || "", analyst: a.name })));

  // SNAPSHOT
  const snp = s.snapshot;
  const snpRows = [
    ["Merval", snp.merval, snp.mervalChg], ["ADRs", snp.adrs, snp.adrsChg], ["S&P 500", snp.sp500, snp.sp500Chg],
    ["UST 10Y", snp.ust10y, ""], ["DXY", snp.dxy, ""], ["Soja", snp.soja, ""], ["WTI", snp.wti, ""],
    ["CCL", snp.ccl, snp.cclChg], ["MEP", snp.mep, snp.mepChg], ["Blue", snp.blue, ""],
  ].filter(r => r[1]);
  const snapshot = s.sections.find(x => x.key === "snapshot")?.on && snpRows.length ? secHdr("Market Snapshot") + '<tr><td style="padding:0 40px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ' + DS.border + ';">' + snpRows.map((r, i) => { const chgColor = (r[2] || "").startsWith("-") ? DS.red : DS.green; return '<tr style="background:' + (i % 2 === 0 ? "#fff" : DS.bgAlt) + ';"><td style="padding:5px 12px;font-size:12px;font-weight:600;color:' + DS.navy + ';border-bottom:1px solid ' + DS.borderLight + ';width:30%;">' + r[0] + '</td><td style="padding:5px 12px;font-size:13px;font-weight:700;color:' + DS.text + ';text-align:right;border-bottom:1px solid ' + DS.borderLight + ';">' + r[1] + '</td><td style="padding:5px 12px;font-size:12px;font-weight:700;color:' + chgColor + ';text-align:right;border-bottom:1px solid ' + DS.borderLight + ';width:20%;">' + (r[2] ? r[2] + '%' : '') + '</td></tr>'; }).join("") + '</table></td></tr>' : "";

  // YESTERDAY IN REVIEW — credibility hook at the very top of the
  // daily for institutional readers. Visually distinct (orange-toned
  // background) to stand apart from the rest of the structure and
  // signal "this is the prior-day score, not a forecast".
  const yesterdayRecap = s.sections.find(x => x.key === "yesterdayRecap")?.on && s.yesterdayRecap?.trim()
    ? '<tr><td style="padding:24px 40px 0;" id="sec-yesterdayRecap">' +
        '<div style="background:#fff7ec;border-left:4px solid #e67e22;padding:14px 18px;border-radius:4px;">' +
          '<div style="font-size:10px;font-weight:700;color:#e67e22;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">Yesterday in Review</div>' +
          '<div style="font-size:13.5px;line-height:1.65;color:' + DS.text + ';text-align:justify;">' + nl2br(s.yesterdayRecap) + '</div>' +
        '</div>' +
      '</td></tr>'
    : "";

  // WHAT TO WATCH
  const watchItems = (s.watchToday || []).filter((w: string) => w.trim());
  const watchToday = s.sections.find(x => x.key === "watchToday")?.on && watchItems.length ? secHdr("What to Watch Today") + '<tr><td style="padding:0 40px 8px;">' + watchItems.map((w: string) => '<div style="padding:6px 0;font-size:13.5px;line-height:1.55;color:' + DS.text + ';"><span style="color:#e67e22;font-weight:700;margin-right:8px;">&#9656;</span>' + w + '</div>').join("") + '</td></tr>' : "";

  // MARKET COMMENT — single free-form prose block.
  const marketComment = s.sections.find(x => x.key === "marketComment")?.on && s.marketComment?.trim()
    ? secHdr("Market Comment") + '<tr><td style="padding:0 40px 8px;"><div style="font-size:13.5px;line-height:1.65;color:' + DS.text + ';text-align:justify;">' + nl2br(s.marketComment) + '</div></td></tr>'
    : "";

  // LATAM CONTEXT
  const latam = s.sections.find(x => x.key === "latam")?.on && s.latam ? secHdr("LatAm Context") + '<tr><td style="padding:0 40px 8px;"><div style="font-size:13.5px;line-height:1.65;color:' + DS.text + ';text-align:justify;">' + nl2br(s.latam) + '</div></td></tr>' : "";

  // MACRO
  const macro = s.sections.find(x => x.key === "macro")?.on ? secHdr("Macro / Political") + '<tr><td style="padding:0 40px 8px;">' + s.macroBlocks.map(b => '<div style="margin-bottom:20px;"><div style="font-size:13px;font-weight:700;color:' + DS.navy + ';text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">' + b.title + '</div><div style="font-size:13.5px;line-height:1.65;color:' + DS.text + ';text-align:justify;">' + nl2br(b.body) + '</div>' + (b.lsPick ? '<div style="background:' + DS.greenBg + ';border-left:3px solid ' + DS.green + ';padding:10px 14px;margin-top:10px;font-size:13px;line-height:1.55;color:' + DS.green + ';"><span style="font-weight:700;">LS View:</span> ' + nl2br(b.lsPick) + '</div>' : '') + renderNewsLinks(b.newsLinks) + '</div>').join("") + '</td></tr>' : "";

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
      ? '<div style="font-size:11px;color:' + DS.textMuted + ';margin-top:4px;padding-top:4px;border-top:1px dashed ' + DS.borderLight + ';"><span style="font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:' + DS.text + ';">Change my mind:</span> ' + p.exitTrigger + '</div>'
      : '';
    return '<div style="margin-bottom:10px;padding:10px 12px;background:' + DS.bgAlt + ';border-radius:4px;border-left:3px solid ' + ratingColor + ';"><div style="margin-bottom:3px;"><span style="font-size:14px;font-weight:700;color:' + DS.navy + ';letter-spacing:0.5px;">' + p.ticker + '</span>' + (info ? ' <span style="display:inline-block;font-size:10px;font-weight:700;color:' + ratingColor + ';background:' + rb(info.rating) + ';padding:2px 6px;border-radius:3px;margin-left:6px;text-transform:uppercase;">' + info.rating + '</span>' : '') + '</div>' + (info ? '<div style="font-size:11.5px;color:' + DS.textLight + ';margin-bottom:2px;">TP ' + info.tp + (info.last ? ' \u00B7 Last ' + info.last : '') + (info.tp && info.last ? ' \u00B7 <span style="color:' + upsideColor(info.tp, info.last) + ';font-weight:700;">' + fmtUpside(info.tp, info.last) + '</span>' : '') + '</div>' : '') + (p.reason ? '<div style="font-size:12.5px;color:' + DS.textMuted + ';font-style:italic;margin-top:2px;">' + p.reason + '</div>' : '') + exitBlock + '</div>';
  }).join("") + '<div style="border-top:1px solid ' + DS.borderLight + ';margin:18px 0;"></div><div style="font-size:11px;font-weight:700;color:' + DS.navy + ';text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;padding-bottom:4px;">Fixed Income</div>' + s.fiIdeas.filter(f => f.idea).map(f => '<div style="margin-bottom:10px;padding:10px 12px;background:' + DS.bgAlt + ';border-radius:4px;border-left:3px solid ' + DS.accent + ';"><div style="font-size:13.5px;line-height:1.55;color:' + DS.text + ';font-weight:600;">' + f.idea + '</div>' + (f.reason ? '<div style="font-size:12px;color:' + DS.textLight + ';font-style:italic;margin-top:3px;">' + f.reason + '</div>' : '') + '</div>').join("") + '</td></tr>' : "";

  // FLOWS
  const flow = s.sections.find(x => x.key === "flows")?.on ? secHdr("LS Trading Desk Flows") + '<tr><td style="padding:0 40px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="50%" valign="top" style="padding-right:16px;"><div style="font-size:11px;font-weight:700;color:' + DS.navy + ';text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Equities</div><div style="font-size:13px;line-height:1.8;color:' + DS.text + ';"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + DS.green + ';margin-right:6px;vertical-align:middle;"></span><span style="font-weight:600;">Buy</span> ' + s.eqBuyer + '<br><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + DS.red + ';margin-right:6px;vertical-align:middle;"></span><span style="font-weight:600;">Sell</span> ' + s.eqSeller + '</div></td><td width="50%" valign="top" style="padding-left:16px;border-left:2px solid ' + DS.borderLight + ';"><div style="font-size:11px;font-weight:700;color:' + DS.navy + ';text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Fixed Income</div><div style="font-size:13px;line-height:1.8;color:' + DS.text + ';"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + DS.green + ';margin-right:6px;vertical-align:middle;"></span><span style="font-weight:600;">Buy</span> ' + s.fiBuyer + '<br><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + DS.red + ';margin-right:6px;vertical-align:middle;"></span><span style="font-weight:600;">Sell</span> ' + s.fiSeller + '</div></td></tr></table></td></tr>' : "";

  // MACRO ESTIMATES
  const mEst = s.sections.find(x => x.key === "macroEstimates")?.on ? secHdr("Macro Estimates") + '<tr><td style="padding:0 40px 8px;"><div style="font-size:10.5px;color:' + DS.textMuted + ';margin-bottom:8px;">Source: ' + s.macroSource + '</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ' + DS.border + ';"><tr style="background:' + DS.bgAlt + ';"><td style="padding:8px 12px;font-size:11px;font-weight:700;color:' + DS.navy + ';width:40%;border-bottom:1px solid ' + DS.border + ';"></td>' + s.macroCols.map(c => '<td style="padding:8px 12px;font-size:11px;font-weight:700;color:' + DS.navy + ';text-align:center;border-bottom:1px solid ' + DS.border + ';border-left:1px solid ' + DS.borderLight + ';">' + c + '</td>').join("") + '</tr>' + s.macroRows.map((r, i) => '<tr style="background:' + (i % 2 === 0 ? "#fff" : DS.bgAlt) + ';"><td style="padding:7px 12px;font-size:12.5px;font-weight:600;color:' + DS.text + ';border-bottom:1px solid ' + DS.borderLight + ';">' + r.label + '</td>' + s.macroCols.map(c => '<td style="padding:7px 12px;font-size:12.5px;color:' + DS.text + ';text-align:center;border-bottom:1px solid ' + DS.borderLight + ';border-left:1px solid ' + DS.borderLight + ';">' + (r.vals[c] || "") + '</td>').join("") + '</tr>').join("") + '</table></td></tr>' : "";

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
      const ratingLabel = dense ? ra(cv.rating) : cv.rating;
      const upside = cv.tp && cv.last
        ? ' \u00B7 <span style="color:' + upsideColor(cv.tp, cv.last) + ';font-weight:700;">' + fmtUpside(cv.tp, cv.last) + '</span>'
        : '';
      // In dense mode drop the standalone "Last $YY.YY" \u2014 the upside
      // % already encodes that information.
      const last = !dense && cv.last ? ' \u00B7 ' + cv.last : '';
      return '<span style="display:inline-block;' + chipMargin + 'padding:' + chipPad + ';border-radius:4px;font-size:' + chipFontSize + ';background:' + rb(cv.rating) + ';border:1px solid ' + rc(cv.rating) + '30;"><span style="font-weight:700;color:' + rc(cv.rating) + ';">' + cv.ticker + '</span> <span style="color:' + DS.textLight + ';">' + ratingLabel + (cv.tp ? ' \u00B7 TP ' + cv.tp : '') + last + upside + '</span></span>';
    }).join("");
    return '<div style="margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid ' + DS.borderLight + ';"><div style="font-size:14px;font-weight:700;color:' + DS.navy + ';text-transform:uppercase;letter-spacing:0.3px;margin-bottom:8px;">' + r.tickers.join(" / ") + ' \u2014 ' + r.headline + '</div><div style="margin-bottom:8px;">' + chips + '</div><div style="font-size:11.5px;color:' + DS.textMuted + ';font-style:italic;margin-bottom:6px;">' + r.analyst + '</div><div style="font-size:13.5px;line-height:1.65;color:' + DS.text + ';text-align:justify;">' + nl2br(r.body) + '</div>' + renderReportLink(r.link, { wrap: true }) + renderNewsLinks(c.newsLinks) + '</div>';
  }).join("") + '</td></tr>' : "";

  // RESEARCH
  const research = s.sections.find(x => x.key === "research")?.on && s.researchReports?.length ? secHdr("Research Reports") + '<tr><td style="padding:0 40px 8px;">' + (s.researchReports || []).filter(r => r.title).map(r => '<div style="margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid ' + DS.borderLight + ';"><div style="margin-bottom:3px;"><span style="font-size:10px;font-weight:700;color:' + DS.accent + ';text-transform:uppercase;letter-spacing:1px;">' + r.type + '</span></div><div style="font-size:13.5px;font-weight:700;color:' + DS.navy + ';margin-bottom:2px;">' + r.title + '</div>' + (r.author ? '<div style="font-size:11.5px;color:' + DS.textMuted + ';font-style:italic;margin-bottom:4px;">' + r.author + '</div>' : '') + (r.body ? '<div style="font-size:13px;line-height:1.6;color:' + DS.text + ';text-align:justify;">' + nl2br(r.body) + '</div>' : '') + renderReportLink(r.link, { wrap: true }) + '</div>').join("") + '</td></tr>' : "";

  // LATEST RESEARCH REPORTS — compact list of recent LS publications.
  // Same shape as `research` but no body — single row per report
  // with type tag + title + author + (optional) date + link. Author
  // is resolved through the analysts catalogue when `analystId` is
  // set (matches the Corporate block pattern); otherwise falls back
  // to the free-text `author` for external contributors.
  //
  // Each row also surfaces the unified blue "Full report →" button
  // so the CTA matches Corporate / Research / Tweets / Events. The
  // title is non-clickable text now — the button below is the
  // single, unambiguous click target.
  const latestReportsRows = (s.latestReports || []).filter(r => r.title?.trim());
  const latestReports = s.sections.find(x => x.key === "latestReports")?.on && latestReportsRows.length
    ? secHdr("Latest Research Reports") + '<tr><td style="padding:0 40px 8px;">' + latestReportsRows.map(r => {
        const tag = r.type?.trim() ? '<span style="display:inline-block;font-size:9.5px;font-weight:700;color:' + DS.accent + ';text-transform:uppercase;letter-spacing:1px;background:' + DS.bgAlt + ';padding:2px 8px;border-radius:3px;margin-right:8px;vertical-align:middle;">' + r.type + '</span>' : '';
        const titleEl = '<span style="color:' + DS.navy + ';font-weight:700;">' + r.title + '</span>';
        const resolvedAnalyst = r.analystId ? s.analysts.find((a) => a.id === r.analystId) : null;
        const authorName = resolvedAnalyst ? resolvedAnalyst.name : r.author?.trim();
        const meta = [authorName, r.publishedDate?.trim()].filter(Boolean).join(" · ");
        return '<div style="padding:8px 0;border-bottom:1px solid ' + DS.borderLight + ';font-size:13px;line-height:1.5;">' +
          tag + titleEl +
          (meta ? '<div style="font-size:11px;color:' + DS.textMuted + ';font-style:italic;margin-top:2px;margin-left:0;">' + meta + '</div>' : '') +
          renderReportLink(r.link, { wrap: true, compact: true }) +
          '</div>';
      }).join("") + '</td></tr>'
    : "";

  // TOP MOVERS
  const topMoversGainers: typeof s.topMovers.gainers = s.topMovers?.gainers?.filter(m => m.ticker) || [];
  const topMoversLosers: typeof s.topMovers.losers = s.topMovers?.losers?.filter(m => m.ticker) || [];
  const topMovers = s.sections.find(x => x.key === "topMovers")?.on && (topMoversGainers.length || topMoversLosers.length) ? secHdr("Top Movers") + '<tr><td style="padding:0 40px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ' + DS.border + ';"><tr style="background:' + DS.bgAlt + ';"><td style="padding:7px 12px;font-size:11px;font-weight:700;color:' + DS.navy + ';border-bottom:1px solid ' + DS.border + ';">Ticker</td><td style="padding:7px 12px;font-size:11px;font-weight:700;color:' + DS.navy + ';text-align:right;border-bottom:1px solid ' + DS.border + ';">Chg</td><td style="padding:7px 12px;font-size:11px;font-weight:700;color:' + DS.navy + ';border-bottom:1px solid ' + DS.border + ';">Comment</td></tr>' + topMoversGainers.map((m, i) => '<tr style="background:' + (i % 2 === 0 ? "#fff" : DS.bgAlt) + ';"><td style="padding:6px 12px;font-size:12.5px;font-weight:600;color:' + DS.text + ';border-bottom:1px solid ' + DS.borderLight + ';">' + m.ticker + '</td><td style="padding:6px 12px;font-size:12.5px;font-weight:700;color:' + DS.green + ';text-align:right;border-bottom:1px solid ' + DS.borderLight + ';">+' + m.chgPct + '%</td><td style="padding:6px 12px;font-size:12px;color:' + DS.textLight + ';border-bottom:1px solid ' + DS.borderLight + ';">' + (m.comment || "") + '</td></tr>').join("") + topMoversLosers.map((m, i) => '<tr style="background:' + (i % 2 === 0 ? "#fff" : DS.bgAlt) + ';"><td style="padding:6px 12px;font-size:12.5px;font-weight:600;color:' + DS.text + ';border-bottom:1px solid ' + DS.borderLight + ';">' + m.ticker + '</td><td style="padding:6px 12px;font-size:12.5px;font-weight:700;color:' + DS.red + ';text-align:right;border-bottom:1px solid ' + DS.borderLight + ';">' + m.chgPct + '%</td><td style="padding:6px 12px;font-size:12px;color:' + DS.textLight + ';border-bottom:1px solid ' + DS.borderLight + ';">' + (m.comment || "") + '</td></tr>').join("") + '</table></td></tr>' : "";

  // TWEETS
  const tweets = s.sections.find(x => x.key === "tweets")?.on && s.tweets?.length ? secHdr("Market Noise") + '<tr><td style="padding:0 40px 8px;">' + s.tweets.filter(t => t.content).map(t => { const sColor = t.sentiment === "Bullish" ? DS.green : t.sentiment === "Bearish" ? DS.red : DS.textMuted; return '<div style="margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid ' + DS.borderLight + ';"><div style="margin-bottom:4px;font-size:11px;"><span style="color:' + sColor + ';font-weight:700;text-transform:uppercase;">' + t.sentiment + '</span>' + (t.impactType && t.impactValue ? ' <span style="color:' + DS.textMuted + ';"> \u00B7 ' + t.impactType + ': ' + t.impactValue + '</span>' : '') + (t.time ? ' <span style="color:' + DS.textMuted + ';"> \u00B7 ' + t.time + '</span>' : '') + '</div><div style="font-size:13.5px;line-height:1.6;color:' + DS.text + ';text-align:justify;">' + nl2br(t.content) + '</div>' + renderReportLink(t.link, { wrap: true, label: "Source &#8594;" }) + '</div>'; }).join("") + '</td></tr>' : "";

  // BCRA
  const bcra = s.sections.find(x => x.key === "bcra")?.on && s.bcraData ? (() => { const hidden = s.bcraHiddenRows || {}; const entries = Object.entries(s.bcraData).filter(([k]) => !hidden[k]); if (!entries.length) return ""; return secHdr("BCRA Dashboard") + '<tr><td style="padding:0 40px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ' + DS.border + ';"><tr style="background:' + DS.bgAlt + ';"><td style="padding:7px 12px;font-size:11px;font-weight:700;color:' + DS.navy + ';border-bottom:1px solid ' + DS.border + ';">Indicator</td><td style="padding:7px 12px;font-size:11px;font-weight:700;color:' + DS.navy + ';text-align:right;border-bottom:1px solid ' + DS.border + ';">Value</td></tr>' + entries.map(([k, v], i) => '<tr style="background:' + (i % 2 === 0 ? "#fff" : DS.bgAlt) + ';"><td style="padding:6px 12px;font-size:12.5px;font-weight:600;color:' + DS.text + ';border-bottom:1px solid ' + DS.borderLight + ';">' + k + '</td><td style="padding:6px 12px;font-size:12.5px;color:' + DS.text + ';text-align:right;border-bottom:1px solid ' + DS.borderLight + ';">' + v + '</td></tr>').join("") + '</table></td></tr>'; })() : "";

  // EVENTS (Corporate Access & Events)
  const events = s.sections.find(x => x.key === "events")?.on && s.events?.length ? secHdr("Corporate Access & Events") + '<tr><td style="padding:0 40px 8px;">' + s.events.filter(e => e.title).map(e => {
    const times = [e.timeET ? 'ET ' + fmtTime(e.timeET) : '', e.timeBUE ? 'BUE ' + fmtTime(e.timeBUE) : '', e.timeLON ? 'LON ' + fmtTime(e.timeLON) : ''].filter(Boolean).join(' \u00B7 ');
    return '<div style="margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid ' + DS.borderLight + ';">' +
      '<div style="margin-bottom:3px;"><span style="font-size:10px;font-weight:700;color:' + DS.accent + ';text-transform:uppercase;letter-spacing:1px;">' + e.type + '</span></div>' +
      '<div style="font-size:13.5px;font-weight:700;color:' + DS.navy + ';margin-bottom:2px;">' + e.title + '</div>' +
      '<div style="font-size:11.5px;color:' + DS.textMuted + ';margin-bottom:4px;">' + (e.date ? fmtEventDate(e.date) : '') + (times ? ' \u00B7 ' + times : '') + '</div>' +
      (e.description ? '<div style="font-size:13px;line-height:1.6;color:' + DS.text + ';text-align:justify;">' + nl2br(e.description) + '</div>' : '') +
      renderReportLink(e.link, { wrap: true, label: "Register / Details &#8594;" }) +
      '</div>';
  }).join("") + '</td></tr>' : "";

  // KEY EVENTS
  const keyEvents = s.sections.find(x => x.key === "keyEvents")?.on && s.keyEvents?.length ? secHdr("Key Events Calendar") + '<tr><td style="padding:0 40px 8px;">' + s.keyEvents.filter(e => e.event).map(e => '<div style="padding:4px 0;font-size:13px;color:' + DS.text + ';"><span style="font-weight:700;color:' + DS.navy + ';margin-right:10px;">' + (e.date ? fmtEventDate(e.date) : "") + '</span>' + e.event + '</div>').join("") + '</td></tr>' : "";

  // CHART
  const chart = s.sections.find(x => x.key === "chart")?.on && s.chartImage?.base64 ? secHdr("Chart of the Day") + '<tr><td style="padding:0 40px 8px;">' + (s.chartImage.title ? '<div style="font-size:13.5px;font-weight:700;color:' + DS.navy + ';margin-bottom:10px;">' + s.chartImage.title + '</div>' : '') + '<img src="' + s.chartImage.base64 + '" alt="' + (s.chartImage.title || "Chart") + '" style="max-width:100%;height:auto;display:block;border:1px solid ' + DS.borderLight + ';" />' + (s.chartImage.caption ? '<div style="font-size:11px;color:' + DS.textMuted + ';font-style:italic;margin-top:6px;">' + s.chartImage.caption + '</div>' : '') + '</td></tr>' : "";

  // SIGNATURES
  const sig = s.signatures.map(x => '<div style="margin-bottom:6px;"><span style="font-size:13px;font-weight:600;color:' + DS.navy + ';">' + x.name + '</span><span style="font-size:12px;color:' + DS.textLight + ';margin-left:6px;">' + x.role + '</span><br><span style="font-size:12px;color:' + DS.accent + ';">' + x.email + '</span></div>').join("");

  // SECTION MAP
  const sectionMap: Record<string, string> = { yesterdayRecap, snapshot, watchToday, marketComment, macro, tradeIdeas: trade, flows: flow, corporate: corp, research, latestReports, topMovers, tweets, latam, bcra, events, macroEstimates: mEst, chart };
  const enabledSections = s.sections.filter(x => x.on);

  // Build Table of Contents
  const tocBlock = '<tr><td style="padding:20px 40px 4px;"><div style="font-size:10px;font-weight:700;color:' + DS.navy + ';text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">In This Issue</div>' + enabledSections.map((sec, i) => '<a href="#sec-' + sec.key + '" style="display:inline-block;font-size:12px;color:' + DS.accent + ';text-decoration:none;margin-right:6px;margin-bottom:4px;">' + SEC_LABELS[sec.key] + (i < enabledSections.length - 1 ? ' <span style="color:' + DS.textMuted + ';">&middot;</span>' : '') + '</a>').join("") + '</td></tr>';

  // Build compact summaries (1-line per section)
  const compactSummaries = {
    macro: s.macroBlocks.length ? s.macroBlocks.map(b => b.title).join(", ") : "",
    tradeIdeas: s.equityPicks.filter(p => p.ticker).map(p => p.ticker).join(", ") + (s.fiIdeas.filter(f => f.idea).length ? " + " + s.fiIdeas.filter(f => f.idea).length + " FI ideas" : ""),
    flows: "EQ: Buy " + (s.eqBuyer || "...").substring(0, 30) + " | FI: Buy " + (s.fiBuyer || "...").substring(0, 30),
    macroEstimates: s.macroRows.length + " metrics, " + s.macroCols.join("/"),
    yesterdayRecap: s.yesterdayRecap?.trim() ? s.yesterdayRecap.trim().slice(0, 80) + (s.yesterdayRecap.length > 80 ? "…" : "") : "",
    marketComment: s.marketComment?.trim() ? s.marketComment.trim().slice(0, 80) + (s.marketComment.length > 80 ? "…" : "") : "",
    corporate: s.corpBlocks.map(c => (c.tickers || []).join("/")).filter(Boolean).join(", "),
    research: (s.researchReports || []).filter(r => r.title).map(r => r.title).join(", "),
    latestReports: (s.latestReports || []).filter(r => r.title).map(r => r.title).join(", "),
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
    return '<tr><td style="padding:4px 40px;"><div style="display:flex;padding:8px 0;border-bottom:1px solid ' + DS.borderLight + ';"><span style="font-size:11px;font-weight:700;color:' + DS.navy + ';text-transform:uppercase;letter-spacing:1px;min-width:140px;">' + SEC_LABELS[sec.key] + '</span><span style="font-size:12.5px;color:' + DS.textLight + ';margin-left:12px;">' + summary + '</span></div></td></tr>';
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

    // SUMMARY BAR
    + (s.summaryBar ? '<tr><td style="padding:20px 40px 0;"><div style="border-left:3px solid ' + DS.accent + ';padding:12px 16px;background:' + DS.bgAlt + ';font-size:13.5px;line-height:1.6;color:' + DS.text + ';text-align:justify;"><strong style="color:' + DS.navy + ';">Today</strong> \u2014 ' + s.summaryBar + '</div></td></tr>' : '')

    // SECTIONS
    + sectionContent

    // SIGNATURE
    // Width/height match the source PNG's 3.98:1 aspect (1600×402).
    // 120×30 is the correct fit; 120×32 was vertically squashing the
    // glyphs ~6% — analysts described it as "looking cut off".
    + '<tr><td style="padding:24px 40px 0;border-top:1px solid ' + DS.border + ';"><img src="' + logo + '" alt="Latin Securities" width="120" height="30" style="width:120px;height:30px;display:block;margin-bottom:14px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />' + sig + '</td></tr>'

    // FOOTER
    + '<tr><td style="padding:20px 40px 24px;"><div style="border-top:1px solid ' + DS.borderLight + ';padding-top:16px;"><div style="font-size:10px;font-weight:600;color:' + DS.textMuted + ';text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Latin Securities S.A.</div><div style="font-size:9.5px;color:' + DS.textMuted + ';line-height:1.6;">Arenales 707, 6th Floor \u00B7 Buenos Aires, Argentina \u00B7 <a href="https://www.latinsecurities.com.ar" style="color:' + DS.accent + ';text-decoration:none;">latinsecurities.com.ar</a></div><div style="font-size:10px;color:' + DS.textMuted + ';line-height:1.6;margin-top:10px;">Don\'t want these emails? <a href="' + unsubscribeUrl() + '" style="color:' + DS.accent + ';text-decoration:underline;">Unsubscribe</a>.</div><div style="font-size:9px;color:#b0b0b0;line-height:1.5;margin-top:10px;">' + (s.disclaimer || 'This material has been prepared by Latin Securities S.A. for informational purposes only.') + ' \u00A9 ' + new Date().getFullYear() + ' Latin Securities S.A. All rights reserved.</div></div></td></tr>'

    + '</table></td></tr></table></body></html>';
}

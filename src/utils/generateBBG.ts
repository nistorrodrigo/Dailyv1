import { formatDate, fmtEventDate, fmtTime } from "./dates";
import { resolveCorporateBlock } from "./ratings";
import { fmtUpside } from "./prices";
import type { DailyState, NewsLink } from "../types";

/**
 * Format a NewsLink list as "Sources: <label> · <label2> · …" plus
 * indented URLs underneath. URLs go on their own lines because BBG chat
 * auto-linkifies bare URLs but won't pull them out of inline punctuation.
 */
function fmtNewsLinks(links: NewsLink[] | undefined, indent = "  "): string[] {
  if (!links || !links.length) return [];
  const valid = links.filter((l) => l.url && l.url.trim());
  if (!valid.length) return [];
  const out: string[] = [];
  out.push(`${indent}Sources:`);
  for (const l of valid) {
    const label = l.label.trim();
    out.push(`${indent}  ↗ ${label ? label + " — " : ""}${l.url.trim()}`);
  }
  return out;
}

/**
 * Generate the Bloomberg-flavoured plain-text version of the daily.
 *
 * Format goals:
 *   - Scannable in a chat window (emoji section markers, blank lines
 *     between).
 *   - Reproduce the analyst's prose verbatim. Earlier versions
 *     aggressively truncated each block (~200-400 chars) and tacked
 *     on "…" — institutional readers got half-paragraphs, and the AI
 *     reviewer (which feeds off this same string) flagged them as
 *     "text appears cut off mid-sentence", which they were.
 *   - The previous head-line cap was a single overall trim aimed at
 *     BBG IB's ~5k-char chat ceiling. We now skip per-field trims
 *     and only collapse multiline bodies into single lines (BBG
 *     chat-paste behaviour likes paragraph-per-line).
 *
 * Result is memoized by state reference: zustand returns a new state
 * object only when something actually changed, so WeakMap-keyed caching
 * is safe and avoids regenerating the string when multiple subscribers
 * (Header, PreviewTab, AIReview, send modal) all read the same state.
 */
const bbgCache = new WeakMap<DailyState, string>();

/**
 * Collapse internal whitespace (newlines, multiple spaces) to a
 * single space so a paragraph copy-pastes as one line in BBG chat.
 * No length cap — analysts asked for full prose, and the AI review
 * relies on seeing whole sentences.
 */
const oneLine = (s: string): string => (s || "").replace(/\s+/g, " ").trim();

const isOn = (s: DailyState, key: string): boolean =>
  Boolean(s.sections.find((x) => x.key === key)?.on);

export function generateBBG(s: DailyState): string {
  const cached = bbgCache.get(s);
  if (cached !== undefined) return cached;

  const L: string[] = [];

  // ─── HEADER ───────────────────────────────────────────────
  L.push(`🇦🇷 LS DAILY | ${formatDate(s.date)}`);
  if (s.summaryBar) L.push("", `🔥 ${s.summaryBar.replace(/\n/g, " ")}`);

  // ─── YESTERDAY IN REVIEW (above the snapshot) ─────────────
  // Goes high in the BBG output so the recap is the first thing
  // institutional readers see after the date header — same
  // priority as in the email HTML.
  if (isOn(s, "yesterdayRecap") && s.yesterdayRecap?.trim()) {
    L.push("", "📋 YESTERDAY IN REVIEW");
    L.push(oneLine(s.yesterdayRecap));
  }

  // ─── SNAPSHOT (compact one-liner) ─────────────────────────
  const snp = s.snapshot;
  const snpItems = [
    snp.merval ? `Merval ${snp.merval}${snp.mervalChg ? ` (${snp.mervalChg}%)` : ""}` : "",
    snp.adrs ? `ADRs ${snp.adrs}${snp.adrsChg ? ` (${snp.adrsChg}%)` : ""}` : "",
    snp.ccl ? `CCL ${snp.ccl}${snp.cclChg ? ` (${snp.cclChg}%)` : ""}` : "",
    snp.mep ? `MEP ${snp.mep}${snp.mepChg ? ` (${snp.mepChg}%)` : ""}` : "",
    snp.sp500 ? `S&P ${snp.sp500}${snp.sp500Chg ? ` (${snp.sp500Chg}%)` : ""}` : "",
    snp.ust10y ? `UST10 ${snp.ust10y}` : "",
    snp.dxy ? `DXY ${snp.dxy}` : "",
    snp.soja ? `Soja ${snp.soja}` : "",
    snp.wti ? `WTI ${snp.wti}` : "",
  ].filter(Boolean);
  if (isOn(s, "snapshot") && snpItems.length) {
    L.push("", `📊 ${snpItems.join(" | ")}`);
  }

  // ─── WHAT TO WATCH ────────────────────────────────────────
  const watchItems = (s.watchToday || []).filter((w: string) => w.trim());
  if (isOn(s, "watchToday") && watchItems.length) {
    L.push("", "⚡ WHAT TO WATCH");
    watchItems.forEach((w: string) => L.push(`• ${w}`));
  }

  // ─── MARKET COMMENT (free-form prose block) ──────────────
  if (isOn(s, "marketComment") && s.marketComment?.trim()) {
    L.push("", "💬 MARKET COMMENT");
    L.push(oneLine(s.marketComment));
  }

  // ─── MACRO / POLITICAL (every block) ──────────────────────
  if (isOn(s, "macro")) {
    const macroBlocks = s.macroBlocks.filter((b) => b.body || b.lsPick || (b.newsLinks && b.newsLinks.length));
    if (macroBlocks.length) {
      L.push("", "📰 MACRO / POLITICAL");
      macroBlocks.forEach((b, i) => {
        const title = (b.title || "").trim();
        if (title) L.push(`▸ ${title.toUpperCase()}`);
        if (b.body) L.push(`  ${oneLine(b.body)}`);
        if (b.lsPick) L.push(`  💡 LS view: ${oneLine(b.lsPick)}`);
        for (const line of fmtNewsLinks(b.newsLinks)) L.push(line);
        if (i < macroBlocks.length - 1) L.push("");
      });
    }
  }

  // ─── TRADE IDEAS ──────────────────────────────────────────
  if (isOn(s, "tradeIdeas")) {
    const allTk = s.analysts.flatMap((a) =>
      a.coverage.map((c) => ({ ticker: c.ticker, rating: c.rating, tp: c.tp, last: c.last || "" })),
    );
    const picks = s.equityPicks.filter((p) => p.ticker);
    if (picks.length) {
      L.push("", "📈 TOP PICKS");
      picks.forEach((p) => {
        const info = allTk.find((x) => x.ticker === p.ticker);
        const rating = info?.rating || "";
        const tp = info?.tp || "";
        const ups = info ? fmtUpside(info.tp, info.last) : "";
        const meta = [rating, tp ? `TP ${tp}` : "", ups].filter(Boolean).join(" · ");
        L.push(`• ${p.ticker}${meta ? ` — ${meta}` : ""}`);
        if (p.reason) L.push(`  ${oneLine(p.reason)}`);
        // Surface the explicit invalidation trigger when the analyst
        // set one — the same "Change my mind:" framing renders in the
        // HTML email. Indented further than the reason so it reads
        // as subordinate to the thesis.
        if (p.exitTrigger?.trim()) {
          L.push(`    Change my mind: ${oneLine(p.exitTrigger)}`);
        }
      });
    }

    const fi = s.fiIdeas.filter((f) => f.idea);
    if (fi.length) {
      L.push("", "📎 FIXED INCOME");
      fi.forEach((f) => {
        L.push(`• ${f.idea}`);
        if (f.reason) L.push(`  ${oneLine(f.reason)}`);
      });
    }
  }

  // ─── MARKET COLOR / FLOWS ─────────────────────────────────
  if (isOn(s, "flows") && (s.eqBuyer || s.eqSeller || s.fiBuyer || s.fiSeller)) {
    L.push("", "🟢 MARKET COLOR");
    if (s.eqBuyer || s.eqSeller) {
      L.push(`Equities — Buy: ${s.eqBuyer || "—"}`);
      L.push(`         Sell: ${s.eqSeller || "—"}`);
    }
    if (s.fiBuyer || s.fiSeller) {
      L.push(`FI       — Buy: ${s.fiBuyer || "—"}`);
      L.push(`         Sell: ${s.fiSeller || "—"}`);
    }
  }

  // ─── CORPORATE (per-block detail) ─────────────────────────
  if (isOn(s, "corporate") && s.corpBlocks.length) {
    const blocks = s.corpBlocks.filter((c) => c.headline || c.body || (c.tickers && c.tickers.length));
    if (blocks.length) {
      L.push("", "📋 CORPORATE");
      blocks.forEach((c, i) => {
        const r = resolveCorporateBlock(c, s.analysts);
        const tickers = r.tickers.join("/");
        const cv = r.covs[0];
        const meta = [cv?.rating, cv?.tp ? `TP ${cv.tp}` : ""].filter(Boolean).join(" · ");
        L.push(`▸ ${tickers || "—"} — ${r.headline || "(untitled)"}`);
        if (meta) L.push(`  ${meta}${r.analyst ? ` — ${r.analyst}` : ""}`);
        else if (r.analyst) L.push(`  ${r.analyst}`);
        if (r.body) L.push(`  ${oneLine(r.body)}`);
        // Same "↗ Full report:" framing across Corporate, Research,
        // and Latest Research Reports so analysts pasting from any
        // of the three sections get a uniform call-to-action.
        if (r.link) L.push(`  ↗ Full report: ${r.link}`);
        for (const line of fmtNewsLinks(c.newsLinks)) L.push(line);
        if (i < blocks.length - 1) L.push("");
      });
    }
  }

  // ─── LATAM CONTEXT ────────────────────────────────────────
  if (isOn(s, "latam") && s.latam) {
    L.push("", "🌎 LATAM");
    L.push(oneLine(s.latam));
  }

  // ─── TOP MOVERS ───────────────────────────────────────────
  if (isOn(s, "topMovers")) {
    const gainers = s.topMovers.gainers.filter((m) => m.ticker);
    const losers = s.topMovers.losers.filter((m) => m.ticker);
    if (gainers.length || losers.length) {
      L.push("", "🚀 TOP MOVERS");
      if (gainers.length) {
        L.push(
          "Gainers: " +
            gainers.map((m) => `${m.ticker}${m.chgPct ? ` ${m.chgPct}%` : ""}`).join(", "),
        );
      }
      if (losers.length) {
        L.push(
          "Losers: " +
            losers.map((m) => `${m.ticker}${m.chgPct ? ` ${m.chgPct}%` : ""}`).join(", "),
        );
      }
    }
  }

  // ─── RESEARCH REPORTS ─────────────────────────────────────
  if (isOn(s, "research")) {
    const reports = s.researchReports.filter((r) => r.title || r.body);
    if (reports.length) {
      L.push("", "📚 RESEARCH");
      reports.forEach((r) => {
        const meta = [r.type, r.author].filter(Boolean).join(" · ");
        L.push(`• ${r.title || "(untitled)"}${meta ? ` (${meta})` : ""}`);
        // Match Corporate's "↗ Full report:" framing — same call to
        // action across all three report-bearing sections.
        if (r.link) L.push(`  ↗ Full report: ${r.link}`);
      });
    }
  }

  // ─── LATEST RESEARCH REPORTS ──────────────────────────────
  // Compact "what we just published" digest. No body — just title +
  // author + link, one line per report. Use this when the desk wants
  // to point clients at recent publications without quoting them.
  // Author resolves through the Analysts catalogue when `analystId`
  // is set (matches Corporate); falls back to free-text `author`.
  if (isOn(s, "latestReports")) {
    const reports = (s.latestReports || []).filter((r) => r.title?.trim());
    if (reports.length) {
      L.push("", "📑 LATEST REPORTS");
      reports.forEach((r) => {
        const resolvedAnalyst = r.analystId ? s.analysts.find((a) => a.id === r.analystId) : null;
        const authorName = resolvedAnalyst ? resolvedAnalyst.name : r.author;
        const meta = [r.type, authorName, r.publishedDate].filter(Boolean).join(" · ");
        L.push(`• ${r.title}${meta ? ` (${meta})` : ""}`);
        if (r.link) L.push(`  ↗ Full report: ${r.link}`);
      });
    }
  }

  // ─── UPCOMING EVENTS ──────────────────────────────────────
  if (isOn(s, "events") && s.events?.length) {
    const evts = s.events.filter((e) => e.title).slice(0, 6);
    if (evts.length) {
      L.push("", "📅 UPCOMING");
      evts.forEach((e) => {
        const date = e.date ? fmtEventDate(e.date) : "";
        const time = e.timeBUE ? fmtTime(e.timeBUE) + " BUE" : "";
        const when = [date, time].filter(Boolean).join(" · ");
        L.push(`• ${when ? `[${when}] ` : ""}${e.title}${e.type ? ` (${e.type})` : ""}`);
      });
    }
  }

  // ─── FOOTER ───────────────────────────────────────────────
  L.push("", "---", "LS Research | latinsecurities.com.ar");

  const result = L.join("\n");
  bbgCache.set(s, result);
  return result;
}

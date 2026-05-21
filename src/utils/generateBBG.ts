import { formatDate, fmtEventDate, fmtTime, bueTimeToZones } from "./dates";
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
  // Headline first when set — mirrors the HTML rendering which
  // now leads with the headline above the summary bar.
  if (s.headline?.trim()) L.push("", `📌 ${s.headline.trim()}`);
  if (s.summaryBar) L.push("", `🔥 ${s.summaryBar.replace(/\n/g, " ")}`);

  // Yesterday in Review and Market Snapshot were retired from the
  // catalogue — see generateHTML for the rationale. State fields
  // are preserved for backwards compat but no longer rendered.

  // ─── WHAT TO WATCH (this week) ─────────────────────────────
  // Each WatchItem may carry an optional date + Buenos Aires time;
  // when set, prefix the bullet with "Date · HH:MM BUE (ET · London)".
  const watchItems = (s.watchToday || []).filter((w) => w.text?.trim());
  if (isOn(s, "watchToday") && watchItems.length) {
    L.push("", "⚡ WHAT TO WATCH THIS WEEK");
    watchItems.forEach((w) => {
      const zones = bueTimeToZones(w.timeBUE, w.date);
      const dateLabel = w.date ? fmtEventDate(w.date) : "";
      const bueLabel = w.timeBUE ? fmtTime(w.timeBUE) + " BUE" : "";
      const metaMain = [dateLabel, bueLabel].filter(Boolean).join(" · ");
      const zoneStr = zones ? ` (${zones.et} ET · ${zones.london} London)` : "";
      const prefix = metaMain ? `${metaMain}${zoneStr} — ` : "";
      L.push(`• ${prefix}${w.text}`);
    });
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
  // Each instrument as its own labelled block with the caps
  // header on its own line — the previous one-line-per-direction
  // format made it harder to scan which side was which when
  // pasted into Bloomberg chat. "Net Buyer" / "Net Seller" labels
  // mirror the HTML output so the language is consistent across
  // both surfaces.
  if (isOn(s, "flows") && (s.eqBuyer || s.eqSeller || s.fiBuyer || s.fiSeller)) {
    L.push("", "🟢 MARKET COLOR");
    if (s.eqBuyer || s.eqSeller) {
      L.push("", "EQUITIES");
      L.push(`  ● Net Buyer:  ${s.eqBuyer || "—"}`);
      L.push(`  ● Net Seller: ${s.eqSeller || "—"}`);
    }
    if (s.fiBuyer || s.fiSeller) {
      L.push("", "FIXED INCOME");
      L.push(`  ● Net Buyer:  ${s.fiBuyer || "—"}`);
      L.push(`  ● Net Seller: ${s.fiSeller || "—"}`);
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
        // Earnings / investor call. Different glyph (☎) so the
        // recipient distinguishes "join the call" from the
        // report link sitting one row above. Date/time is inline
        // with the URL when set.
        if (c.callUrl?.trim()) {
          const dt = c.callDateTime?.trim();
          L.push(`  ☎ Call${dt ? ` (${dt})` : ""}: ${c.callUrl.trim()}`);
        }
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
  // Author resolution mirrors Corporate / LatestReports: prefer
  // the catalogue analyst's display name (via analystId), fall
  // back to free-text `author` for external contributors.
  if (isOn(s, "research")) {
    const reports = s.researchReports.filter((r) => r.title || r.body);
    if (reports.length) {
      L.push("", "📚 RESEARCH");
      reports.forEach((r) => {
        const resolvedAnalyst = r.analystId ? s.analysts.find((a) => a.id === r.analystId) : null;
        const authorName = resolvedAnalyst ? resolvedAnalyst.name : r.author;
        const meta = [r.type, authorName].filter(Boolean).join(" · ");
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

  // ─── BOND PIPELINE ────────────────────────────────────────
  // Primary-market new-issue tracker. One line per deal in
  // "Issuer · Pricing · Size" form — same field order as the
  // HTML table so a reader who sees both can map one to the other
  // at a glance. Empty issuer rows are filtered out.
  if (isOn(s, "bondPipeline")) {
    const deals = (s.bondPipeline || []).filter((b) => b.issuer?.trim());
    if (deals.length) {
      L.push("", "💵 BOND PIPELINE");
      deals.forEach((b) => {
        const date = b.pricingDate?.trim() ? fmtEventDate(b.pricingDate) : "TBD";
        const size = b.estimatedSize?.trim() || "—";
        L.push(`• ${b.issuer} · ${date} · ${size}`);
      });
    }
  }

  // ─── UPCOMING EVENTS ──────────────────────────────────────
  if (isOn(s, "events") && s.events?.length) {
    const evts = s.events.filter((e) => e.title).slice(0, 6);
    if (evts.length) {
      L.push("", "📅 EVENTS AND WEBINARS");
      evts.forEach((e) => {
        const date = e.date ? fmtEventDate(e.date) : "";
        const time = e.timeBUE ? fmtTime(e.timeBUE) + " BUE" : "";
        const when = [date, time].filter(Boolean).join(" · ");
        L.push(`• ${when ? `[${when}] ` : ""}${e.title}${e.type ? ` (${e.type})` : ""}`);
      });
    }
  }

  // ─── BCRA DASHBOARD ───────────────────────────────────────
  // Mirror the HTML render — previously the BBG paste silently
  // skipped BCRA data even when the section was on, leaving the
  // chat recipient with a less informative copy than the email.
  if (isOn(s, "bcra") && s.bcraData) {
    const hidden = s.bcraHiddenRows || {};
    const entries = Object.entries(s.bcraData).filter(([k]) => !hidden[k]);
    if (entries.length) {
      L.push("", "📊 BCRA DASHBOARD");
      entries.forEach(([k, v]) => L.push(`  ${k}: ${v}`));
    }
  }

  // ─── MARKET NOISE (tweets / sentiment items) ──────────────
  if (isOn(s, "tweets") && s.tweets?.length) {
    const items = s.tweets.filter((t) => t.content?.trim());
    if (items.length) {
      L.push("", "🐦 MARKET NOISE");
      items.forEach((t) => {
        const meta = [t.sentiment, t.impactType && t.impactValue ? `${t.impactType}: ${t.impactValue}` : "", t.time].filter(Boolean).join(" · ");
        L.push(`• ${meta ? `[${meta}] ` : ""}${oneLine(t.content)}`);
        if (t.link) L.push(`  ↗ Source: ${t.link}`);
      });
    }
  }

  // ─── MACRO ESTIMATES TABLE ────────────────────────────────
  if (isOn(s, "macroEstimates") && s.macroRows?.length && s.macroCols?.length) {
    L.push("", "📈 MACRO ESTIMATES");
    if (s.macroSource?.trim()) L.push(`  Source: ${s.macroSource.trim()}`);
    L.push(`  ${"".padEnd(28)} ${s.macroCols.map((c) => c.padStart(10)).join(" ")}`);
    s.macroRows.forEach((r) => {
      L.push(`  ${(r.label || "").slice(0, 28).padEnd(28)} ${s.macroCols.map((c) => (r.vals[c] || "").padStart(10)).join(" ")}`);
    });
  }

  // ─── CHART OF THE DAY ─────────────────────────────────────
  // No image in BBG chat, but advertising that a chart exists in
  // the email lets the recipient know to switch over. Title +
  // optional caption are enough context to decide.
  if (isOn(s, "chart") && s.chartImage?.base64) {
    L.push("", "📊 CHART OF THE DAY");
    if (s.chartImage.title?.trim()) L.push(`  ${s.chartImage.title.trim()}`);
    if (s.chartImage.caption?.trim()) L.push(`  ${oneLine(s.chartImage.caption)}`);
    L.push(`  (See attached chart in the email version)`);
  }

  // ─── FOOTER ───────────────────────────────────────────────
  L.push("", "---", "LS Research | latinsecurities.com.ar");

  const result = L.join("\n");
  bbgCache.set(s, result);
  return result;
}

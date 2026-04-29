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
 *   - Scannable in a chat window (emoji section markers, blank lines between).
 *   - Substantial enough to stand alone (the previous version aggressively
 *     truncated to ~150-200 chars per section, leaving readers without
 *     context — now we give per-section excerpts of up to ~400 chars and
 *     iterate over ALL items in a section instead of just the first).
 *   - Still well under Bloomberg IB's chat limits (~5k chars).
 */

const truncate = (s: string, max: number): string => {
  const cleaned = (s || "").replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max - 1).trimEnd() + "…";
};

const isOn = (s: DailyState, key: string): boolean =>
  Boolean(s.sections.find((x) => x.key === key)?.on);

export function generateBBG(s: DailyState): string {
  const L: string[] = [];

  // ─── HEADER ───────────────────────────────────────────────
  L.push(`🇦🇷 LS DAILY | ${formatDate(s.date)}`);
  if (s.summaryBar) L.push("", `🔥 ${s.summaryBar.replace(/\n/g, " ")}`);

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

  // ─── MACRO / POLITICAL (every block) ──────────────────────
  if (isOn(s, "macro")) {
    const macroBlocks = s.macroBlocks.filter((b) => b.body || b.lsPick || (b.newsLinks && b.newsLinks.length));
    if (macroBlocks.length) {
      L.push("", "📰 MACRO / POLITICAL");
      macroBlocks.forEach((b, i) => {
        const title = (b.title || "").trim();
        if (title) L.push(`▸ ${title.toUpperCase()}`);
        if (b.body) L.push(`  ${truncate(b.body, 380)}`);
        if (b.lsPick) L.push(`  💡 LS view: ${truncate(b.lsPick, 200)}`);
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
        if (p.reason) L.push(`  ${truncate(p.reason, 200)}`);
      });
    }

    const fi = s.fiIdeas.filter((f) => f.idea);
    if (fi.length) {
      L.push("", "📎 FIXED INCOME");
      fi.forEach((f) => {
        L.push(`• ${f.idea}`);
        if (f.reason) L.push(`  ${truncate(f.reason, 200)}`);
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
        if (r.body) L.push(`  ${truncate(r.body, 280)}`);
        if (r.link) L.push(`  ↗ Full report: ${r.link}`);
        for (const line of fmtNewsLinks(c.newsLinks)) L.push(line);
        if (i < blocks.length - 1) L.push("");
      });
    }
  }

  // ─── LATAM CONTEXT ────────────────────────────────────────
  if (isOn(s, "latam") && s.latam) {
    L.push("", "🌎 LATAM");
    L.push(truncate(s.latam, 500));
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
        if (r.link) L.push(`  ↗ ${r.link}`);
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

  return L.join("\n");
}

import { formatDate, fmtEventDate, fmtTime } from "./dates";
import { resolveCorporateBlock } from "./ratings";
import { fmtUpside } from "./prices";
import type { DailyState } from "../types";

export function generateBBG(s: DailyState): string {
  const L: string[] = [];

  // HEADER
  L.push(`🇦🇷 LS DAILY | ${formatDate(s.date)}`);
  if (s.summaryBar) L.push("", `🔥 ${s.summaryBar}`);

  // SNAPSHOT
  const snp = (s.snapshot || {}) as Record<string, string>;
  const snpItems = [
    snp.merval ? `Merval ${snp.merval}${snp.mervalChg ? ` (${snp.mervalChg}%)` : ""}` : "",
    snp.adrs ? `ADRs ${snp.adrs}${snp.adrsChg ? ` (${snp.adrsChg}%)` : ""}` : "",
    snp.ccl ? `CCL ${snp.ccl}${snp.cclChg ? ` (${snp.cclChg}%)` : ""}` : "",
    snp.sp500 ? `S&P ${snp.sp500}${snp.sp500Chg ? ` (${snp.sp500Chg}%)` : ""}` : "",
    snp.ust10y ? `UST10 ${snp.ust10y}` : "",
    snp.soja ? `Soja ${snp.soja}` : "",
  ].filter(Boolean);
  if (s.sections.find(x => x.key === "snapshot")?.on && snpItems.length) {
    L.push("", `📊 ${snpItems.join(" | ")}`);
  }

  // WHAT TO WATCH
  const watchItems = (s.watchToday || []).filter((w: string) => w.trim());
  if (s.sections.find(x => x.key === "watchToday")?.on && watchItems.length) {
    L.push("", "⚡ WHAT TO WATCH");
    watchItems.forEach((w: string) => L.push(`• ${w}`));
  }

  // TOP PICKS (compact)
  if (s.sections.find(x => x.key === "tradeIdeas")?.on) {
    const allTk = s.analysts.flatMap(a => a.coverage.map(c => ({ ticker: c.ticker, rating: c.rating, tp: c.tp, last: c.last || "" })));
    const picks = s.equityPicks.filter(p => p.ticker).map(p => {
      const info = allTk.find(x => x.ticker === p.ticker);
      const ups = info ? fmtUpside(info.tp, info.last) : "";
      return `${p.ticker} (${info?.rating || ""}${ups ? `, ${ups}` : ""})`;
    });
    if (picks.length) L.push("", `📈 TOP PICKS: ${picks.join(", ")}`);
    const fi = s.fiIdeas.filter(f => f.idea).map(f => f.idea);
    if (fi.length) L.push(`📎 FI: ${fi.join(" | ")}`);
  }

  // KEY TAKE (macro summary — first block with body)
  if (s.sections.find(x => x.key === "macro")?.on) {
    const keyBlock = s.macroBlocks.find(b => b.body);
    if (keyBlock) {
      const bodyShort = keyBlock.body.substring(0, 200).replace(/\n/g, " ");
      L.push("", `🔑 KEY: ${bodyShort}${keyBlock.body.length > 200 ? "..." : ""}`);
    }
    const lsPick = s.macroBlocks.find(b => b.lsPick);
    if (lsPick) L.push(`💡 LS VIEW: ${lsPick.lsPick}`);
  }

  // MARKET COLOR (flows — compact)
  if (s.sections.find(x => x.key === "flows")?.on && (s.eqBuyer || s.fiBuyer)) {
    L.push("", `🟢 BUY: ${[s.eqBuyer, s.fiBuyer].filter(Boolean).join(" | ")}`);
    L.push(`🔴 SELL: ${[s.eqSeller, s.fiSeller].filter(Boolean).join(" | ")}`);
  }

  // CORPORATE (compact)
  if (s.sections.find(x => x.key === "corporate")?.on && s.corpBlocks.length) {
    const corpLines = s.corpBlocks.map(c => {
      const r = resolveCorporateBlock(c, s.analysts);
      return `${r.tickers.join("/")} — ${r.headline}`;
    });
    if (corpLines.length) L.push("", `📋 CORPORATE: ${corpLines.join(" | ")}`);
  }

  // LATAM
  if (s.sections.find(x => x.key === "latam")?.on && s.latam) {
    L.push("", `🌎 LATAM: ${s.latam.replace(/\n/g, " ").substring(0, 150)}`);
  }

  // UPCOMING
  if (s.sections.find(x => x.key === "events")?.on && s.events?.length) {
    const evts = s.events.filter(e => e.title).slice(0, 3).map(e => {
      const time = e.timeBUE ? ` ${fmtTime(e.timeBUE)}` : "";
      return `${e.title}${time}`;
    });
    if (evts.length) L.push("", `📅 UPCOMING: ${evts.join(" | ")}`);
  }

  // FOOTER
  L.push("", "---", "LS Research | latinsecurities.com.ar");

  return L.join("\n");
}

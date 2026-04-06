import { formatDate, fmtEventDate, fmtTime } from "./dates";
import { resolveCorporateBlock } from "./ratings";
import { fmtUpside } from "./prices";
import type { DailyState } from "../types";

export function generateBBG(s: DailyState): string {
  const L: string[] = [`🇦🇷 LATIN SECURITIES – Argentina Daily – ${formatDate(s.date)}`];
  if (s.summaryBar) L.push("", s.summaryBar); L.push("", "---");
  const bbgSec: Record<string, () => void> = {
    macro: () => { L.push("", "MACRO / POLITICAL", ""); s.macroBlocks.forEach(b => { L.push(b.title); if (b.body) L.push(b.body); if (b.lsPick) L.push("", `LS pick: ${b.lsPick}`); L.push(""); }); L.push("---"); },
    tradeIdeas: () => { L.push("", "TRADE IDEAS", "", "EQUITY — Research Top Picks:"); s.equityPicks.filter(p=>p.ticker).forEach(p => { L.push(`  ${p.ticker}${p.reason ? ` — ${p.reason}` : ""}`); }); L.push("", "FIXED INCOME:"); s.fiIdeas.filter(f=>f.idea).forEach(f => L.push(`- ${f.idea}${f.reason ? ` — ${f.reason}` : ""}`)); L.push("", "---"); },
    flows: () => { L.push("", "LS TRADING DESK FLOWS", "", `EQUITIES: Buyer ${s.eqBuyer} · Seller ${s.eqSeller}`, `FIXED INCOME: Net buyer ${s.fiBuyer} · Net seller ${s.fiSeller}`, "", "---"); },
    macroEstimates: () => { L.push("", `MACRO ESTIMATES (source: ${s.macroSource})`, ""); s.macroRows.forEach(r => L.push(`${r.label}: ${s.macroCols.map(c => `${c} ${r.vals[c]||""}`).join(" | ")}`)); L.push("", "---"); },
    corporate: () => { L.push("", "CORPORATE", ""); s.corpBlocks.forEach(c => { const r = resolveCorporateBlock(c, s.analysts); L.push(`${r.tickers.join(" / ")} – ${r.headline}`); r.covs.filter(cv=>cv.ticker).forEach(cv => { const ups = fmtUpside(cv.tp, cv.last); L.push(`  ${cv.ticker} | ${cv.rating} | TP ${cv.tp}${cv.last ? ` | Last ${cv.last}` : ""}${ups ? ` | ${ups}` : ""}`); }); L.push(`  ${r.analyst}`); if (r.body) L.push(r.body); if (r.link) L.push(`Link: ${r.link}`); L.push(""); }); L.push("---"); },
    research: () => { if (!s.researchReports?.length) return; L.push("", "RESEARCH REPORTS", ""); s.researchReports.filter(r=>r.title).forEach(r => { L.push(`[${r.type}] ${r.title}`); if (r.author) L.push(`  ${r.author}`); if (r.body) L.push(r.body); if (r.link) L.push(`Link: ${r.link}`); L.push(""); }); L.push("---"); },
    topMovers: () => { const g = s.topMovers?.gainers?.filter(m=>m.ticker) || []; const l = s.topMovers?.losers?.filter(m=>m.ticker) || []; if (!g.length && !l.length) return; L.push("", "TOP MOVERS", ""); if (g.length) { L.push("Gainers:"); g.forEach(m => L.push(`  ${m.ticker}  +${m.chgPct}%${m.comment ? `  ${m.comment}` : ""}`)); } if (l.length) { L.push("Losers:"); l.forEach(m => L.push(`  ${m.ticker}  ${m.chgPct}%${m.comment ? `  ${m.comment}` : ""}`)); } L.push("", "---"); },
    tweets: () => { if (!s.tweets?.length) return; L.push("", "TWEETS / MARKET NOISE", ""); s.tweets.filter(t=>t.content).forEach(t => { L.push(`[${t.sentiment}] ${t.content}`); if (t.impactType && t.impactValue) L.push(`  Impact: ${t.impactType} - ${t.impactValue}`); if (t.time) L.push(`  ${t.time}`); if (t.link) L.push(t.link); L.push(""); }); L.push("---"); },
    bcra: () => { if (!s.bcraData) return; const hidden = s.bcraHiddenRows || {}; const entries = Object.entries(s.bcraData).filter(([k]) => !hidden[k]); if (!entries.length) return; L.push("", "BCRA DASHBOARD", ""); entries.forEach(([k, v]) => { L.push(`${k}: ${v}`); }); L.push("", "---"); },
    events: () => { if (!s.events?.length) return; L.push("", "EVENTS", ""); s.events.filter(e=>e.title).forEach(e => { const datePart = e.date ? fmtEventDate(e.date) : ""; const timeParts = [e.timeET ? `ET ${fmtTime(e.timeET)}` : "", e.timeBUE ? `BUE ${fmtTime(e.timeBUE)}` : "", e.timeLON ? `LON ${fmtTime(e.timeLON)}` : ""].filter(Boolean).join(" / "); L.push(`${datePart}${timeParts ? `  ${timeParts}` : ""}  ${e.title}${e.description ? ` - ${e.description}` : ""}`); }); L.push("", "---"); },
    keyEvents: () => { if (!s.keyEvents?.length) return; L.push("", "KEY EVENTS CALENDAR", ""); s.keyEvents.filter(e=>e.event).forEach(e => { L.push(`${e.date ? fmtEventDate(e.date) : ""}  ${e.event}`); }); L.push("", "---"); },
    chart: () => { if (!s.chartImage?.base64) return; L.push("", "CHART OF THE DAY", ""); if (s.chartImage.title) L.push(s.chartImage.title); if (s.chartImage.caption) L.push(s.chartImage.caption); L.push("", "---"); },
  };
  s.sections.filter(x => x.on).forEach(x => bbgSec[x.key]?.());
  L.push(""); s.signatures.forEach(x => { L.push(x.name, x.role, x.email, ""); }); return L.join("\n");
}

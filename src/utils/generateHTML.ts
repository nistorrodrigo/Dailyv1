import { BRAND } from "../constants/brand";
import { getLogoWhiteB64, getLogoOrigB64 } from "../constants/logos";
import { formatDate, fmtEventDate, fmtTime } from "./dates";
import { rc, rb, resolveCorporateBlock } from "./ratings";
import { fmtUpside, upsideColor, calcUpside } from "./prices";
import { nl2br } from "./text";
import type { DailyState } from "../types";

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
  macro: "Macro / Political", tradeIdeas: "Trade Ideas", flows: "LS Trading Desk Flows",
  macroEstimates: "Macro Estimates", corporate: "Corporate", research: "Research Reports",
  topMovers: "Top Movers", tweets: "Market Noise", bcra: "BCRA Dashboard",
  events: "Events", keyEvents: "Key Events Calendar", chart: "Chart of the Day",
};

// mode: "full" (default) | "toc" (with table of contents) | "compact" (summary only)
export function generateHTML(s: DailyState, mode: string = "full"): string {
  const logo: string = getLogoOrigB64();
  const logoW: string = getLogoWhiteB64();
  const allTickers = s.analysts.flatMap(a => a.coverage.map(c => ({ ticker: c.ticker, rating: c.rating, tp: c.tp, last: c.last || "", analyst: a.name })));

  // MACRO
  const macro = s.sections.find(x => x.key === "macro")?.on ? secHdr("Macro / Political") + '<tr><td style="padding:0 40px 8px;">' + s.macroBlocks.map(b => '<div style="margin-bottom:20px;"><div style="font-size:13px;font-weight:700;color:' + DS.navy + ';text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">' + b.title + '</div><div style="font-size:13.5px;line-height:1.65;color:' + DS.text + ';text-align:justify;">' + nl2br(b.body) + '</div>' + (b.lsPick ? '<div style="background:' + DS.greenBg + ';border-left:3px solid ' + DS.green + ';padding:10px 14px;margin-top:10px;font-size:13px;line-height:1.55;color:' + DS.green + ';"><span style="font-weight:700;">LS View:</span> ' + nl2br(b.lsPick) + '</div>' : '') + '</div>').join("") + '</td></tr>' : "";

  // TRADE IDEAS
  const trade = s.sections.find(x => x.key === "tradeIdeas")?.on ? secHdr("Trade Ideas") + '<tr><td style="padding:0 40px 8px;"><div style="font-size:12px;font-weight:700;color:' + DS.navy + ';text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Equity \u2014 Research Top Picks</div>' + s.equityPicks.filter(p => p.ticker).map(p => {
    const info = allTickers.find(x => x.ticker === p.ticker);
    return '<div style="margin-bottom:8px;"><span style="font-size:13px;font-weight:700;color:' + DS.navy + ';">' + p.ticker + '</span>' + (info ? ' <span style="font-size:11.5px;color:' + DS.textLight + ';">' + info.rating + ' \u00B7 TP ' + info.tp + (info.last ? ' \u00B7 Last ' + info.last : '') + (info.tp && info.last ? ' \u00B7 <span style="color:' + upsideColor(info.tp, info.last) + ';font-weight:600;">' + fmtUpside(info.tp, info.last) + '</span>' : '') + '</span>' : '') + (p.reason ? ' <span style="font-size:12px;color:' + DS.textMuted + ';font-style:italic;">\u2014 ' + p.reason + '</span>' : '') + '</div>';
  }).join("") + '<div style="border-top:1px solid ' + DS.borderLight + ';margin:16px 0;"></div><div style="font-size:12px;font-weight:700;color:' + DS.navy + ';text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Fixed Income</div>' + s.fiIdeas.filter(f => f.idea).map(f => '<div style="margin-bottom:8px;"><div style="font-size:13.5px;line-height:1.55;color:' + DS.text + ';text-align:justify;"><span style="color:' + DS.accent + ';margin-right:6px;">&#9656;</span><strong>' + f.idea + '</strong></div>' + (f.reason ? '<div style="font-size:12.5px;color:' + DS.textLight + ';margin-left:16px;font-style:italic;">' + f.reason + '</div>' : '') + '</div>').join("") + '</td></tr>' : "";

  // FLOWS
  const flow = s.sections.find(x => x.key === "flows")?.on ? secHdr("LS Trading Desk Flows") + '<tr><td style="padding:0 40px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="50%" valign="top" style="padding-right:16px;"><div style="font-size:11px;font-weight:700;color:' + DS.navy + ';text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Equities</div><div style="font-size:13px;line-height:1.65;color:' + DS.text + ';"><span style="color:' + DS.green + ';font-weight:600;">Buy</span> ' + s.eqBuyer + '<br><span style="color:' + DS.red + ';font-weight:600;">Sell</span> ' + s.eqSeller + '</div></td><td width="50%" valign="top" style="padding-left:16px;border-left:1px solid ' + DS.borderLight + ';"><div style="font-size:11px;font-weight:700;color:' + DS.navy + ';text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Fixed Income</div><div style="font-size:13px;line-height:1.65;color:' + DS.text + ';"><span style="color:' + DS.green + ';font-weight:600;">Buy</span> ' + s.fiBuyer + '<br><span style="color:' + DS.red + ';font-weight:600;">Sell</span> ' + s.fiSeller + '</div></td></tr></table></td></tr>' : "";

  // MACRO ESTIMATES
  const mEst = s.sections.find(x => x.key === "macroEstimates")?.on ? secHdr("Macro Estimates") + '<tr><td style="padding:0 40px 8px;"><div style="font-size:10.5px;color:' + DS.textMuted + ';margin-bottom:8px;">Source: ' + s.macroSource + '</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ' + DS.border + ';"><tr style="background:' + DS.bgAlt + ';"><td style="padding:8px 12px;font-size:11px;font-weight:700;color:' + DS.navy + ';width:40%;border-bottom:1px solid ' + DS.border + ';"></td>' + s.macroCols.map(c => '<td style="padding:8px 12px;font-size:11px;font-weight:700;color:' + DS.navy + ';text-align:center;border-bottom:1px solid ' + DS.border + ';border-left:1px solid ' + DS.borderLight + ';">' + c + '</td>').join("") + '</tr>' + s.macroRows.map((r, i) => '<tr style="background:' + (i % 2 === 0 ? "#fff" : DS.bgAlt) + ';"><td style="padding:7px 12px;font-size:12.5px;font-weight:600;color:' + DS.text + ';border-bottom:1px solid ' + DS.borderLight + ';">' + r.label + '</td>' + s.macroCols.map(c => '<td style="padding:7px 12px;font-size:12.5px;color:' + DS.text + ';text-align:center;border-bottom:1px solid ' + DS.borderLight + ';border-left:1px solid ' + DS.borderLight + ';">' + (r.vals[c] || "") + '</td>').join("") + '</tr>').join("") + '</table></td></tr>' : "";

  // CORPORATE
  const corp = s.sections.find(x => x.key === "corporate")?.on ? secHdr("Corporate") + '<tr><td style="padding:0 40px 8px;">' + s.corpBlocks.map(c => { const r = resolveCorporateBlock(c, s.analysts); return '<div style="margin-bottom:22px;"><div style="font-size:13px;font-weight:700;color:' + DS.navy + ';text-transform:uppercase;letter-spacing:0.3px;margin-bottom:4px;">' + r.tickers.join(" / ") + ' \u2014 ' + r.headline + '</div>' + r.covs.filter(cv => cv.ticker).map(cv => '<div style="margin-bottom:2px;font-size:12px;color:' + DS.textLight + ';"><span style="font-weight:600;color:' + rc(cv.rating) + ';">' + cv.ticker + ' ' + cv.rating + '</span> \u00B7 TP ' + cv.tp + (cv.last ? ' \u00B7 Last ' + cv.last : '') + (cv.tp && cv.last ? ' \u00B7 <span style="color:' + upsideColor(cv.tp, cv.last) + ';font-weight:600;">' + fmtUpside(cv.tp, cv.last) + '</span>' : '') + '</div>').join("") + '<div style="font-size:11.5px;color:' + DS.textMuted + ';font-style:italic;margin:4px 0 6px;">' + r.analyst + '</div><div style="font-size:13.5px;line-height:1.65;color:' + DS.text + ';text-align:justify;">' + nl2br(r.body) + '</div>' + (r.link ? '<div style="margin-top:6px;"><a href="' + r.link + '" style="font-size:12px;color:' + DS.accent + ';text-decoration:none;">Full report &#8594;</a></div>' : '') + '</div>'; }).join("") + '</td></tr>' : "";

  // RESEARCH
  const research = s.sections.find(x => x.key === "research")?.on && s.researchReports?.length ? secHdr("Research Reports") + '<tr><td style="padding:0 40px 8px;">' + (s.researchReports || []).filter(r => r.title).map(r => '<div style="margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid ' + DS.borderLight + ';"><div style="margin-bottom:3px;"><span style="font-size:10px;font-weight:700;color:' + DS.accent + ';text-transform:uppercase;letter-spacing:1px;">' + r.type + '</span></div><div style="font-size:13.5px;font-weight:700;color:' + DS.navy + ';margin-bottom:2px;">' + r.title + '</div>' + (r.author ? '<div style="font-size:11.5px;color:' + DS.textMuted + ';font-style:italic;margin-bottom:4px;">' + r.author + '</div>' : '') + (r.body ? '<div style="font-size:13px;line-height:1.6;color:' + DS.text + ';text-align:justify;">' + nl2br(r.body) + '</div>' : '') + (r.link ? '<a href="' + r.link + '" style="font-size:12px;color:' + DS.accent + ';text-decoration:none;">Read report &#8594;</a>' : '') + '</div>').join("") + '</td></tr>' : "";

  // TOP MOVERS
  const topMoversGainers: typeof s.topMovers.gainers = s.topMovers?.gainers?.filter(m => m.ticker) || [];
  const topMoversLosers: typeof s.topMovers.losers = s.topMovers?.losers?.filter(m => m.ticker) || [];
  const topMovers = s.sections.find(x => x.key === "topMovers")?.on && (topMoversGainers.length || topMoversLosers.length) ? secHdr("Top Movers") + '<tr><td style="padding:0 40px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ' + DS.border + ';"><tr style="background:' + DS.bgAlt + ';"><td style="padding:7px 12px;font-size:11px;font-weight:700;color:' + DS.navy + ';border-bottom:1px solid ' + DS.border + ';">Ticker</td><td style="padding:7px 12px;font-size:11px;font-weight:700;color:' + DS.navy + ';text-align:right;border-bottom:1px solid ' + DS.border + ';">Chg</td><td style="padding:7px 12px;font-size:11px;font-weight:700;color:' + DS.navy + ';border-bottom:1px solid ' + DS.border + ';">Comment</td></tr>' + topMoversGainers.map((m, i) => '<tr style="background:' + (i % 2 === 0 ? "#fff" : DS.bgAlt) + ';"><td style="padding:6px 12px;font-size:12.5px;font-weight:600;color:' + DS.text + ';border-bottom:1px solid ' + DS.borderLight + ';">' + m.ticker + '</td><td style="padding:6px 12px;font-size:12.5px;font-weight:700;color:' + DS.green + ';text-align:right;border-bottom:1px solid ' + DS.borderLight + ';">+' + m.chgPct + '%</td><td style="padding:6px 12px;font-size:12px;color:' + DS.textLight + ';border-bottom:1px solid ' + DS.borderLight + ';">' + (m.comment || "") + '</td></tr>').join("") + topMoversLosers.map((m, i) => '<tr style="background:' + (i % 2 === 0 ? "#fff" : DS.bgAlt) + ';"><td style="padding:6px 12px;font-size:12.5px;font-weight:600;color:' + DS.text + ';border-bottom:1px solid ' + DS.borderLight + ';">' + m.ticker + '</td><td style="padding:6px 12px;font-size:12.5px;font-weight:700;color:' + DS.red + ';text-align:right;border-bottom:1px solid ' + DS.borderLight + ';">' + m.chgPct + '%</td><td style="padding:6px 12px;font-size:12px;color:' + DS.textLight + ';border-bottom:1px solid ' + DS.borderLight + ';">' + (m.comment || "") + '</td></tr>').join("") + '</table></td></tr>' : "";

  // TWEETS
  const tweets = s.sections.find(x => x.key === "tweets")?.on && s.tweets?.length ? secHdr("Market Noise") + '<tr><td style="padding:0 40px 8px;">' + s.tweets.filter(t => t.content).map(t => { const sColor = t.sentiment === "Bullish" ? DS.green : t.sentiment === "Bearish" ? DS.red : DS.textMuted; return '<div style="margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid ' + DS.borderLight + ';"><div style="margin-bottom:4px;font-size:11px;"><span style="color:' + sColor + ';font-weight:700;text-transform:uppercase;">' + t.sentiment + '</span>' + (t.impactType && t.impactValue ? ' <span style="color:' + DS.textMuted + ';"> \u00B7 ' + t.impactType + ': ' + t.impactValue + '</span>' : '') + (t.time ? ' <span style="color:' + DS.textMuted + ';"> \u00B7 ' + t.time + '</span>' : '') + '</div><div style="font-size:13.5px;line-height:1.6;color:' + DS.text + ';text-align:justify;">' + nl2br(t.content) + '</div>' + (t.link ? '<a href="' + t.link + '" style="font-size:12px;color:' + DS.accent + ';text-decoration:none;">Source &#8594;</a>' : '') + '</div>'; }).join("") + '</td></tr>' : "";

  // BCRA
  const bcra = s.sections.find(x => x.key === "bcra")?.on && s.bcraData ? (() => { const hidden = s.bcraHiddenRows || {}; const entries = Object.entries(s.bcraData).filter(([k]) => !hidden[k]); if (!entries.length) return ""; return secHdr("BCRA Dashboard") + '<tr><td style="padding:0 40px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ' + DS.border + ';"><tr style="background:' + DS.bgAlt + ';"><td style="padding:7px 12px;font-size:11px;font-weight:700;color:' + DS.navy + ';border-bottom:1px solid ' + DS.border + ';">Indicator</td><td style="padding:7px 12px;font-size:11px;font-weight:700;color:' + DS.navy + ';text-align:right;border-bottom:1px solid ' + DS.border + ';">Value</td></tr>' + entries.map(([k, v], i) => '<tr style="background:' + (i % 2 === 0 ? "#fff" : DS.bgAlt) + ';"><td style="padding:6px 12px;font-size:12.5px;font-weight:600;color:' + DS.text + ';border-bottom:1px solid ' + DS.borderLight + ';">' + k + '</td><td style="padding:6px 12px;font-size:12.5px;color:' + DS.text + ';text-align:right;border-bottom:1px solid ' + DS.borderLight + ';">' + v + '</td></tr>').join("") + '</table></td></tr>'; })() : "";

  // EVENTS
  const events = s.sections.find(x => x.key === "events")?.on && s.events?.length ? secHdr("Events") + '<tr><td style="padding:0 40px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ' + DS.border + ';"><tr style="background:' + DS.bgAlt + ';"><td style="padding:7px 12px;font-size:11px;font-weight:700;color:' + DS.navy + ';border-bottom:1px solid ' + DS.border + ';">Event</td><td style="padding:7px 12px;font-size:11px;font-weight:700;color:' + DS.navy + ';text-align:center;border-bottom:1px solid ' + DS.border + ';">Date</td><td style="padding:7px 12px;font-size:11px;font-weight:700;color:' + DS.navy + ';text-align:center;border-bottom:1px solid ' + DS.border + ';">ET</td><td style="padding:7px 12px;font-size:11px;font-weight:700;color:' + DS.navy + ';text-align:center;border-bottom:1px solid ' + DS.border + ';">BUE</td><td style="padding:7px 12px;font-size:11px;font-weight:700;color:' + DS.navy + ';text-align:center;border-bottom:1px solid ' + DS.border + ';">LON</td></tr>' + s.events.filter(e => e.title).map((e, i) => '<tr style="background:' + (i % 2 === 0 ? "#fff" : DS.bgAlt) + ';"><td style="padding:6px 12px;font-size:12px;color:' + DS.text + ';border-bottom:1px solid ' + DS.borderLight + ';">' + e.title + '</td><td style="padding:6px 12px;font-size:12px;color:' + DS.text + ';text-align:center;border-bottom:1px solid ' + DS.borderLight + ';">' + (e.date ? fmtEventDate(e.date) : "") + '</td><td style="padding:6px 12px;font-size:12px;color:' + DS.text + ';text-align:center;border-bottom:1px solid ' + DS.borderLight + ';">' + (e.timeET ? fmtTime(e.timeET) : "") + '</td><td style="padding:6px 12px;font-size:12px;color:' + DS.text + ';text-align:center;border-bottom:1px solid ' + DS.borderLight + ';">' + (e.timeBUE ? fmtTime(e.timeBUE) : "") + '</td><td style="padding:6px 12px;font-size:12px;color:' + DS.text + ';text-align:center;border-bottom:1px solid ' + DS.borderLight + ';">' + (e.timeLON ? fmtTime(e.timeLON) : "") + '</td></tr>').join("") + '</table></td></tr>' : "";

  // KEY EVENTS
  const keyEvents = s.sections.find(x => x.key === "keyEvents")?.on && s.keyEvents?.length ? secHdr("Key Events Calendar") + '<tr><td style="padding:0 40px 8px;">' + s.keyEvents.filter(e => e.event).map(e => '<div style="padding:4px 0;font-size:13px;color:' + DS.text + ';"><span style="font-weight:700;color:' + DS.navy + ';margin-right:10px;">' + (e.date ? fmtEventDate(e.date) : "") + '</span>' + e.event + '</div>').join("") + '</td></tr>' : "";

  // CHART
  const chart = s.sections.find(x => x.key === "chart")?.on && s.chartImage?.base64 ? secHdr("Chart of the Day") + '<tr><td style="padding:0 40px 8px;">' + (s.chartImage.title ? '<div style="font-size:13.5px;font-weight:700;color:' + DS.navy + ';margin-bottom:10px;">' + s.chartImage.title + '</div>' : '') + '<img src="' + s.chartImage.base64 + '" alt="' + (s.chartImage.title || "Chart") + '" style="max-width:100%;height:auto;display:block;border:1px solid ' + DS.borderLight + ';" />' + (s.chartImage.caption ? '<div style="font-size:11px;color:' + DS.textMuted + ';font-style:italic;margin-top:6px;">' + s.chartImage.caption + '</div>' : '') + '</td></tr>' : "";

  // SIGNATURES
  const sig = s.signatures.map(x => '<div style="margin-bottom:6px;"><span style="font-size:13px;font-weight:600;color:' + DS.navy + ';">' + x.name + '</span><span style="font-size:12px;color:' + DS.textLight + ';margin-left:6px;">' + x.role + '</span><br><span style="font-size:12px;color:' + DS.accent + ';">' + x.email + '</span></div>').join("");

  // SECTION MAP
  const sectionMap: Record<string, string> = { macro, tradeIdeas: trade, flows: flow, macroEstimates: mEst, corporate: corp, research, topMovers, tweets, bcra, events, keyEvents, chart };
  const enabledSections = s.sections.filter(x => x.on);

  // Build Table of Contents
  const tocBlock = '<tr><td style="padding:20px 40px 4px;"><div style="font-size:10px;font-weight:700;color:' + DS.navy + ';text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">In This Issue</div>' + enabledSections.map((sec, i) => '<a href="#sec-' + sec.key + '" style="display:inline-block;font-size:12px;color:' + DS.accent + ';text-decoration:none;margin-right:6px;margin-bottom:4px;">' + SEC_LABELS[sec.key] + (i < enabledSections.length - 1 ? ' <span style="color:' + DS.textMuted + ';">&middot;</span>' : '') + '</a>').join("") + '</td></tr>';

  // Build compact summaries (1-line per section)
  const compactSummaries = {
    macro: s.macroBlocks.length ? s.macroBlocks.map(b => b.title).join(", ") : "",
    tradeIdeas: s.equityPicks.filter(p => p.ticker).map(p => p.ticker).join(", ") + (s.fiIdeas.filter(f => f.idea).length ? " + " + s.fiIdeas.filter(f => f.idea).length + " FI ideas" : ""),
    flows: "EQ: Buy " + (s.eqBuyer || "...").substring(0, 30) + " | FI: Buy " + (s.fiBuyer || "...").substring(0, 30),
    macroEstimates: s.macroRows.length + " metrics, " + s.macroCols.join("/"),
    corporate: s.corpBlocks.map(c => (c.tickers || []).join("/")).filter(Boolean).join(", "),
    research: (s.researchReports || []).filter(r => r.title).map(r => r.title).join(", "),
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
  } else {
    sectionContent = enabledSections.map(x => sectionMap[x.key] || "").join("");
  }

  // FULL TEMPLATE
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Argentina Daily</title></head><body style="margin:0;padding:0;background:#f4f5f7;font-family:\'Segoe UI\',Calibri,Arial,Helvetica,sans-serif;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f5f7;"><tr><td align="center" style="padding:24px 10px;"><table role="presentation" width="' + DS.maxW + '" cellpadding="0" cellspacing="0" border="0" style="max-width:' + DS.maxW + 'px;width:100%;background:#fff;border:1px solid ' + DS.borderLight + ';">'

    // HEADER
    + '<tr><td style="background:' + DS.navy + ';padding:36px 40px 30px;">'
    + '<img src="' + logoW + '" alt="Latin Securities" style="height:32px;display:block;margin-bottom:22px;" />'
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
    + '<tr><td style="padding:24px 40px 0;border-top:1px solid ' + DS.border + ';"><img src="' + logo + '" alt="Latin Securities" style="height:22px;display:block;margin-bottom:12px;opacity:0.6;" />' + sig + '</td></tr>'

    // FOOTER
    + '<tr><td style="padding:20px 40px 24px;"><div style="border-top:1px solid ' + DS.borderLight + ';padding-top:16px;"><div style="font-size:10px;font-weight:600;color:' + DS.textMuted + ';text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Latin Securities S.A.</div><div style="font-size:9.5px;color:' + DS.textMuted + ';line-height:1.6;">Arenales 707, 6th Floor \u00B7 Buenos Aires, Argentina \u00B7 <a href="https://www.latinsecurities.com.ar" style="color:' + DS.accent + ';text-decoration:none;">latinsecurities.com.ar</a></div><div style="font-size:9px;color:#b0b0b0;line-height:1.5;margin-top:10px;">This material has been prepared by Latin Securities S.A. for informational purposes only and does not constitute an offer, solicitation, or recommendation to buy or sell any financial instrument. Past performance is not indicative of future results. This communication is intended solely for the use of the addressee(s) and may contain privileged or confidential information. \u00A9 2026 Latin Securities S.A. All rights reserved.</div></div></td></tr>'

    + '</table></td></tr></table></body></html>';
}

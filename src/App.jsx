import { useState, useRef, useEffect, useCallback } from "react";
const BRAND = { navy: "#000039", blue: "#1e5ab0", sky: "#3399ff", teal: "#23a29e", salmon: "#ebaca2", green: "#acd484", orange: "#ffbe65", lightBg: "#f0f6ff", greenBg: "#f4faf0", salmonBg: "#fdf5f3" };
const LOGO_WHITE_URL = "/logo-white.svg";
const LOGO_ORIG_URL = "/logo.svg";
const LOGO_WHITE_B64 = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNDAgNjgiIGZpbGw9Im5vbmUiPgogIDwhLS0gSWNvbjogc3R5bGl6ZWQgbGVhZi9zaGllbGQgLS0+CiAgPHBhdGggZD0iTTggNTggQzggNTggOCAyOCAyOCAxMiBDMzYgNSA0NiA0IDUwIDQgQzUwIDQgNDIgMTggNDIgMzQgQzQyIDUwIDUwIDYyIDUwIDYyIEM1MCA2MiAzNiA2NiAyMiA2MiBDMTQgNjAgOCA1OCA4IDU4WiIgZmlsbD0iIzZiYTNlYyIvPgogIDxwYXRoIGQ9Ik0yOCA2NCBDMjggNjQgMjggMzQgNDggMTggQzU2IDExIDY2IDEwIDcwIDEwIEM3MCAxMCA2MiAyNCA2MiA0MCBDNjIgNTYgNzAgNjYgNzAgNjYgQzcwIDY2IDU2IDY4IDQyIDY2IEMzNCA2NCAyOCA2NCAyOCA2NFoiIGZpbGw9IiNmZmZmZmYiLz4KICA8IS0tIFRleHQ6IExBVElOIC0tPgogIDx0ZXh0IHg9IjgyIiB5PSIzMiIgZm9udC1mYW1pbHk9IidTZWdvZSBVSScsJ0hlbHZldGljYSBOZXVlJyxBcmlhbCxzYW5zLXNlcmlmIiBmb250LXNpemU9IjI2IiBmb250LXdlaWdodD0iNzAwIiBsZXR0ZXItc3BhY2luZz0iMi41IiBmaWxsPSIjZmZmZmZmIj5MQVRJTjwvdGV4dD4KICA8IS0tIFRleHQ6IFNFQ1VSSVRJRVMgLS0+CiAgPHRleHQgeD0iODIiIHk9IjU4IiBmb250LWZhbWlseT0iJ1NlZ29lIFVJJywnSGVsdmV0aWNhIE5ldWUnLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjYiIGZvbnQtd2VpZ2h0PSI3MDAiIGxldHRlci1zcGFjaW5nPSIyLjUiIGZpbGw9IiNmZmZmZmYiPlNFQ1VSSVRJRVM8L3RleHQ+Cjwvc3ZnPgo=";
const LOGO_ORIG_B64 = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNDAgNjgiIGZpbGw9Im5vbmUiPgogIDwhLS0gSWNvbjogc3R5bGl6ZWQgbGVhZi9zaGllbGQgLS0+CiAgPHBhdGggZD0iTTggNTggQzggNTggOCAyOCAyOCAxMiBDMzYgNSA0NiA0IDUwIDQgQzUwIDQgNDIgMTggNDIgMzQgQzQyIDUwIDUwIDYyIDUwIDYyIEM1MCA2MiAzNiA2NiAyMiA2MiBDMTQgNjAgOCA1OCA4IDU4WiIgZmlsbD0iIzVDOEZEOCIvPgogIDxwYXRoIGQ9Ik0yOCA2NCBDMjggNjQgMjggMzQgNDggMTggQzU2IDExIDY2IDEwIDcwIDEwIEM3MCAxMCA2MiAyNCA2MiA0MCBDNjIgNTYgNzAgNjYgNzAgNjYgQzcwIDY2IDU2IDY4IDQyIDY2IEMzNCA2NCAyOCA2NCAyOCA2NFoiIGZpbGw9IiMwZDBlMzciLz4KICA8IS0tIFRleHQ6IExBVElOIC0tPgogIDx0ZXh0IHg9IjgyIiB5PSIzMiIgZm9udC1mYW1pbHk9IidTZWdvZSBVSScsJ0hlbHZldGljYSBOZXVlJyxBcmlhbCxzYW5zLXNlcmlmIiBmb250LXNpemU9IjI2IiBmb250LXdlaWdodD0iNzAwIiBsZXR0ZXItc3BhY2luZz0iMi41IiBmaWxsPSIjMGQwZTM3Ij5MQVRJTjwvdGV4dD4KICA8IS0tIFRleHQ6IFNFQ1VSSVRJRVMgLS0+CiAgPHRleHQgeD0iODIiIHk9IjU4IiBmb250LWZhbWlseT0iJ1NlZ29lIFVJJywnSGVsdmV0aWNhIE5ldWUnLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjYiIGZvbnQtd2VpZ2h0PSI3MDAiIGxldHRlci1zcGFjaW5nPSIyLjUiIGZpbGw9IiMwZDBlMzciPlNFQ1VSSVRJRVM8L3RleHQ+Cjwvc3ZnPgo=";

const DEFAULT_ANALYSTS = [
  { id: "a1", name: "George Gasztowtt", title: "O&G Analyst", coverage: [
    { ticker: "VIST", rating: "Overweight", tp: "$68.00" },
    { ticker: "YPF", rating: "Overweight", tp: "$45.00" },
    { ticker: "PAM", rating: "Neutral", tp: "$85.00" },
  ]},
  { id: "a2", name: "Pedro Offenhenden", title: "Financials Analyst", coverage: [
    { ticker: "BMA", rating: "Neutral", tp: "$100.00" },
    { ticker: "BBAR", rating: "Overweight", tp: "$18.00" },
    { ticker: "GGAL", rating: "Overweight", tp: "$95.00" },
    { ticker: "SUPV", rating: "Overweight", tp: "$30.00" },
  ]},
];

const DEFAULT_STATE = {
  date: new Date().toISOString().split("T")[0],
  showMacro: true, showTradeIdeas: true, showFlows: true, showMacroEstimates: true, showCorporate: true,
  summaryBar: "",
  macroBlocks: [{ id: "1", title: "TREASURY AUCTION RESULTS", body: "", lsPick: "" }, { id: "2", title: "FX / BCRA", body: "", lsPick: "" }],
  equityPicks: [{ticker:"BBAR",reason:""},{ticker:"VIST",reason:""},{ticker:"IRS",reason:""},{ticker:"CAAP",reason:""}],
  fiIdeas: [{idea:"Long ARGENT 35/38",reason:"Attractive yield on long-duration sovereign"},{idea:"Long end of BONCAP curve (Apr/May/Jun 2027)",reason:""},{idea:"RV: Sell BONTE 30 / Buy long-end BONCAP curve",reason:""},{idea:"Long BONCER 2028",reason:""}],
  eqBuyer: "bank names (BBAR, BMA, GGAL)", eqSeller: "O&G names (VIST, YPF, PAM)",
  fiBuyer: "ST Bonares, ARGENT 35/38, BONTE 30, EDNAR 30", fiSeller: "ARGENT 29/30, YPFDAR 34",
  macroSource: "REM (BCRA) Jan-26",
  macroRows: [
    { label: "CPI m/m (Mar\u2192Jun)", v2026: "2.2% \u2192 1.6%", v2027: "\u2014" },
    { label: "CPI full year", v2026: "22.4%", v2027: "~10%" },
    { label: "GDP growth", v2026: "3.2%", v2027: "4.0%" },
    { label: "FX EoP ($/USD)", v2026: "1,750", v2027: "~2,100" },
    { label: "FX avg ($/USD)", v2026: "~1,600", v2027: "~1,900" },
  ],
  corpBlocks: [{ id: "c1", ticker: "VIST", headline: "4Q25 SNAPSHOT: IN THE GROOVE", analystId: "a1", body: "", link: "" }],
  signatures: [{ id: "s1", name: "Rodrigo Nistor", role: "Institutional Sales", email: "rodrigo.nistor@latinsecurities.ar" }],
  analysts: DEFAULT_ANALYSTS,
};

const formatDate = (iso) => { const d = new Date(iso + "T12:00:00"); return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }); };
const rc = (r) => { const l = (r||"").toLowerCase(); return l === "overweight" ? "#27864a" : l === "neutral" ? "#e6a817" : l === "underweight" ? "#c0392b" : "#666"; };
const rb = (r) => { const l = (r||"").toLowerCase(); return l === "overweight" ? "#e8f5e9" : l === "neutral" ? "#fff8e1" : l === "underweight" ? "#fbe9e7" : "#f5f5f5"; };

function res(c, analysts) {
  const a = analysts.find(x => x.id === c.analystId);
  const cv = a ? a.coverage.find(x => x.ticker === c.ticker) : null;
  return { ticker: c.ticker, headline: c.headline, rating: cv ? cv.rating : "Neutral", tp: cv ? cv.tp : "", analyst: a ? `${a.name}, ${a.title}` : "", body: c.body, link: c.link };
}

function generateHTML(s) {
  const B = BRAND;
  const macro = s.showMacro ? `<tr><td style="padding:0 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;"><tr><td><div style="font-size:11px;font-weight:700;color:#fff;background:${B.blue};text-transform:uppercase;letter-spacing:1.5px;padding:5px 12px;display:inline-block;">Macro / Political</div></td></tr></table>${s.macroBlocks.map(b => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;border-bottom:1px solid #e4e8ed;padding-bottom:12px;"><tr><td><div style="font-size:12.5px;font-weight:700;color:${B.navy};text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;padding-bottom:4px;border-bottom:2px solid ${B.sky};display:inline-block;">${b.title}</div><div style="font-size:13px;line-height:1.55;color:#333;margin-top:4px;">${b.body}</div>${b.lsPick ? `<div style="background:${B.greenBg};border-left:3px solid ${B.green};padding:8px 12px;margin-top:8px;font-size:12.5px;line-height:1.5;color:#2d5a25;"><strong>LS pick:</strong> ${b.lsPick}</div>` : ""}</td></tr></table>`).join("")}</td></tr>` : "";
  const allTickers = s.analysts.flatMap(a => a.coverage.map(c => ({ ticker: c.ticker, rating: c.rating, tp: c.tp, analyst: a.name })));
  const trade = s.showTradeIdeas ? `<tr><td style="padding:0 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;"><tr><td><div style="font-size:11px;font-weight:700;color:#fff;background:${B.blue};text-transform:uppercase;letter-spacing:1.5px;padding:5px 12px;display:inline-block;">Trade Ideas</div></td></tr></table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;"><tr><td><div style="font-size:12.5px;font-weight:700;color:${B.navy};margin-bottom:6px;">Equity \u2014 Research Top Picks</div>${s.equityPicks.filter(p=>p.ticker).map(p => { const info = allTickers.find(x => x.ticker === p.ticker); return `<div style="margin-bottom:6px;"><span style="display:inline-block;background:${info ? rc(info.rating) : B.navy};color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:3px;">${p.ticker}</span>${info ? `<span style="font-size:11px;color:#666;margin-left:6px;">${info.rating} | TP ${info.tp}</span>` : ""}${p.reason ? `<div style="font-size:12px;color:#555;margin-top:2px;margin-left:4px;font-style:italic;">${p.reason}</div>` : ""}</div>`; }).join("")}</td></tr></table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;border-bottom:1px solid #e4e8ed;padding-bottom:12px;"><tr><td><div style="font-size:12.5px;font-weight:700;color:${B.navy};margin-bottom:6px;">Fixed Income</div>${s.fiIdeas.filter(f=>f.idea).map(f => `<div style="margin-bottom:6px;"><div style="font-size:13px;line-height:1.5;color:#333;">&#9654; <strong>${f.idea}</strong></div>${f.reason ? `<div style="font-size:12px;color:#555;margin-left:18px;font-style:italic;">${f.reason}</div>` : ""}</div>`).join("")}</td></tr></table></td></tr>` : "";
  const flow = s.showFlows ? `<tr><td style="padding:0 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;"><tr><td><div style="font-size:11px;font-weight:700;color:#fff;background:${B.blue};text-transform:uppercase;letter-spacing:1.5px;padding:5px 12px;display:inline-block;">LS Trading Desk Flows</div></td></tr></table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;border-bottom:1px solid #e4e8ed;padding-bottom:12px;"><tr><td width="50%" valign="top" style="padding-right:12px;"><div style="font-size:11px;font-weight:700;color:${B.navy};text-transform:uppercase;margin-bottom:4px;">Equities</div><div style="font-size:13px;line-height:1.55;color:#333;"><span style="color:#27864a;font-weight:600;">\u25B2 Buyer</span> ${s.eqBuyer}<br><span style="color:#c0392b;font-weight:600;">\u25BC Seller</span> ${s.eqSeller}</div></td><td width="50%" valign="top" style="padding-left:12px;border-left:1px solid #e4e8ed;"><div style="font-size:11px;font-weight:700;color:${B.navy};text-transform:uppercase;margin-bottom:4px;">Fixed Income</div><div style="font-size:13px;line-height:1.55;color:#333;"><span style="color:#27864a;font-weight:600;">\u25B2 Net buyer</span> ${s.fiBuyer}<br><span style="color:#c0392b;font-weight:600;">\u25BC Net seller</span> ${s.fiSeller}</div></td></tr></table></td></tr>` : "";
  const mEst = s.showMacroEstimates ? `<tr><td style="padding:0 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;"><tr><td><div style="font-size:11px;font-weight:700;color:#fff;background:${B.blue};text-transform:uppercase;letter-spacing:1.5px;padding:5px 12px;display:inline-block;">Macro Estimates</div></td></tr></table><div style="font-size:10px;color:#666;margin-bottom:6px;">Source: ${s.macroSource}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dde3ea;margin-bottom:16px;"><tr style="background:${B.navy};"><td style="padding:6px 10px;font-size:11px;font-weight:700;color:#fff;width:40%;"></td><td style="padding:6px 10px;font-size:11px;font-weight:700;color:#fff;text-align:center;">2026</td><td style="padding:6px 10px;font-size:11px;font-weight:700;color:#fff;text-align:center;">2027</td></tr>${s.macroRows.map((r,i) => `<tr style="background:${i%2===0?"#f8fafc":"#fff"};"><td style="padding:6px 10px;font-size:12px;font-weight:600;color:#333;border-right:1px solid #e4e8ed;border-bottom:1px solid #e4e8ed;">${r.label}</td><td style="padding:6px 10px;font-size:12px;color:#333;text-align:center;border-right:1px solid #e4e8ed;border-bottom:1px solid #e4e8ed;">${r.v2026}</td><td style="padding:6px 10px;font-size:12px;color:#333;text-align:center;border-bottom:1px solid #e4e8ed;">${r.v2027}</td></tr>`).join("")}</table></td></tr>` : "";
  const corp = s.showCorporate ? `<tr><td style="padding:0 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;"><tr><td><div style="font-size:11px;font-weight:700;color:#fff;background:${B.blue};text-transform:uppercase;letter-spacing:1.5px;padding:5px 12px;display:inline-block;">Corporate</div></td></tr></table>${s.corpBlocks.map(c => { const r = res(c, s.analysts); return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;border-bottom:1px solid #e4e8ed;padding-bottom:12px;"><tr><td><div style="font-size:12.5px;font-weight:700;color:${B.navy};text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">${r.ticker} \u2014 ${r.headline}</div><div style="margin-bottom:6px;"><span style="display:inline-block;background:${rb(r.rating)};color:${rc(r.rating)};font-size:11px;font-weight:700;padding:3px 8px;border-radius:3px;">${r.rating}</span><span style="font-size:12px;color:#333;margin-left:6px;">TP ${r.tp} | <em>${r.analyst}</em></span></div><div style="font-size:13px;line-height:1.55;color:#333;">${r.body}</div>${r.link ? `<div style="margin-top:6px;"><a href="${r.link}" style="font-size:12px;color:${B.blue};">Full LS report \u2192</a></div>` : ""}</td></tr></table>`; }).join("")}</td></tr>` : "";
  const sig = s.signatures.map(x => `<div style="margin-bottom:8px;"><div style="font-size:13px;font-weight:700;color:${B.navy};">${x.name}</div><div style="font-size:12px;color:#666;">${x.role}</div><div style="font-size:12px;color:${B.blue};">${x.email}</div></div>`).join("");
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Argentina Daily</title></head><body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Calibri,Arial,sans-serif;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f2f5;"><tr><td align="center" style="padding:20px 10px;"><table role="presentation" width="680" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;width:100%;background:#fff;"><tr><td style="background:${B.navy};padding:24px 32px 20px;border-bottom:3px solid ${B.sky};"><img src="${LOGO_WHITE_B64}" alt="Latin Securities" style="height:36px;display:block;" /><div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${B.sky};margin-top:4px;">Sales &amp; Trading</div><div style="font-size:20px;font-weight:600;color:#fff;margin-top:14px;">&#127462;&#127479; Argentina Daily</div><div style="font-size:12px;color:#8aa8d4;margin-top:2px;">${formatDate(s.date)}</div></td></tr>${s.summaryBar ? `<tr><td style="background:${B.lightBg};border-left:4px solid ${B.blue};padding:14px 24px;font-size:13.5px;line-height:1.55;color:${B.navy};"><strong>Today:</strong> ${s.summaryBar}</td></tr>` : ""}<tr><td style="padding:22px 0 0;"></td></tr>${macro}${trade}${flow}${mEst}${corp}<tr><td style="padding:12px 32px 0;border-top:1px solid #e4e8ed;"><img src="${LOGO_ORIG_B64}" alt="Latin Securities" style="height:30px;display:block;margin-bottom:10px;" />${sig}</td></tr><tr><td style="padding:16px 0 0;"></td></tr><tr><td style="background:${B.navy};padding:14px 24px;border-top:2px solid ${B.sky};"><div style="font-size:10px;font-weight:700;color:${B.sky};margin-bottom:4px;">LATIN SECURITIES S.A.</div><div style="font-size:9px;color:#8aa8d4;line-height:1.5;">Arenales 707, 6th Floor \u00B7 Buenos Aires, Argentina \u00B7 www.latinsecurities.com.ar<br><br>This material is for informational purposes only and does not constitute an offer to buy or sell any financial instrument. \u00A9 2026 Latin Securities S.A.</div></td></tr></table></td></tr></table></body></html>`;
}

function generateBBG(s) {
  let L = [`\uD83C\uDDE6\uD83C\uDDF7 LATIN SECURITIES \u2013 Argentina Daily \u2013 ${formatDate(s.date)}`];
  if (s.summaryBar) L.push("", s.summaryBar); L.push("", "---");
  if (s.showMacro) { L.push("", "MACRO / POLITICAL", ""); s.macroBlocks.forEach(b => { L.push(b.title); if (b.body) L.push(b.body); if (b.lsPick) L.push("", `LS pick: ${b.lsPick}`); L.push(""); }); L.push("---"); }
  if (s.showTradeIdeas) { L.push("", "TRADE IDEAS", "", "EQUITY \u2014 Research Top Picks:"); s.equityPicks.filter(p=>p.ticker).forEach(p => { L.push(`  ${p.ticker}${p.reason ? ` — ${p.reason}` : ""}`); }); L.push("", "FIXED INCOME:"); s.fiIdeas.filter(f=>f.idea).forEach(f => L.push(`- ${f.idea}${f.reason ? ` — ${f.reason}` : ""}`)); L.push("", "---"); }
  if (s.showFlows) { L.push("", "LS TRADING DESK FLOWS", "", `EQUITIES: Buyer ${s.eqBuyer} \u00B7 Seller ${s.eqSeller}`, `FIXED INCOME: Net buyer ${s.fiBuyer} \u00B7 Net seller ${s.fiSeller}`, "", "---"); }
  if (s.showMacroEstimates) { L.push("", `MACRO ESTIMATES (source: ${s.macroSource})`, ""); s.macroRows.forEach(r => L.push(`${r.label}: 2026 ${r.v2026} | 2027 ${r.v2027}`)); L.push("", "---"); }
  if (s.showCorporate) { L.push("", "CORPORATE", ""); s.corpBlocks.forEach(c => { const r = res(c, s.analysts); L.push(`${r.ticker} \u2013 ${r.headline} | ${r.rating} | TP ${r.tp} | ${r.analyst}`); if (r.body) L.push(r.body); if (r.link) L.push(`Link: ${r.link}`); L.push(""); }); L.push("---"); }
  L.push(""); s.signatures.forEach(x => { L.push(x.name, x.role, x.email, ""); }); return L.join("\n");
}

const Toggle = ({ checked, onChange, label }) => (<label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}><div onClick={() => onChange(!checked)} style={{ width: 40, height: 22, borderRadius: 11, position: "relative", background: checked ? BRAND.blue : "#c8cdd3", transition: "background 0.2s" }}><div style={{ width: 18, height: 18, borderRadius: 9, background: "#fff", position: "absolute", top: 2, left: checked ? 20 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} /></div><span style={{ fontSize: 13, fontWeight: 600, color: checked ? BRAND.navy : "#999" }}>{label}</span></label>);
const Card = ({ title, children, color = BRAND.blue }) => (<div style={{ background: "#fff", borderRadius: 8, marginBottom: 12, border: "1px solid #e4e8ed", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,57,0.06)" }}><div style={{ background: color, padding: "8px 16px", fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: 1.2, textTransform: "uppercase" }}>{title}</div><div style={{ padding: 16 }}>{children}</div></div>);
const Inp = ({ label, value, onChange, multi, rows = 2, placeholder }) => (<div style={{ marginBottom: 10 }}>{label && <label style={{ fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>{label}</label>}{multi ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d0d5dd", fontSize: 13, fontFamily: "'Segoe UI',sans-serif", resize: "vertical", lineHeight: 1.5, boxSizing: "border-box" }} /> : <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d0d5dd", fontSize: 13, fontFamily: "'Segoe UI',sans-serif", boxSizing: "border-box" }} />}</div>);
const X = ({ onClick }) => <button onClick={onClick} style={{ background: "none", border: "none", color: "#c0392b", cursor: "pointer", fontSize: 18, padding: "0 4px", lineHeight: 1 }}>{"\u00D7"}</button>;
const DashBtn = ({ onClick, children, color = BRAND.blue }) => <button onClick={onClick} style={{ width: "100%", padding: 10, border: "2px dashed #d0d5dd", borderRadius: 6, background: "transparent", color, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>{children}</button>;

const STORAGE_KEY = "ls-daily-builder-state";
const loadState = () => { try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) { const saved = JSON.parse(raw); return { ...DEFAULT_STATE, ...saved }; } } catch(e) {} return DEFAULT_STATE; };
const saveState = (state) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e) {} };

export default function App() {
  const [s, setS] = useState(loadState);
  const [tab, setTab] = useState("edit");
  const [pm, setPm] = useState("html");
  const [cp, setCp] = useState("");
  const [saved, setSaved] = useState(false);
  const ref = useRef(null);

  // Auto-save on every state change
  useEffect(() => { saveState(s); setSaved(true); const t = setTimeout(() => setSaved(false), 1500); return () => clearTimeout(t); }, [s]);

  const resetState = () => { if (window.confirm("Reset all fields to defaults? This cannot be undone.")) { setS(DEFAULT_STATE); localStorage.removeItem(STORAGE_KEY); } };
  const newDaily = () => { if (window.confirm("Start a new daily? Analyst database will be kept, content fields will be cleared.")) { setS(prev => ({ ...DEFAULT_STATE, analysts: prev.analysts, signatures: prev.signatures, date: new Date().toISOString().split("T")[0] })); } };
  const u = f => v => setS(p => ({ ...p, [f]: v }));
  const ul = (f, id, k, v) => setS(p => ({ ...p, [f]: p[f].map(x => x.id === id ? { ...x, [k]: v } : x) }));
  const al = (f, item) => setS(p => ({ ...p, [f]: [...p[f], item] }));
  const rl = (f, id) => setS(p => ({ ...p, [f]: p[f].filter(x => x.id !== id) }));
  const uc = (aid, ci, k, v) => setS(p => ({ ...p, analysts: p.analysts.map(a => a.id === aid ? { ...a, coverage: a.coverage.map((c, i) => i === ci ? { ...c, [k]: v } : c) } : a) }));
  const ac = aid => setS(p => ({ ...p, analysts: p.analysts.map(a => a.id === aid ? { ...a, coverage: [...a.coverage, { ticker: "", rating: "Neutral", tp: "" }] } : a) }));
  const dc = (aid, ci) => setS(p => ({ ...p, analysts: p.analysts.map(a => a.id === aid ? { ...a, coverage: a.coverage.filter((_, i) => i !== ci) } : a) }));
  const ufi = (i, v) => setS(p => { const a = [...p.fiIdeas]; a[i] = v; return { ...p, fiIdeas: a }; });
  const umr = (i, f, v) => setS(p => { const a = [...p.macroRows]; a[i] = { ...a[i], [f]: v }; return { ...p, macroRows: a }; });
  const copy = (t, l) => { navigator.clipboard.writeText(t).then(() => { setCp(l); setTimeout(() => setCp(""), 2000); }); };
  const html = generateHTML(s), bbg = generateBBG(s);
  const ts = t => ({ padding: "10px 20px", cursor: "pointer", fontSize: 13, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", border: "none", borderBottom: tab === t ? `3px solid ${BRAND.sky}` : "3px solid transparent", background: tab === t ? BRAND.navy : "transparent", color: tab === t ? "#fff" : "#666", transition: "all 0.2s" });
  const is = { padding: "6px 8px", borderRadius: 4, border: "1px solid #d0d5dd", fontSize: 12, boxSizing: "border-box" };
  const ss = { ...is, background: "#fff" };

  return (
    <div style={{ minHeight: "100vh", background: "#f0f2f5", fontFamily: "'Segoe UI',Calibri,Arial,sans-serif" }}>
      <div style={{ background: BRAND.navy, padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `3px solid ${BRAND.sky}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}><img src={LOGO_WHITE_URL} alt="LS" style={{ height: 28 }} /><div style={{ fontSize: 10, letterSpacing: 1, color: BRAND.sky, textTransform: "uppercase" }}>Daily Builder</div></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {saved && <span style={{ fontSize: 10, color: BRAND.green, fontWeight: 600, letterSpacing: 0.5 }}>{"\u2713"} SAVED</span>}
          <button onClick={newDaily} style={{ padding: "7px 16px", borderRadius: 6, border: `1px solid ${BRAND.orange}`, background: "transparent", color: BRAND.orange, fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "uppercase" }}>New Daily</button>
          <button onClick={() => copy(html, "html")} style={{ padding: "7px 16px", borderRadius: 6, border: `1px solid ${BRAND.sky}`, background: "transparent", color: BRAND.sky, fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "uppercase" }}>{cp === "html" ? "\u2713 Copied!" : "Copy HTML"}</button>
          <button onClick={() => copy(bbg, "bbg")} style={{ padding: "7px 16px", borderRadius: 6, border: `1px solid ${BRAND.green}`, background: "transparent", color: BRAND.green, fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "uppercase" }}>{cp === "bbg" ? "\u2713 Copied!" : "Copy BBG"}</button>
        </div>
      </div>
      <div style={{ display: "flex", background: "#fff", borderBottom: "1px solid #e4e8ed" }}>
        <button onClick={() => setTab("edit")} style={ts("edit")}>Editor</button>
        <button onClick={() => setTab("analysts")} style={ts("analysts")}>Analysts</button>
        <button onClick={() => setTab("preview")} style={ts("preview")}>Preview</button>
      </div>

      {tab === "analysts" && (
        <div style={{ maxWidth: 800, margin: "0 auto", padding: 20 }}>
          <Card title="Research Analyst Database" color={BRAND.navy}>
            <p style={{ fontSize: 12, color: "#666", margin: "0 0 12px", lineHeight: 1.5 }}>Manage analysts and their coverage. Rating and TP auto-populate in the Corporate section.</p>
            {s.analysts.map(a => (
              <div key={a.id} style={{ padding: 14, background: "#fafbfc", borderRadius: 8, marginBottom: 14, border: "1px solid #eee" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", gap: 8, flex: 1 }}>
                    <input value={a.name} onChange={e => ul("analysts", a.id, "name", e.target.value)} placeholder="Name" style={{ ...is, fontWeight: 700, flex: 2 }} />
                    <input value={a.title} onChange={e => ul("analysts", a.id, "title", e.target.value)} placeholder="Title" style={{ ...is, flex: 2 }} />
                  </div>
                  <X onClick={() => rl("analysts", a.id)} />
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: BRAND.navy, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Coverage Universe</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr style={{ background: BRAND.blue }}>
                    <th style={{ padding: "5px 8px", fontSize: 10, color: "#fff", textAlign: "left", width: "25%" }}>Ticker</th>
                    <th style={{ padding: "5px 8px", fontSize: 10, color: "#fff", textAlign: "left", width: "30%" }}>Rating</th>
                    <th style={{ padding: "5px 8px", fontSize: 10, color: "#fff", textAlign: "left", width: "25%" }}>TP</th>
                    <th style={{ padding: "5px 8px", fontSize: 10, color: "#fff", width: "20%" }}></th>
                  </tr></thead>
                  <tbody>{a.coverage.map((cv, ci) => (
                    <tr key={ci} style={{ background: ci % 2 === 0 ? "#fff" : "#f8fafc" }}>
                      <td style={{ padding: 3 }}><input value={cv.ticker} onChange={e => uc(a.id, ci, "ticker", e.target.value.toUpperCase())} style={{ ...is, width: "100%", fontWeight: 700 }} /></td>
                      <td style={{ padding: 3 }}><select value={cv.rating} onChange={e => uc(a.id, ci, "rating", e.target.value)} style={{ ...ss, width: "100%", color: rc(cv.rating), fontWeight: 600 }}><option value="Overweight">Overweight</option><option value="Neutral">Neutral</option><option value="Underweight">Underweight</option></select></td>
                      <td style={{ padding: 3 }}><input value={cv.tp} onChange={e => uc(a.id, ci, "tp", e.target.value)} placeholder="$0.00" style={{ ...is, width: "100%" }} /></td>
                      <td style={{ padding: 3, textAlign: "center" }}><X onClick={() => dc(a.id, ci)} /></td>
                    </tr>
                  ))}</tbody>
                </table>
                <button onClick={() => ac(a.id)} style={{ marginTop: 6, padding: "5px 14px", border: "1px dashed #d0d5dd", borderRadius: 4, background: "transparent", color: BRAND.teal, fontWeight: 600, fontSize: 11, cursor: "pointer" }}>+ Add Ticker</button>
              </div>
            ))}
            <DashBtn onClick={() => al("analysts", { id: `a${Date.now()}`, name: "", title: "", coverage: [] })}>+ Add Analyst</DashBtn>
          </Card>
        </div>
      )}

      {tab === "edit" && (
        <div style={{ maxWidth: 800, margin: "0 auto", padding: 20 }}>
          <Card title="General" color={BRAND.navy}>
            <Inp label="Date" value={s.date} onChange={u("date")} />
            <Inp label="Summary bar" value={s.summaryBar} onChange={u("summaryBar")} multi rows={3} placeholder="Summary with \u2022" />
          </Card>
          <Card title="Sections" color={BRAND.navy}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Toggle checked={s.showMacro} onChange={u("showMacro")} label="Macro / Political" />
              <Toggle checked={s.showTradeIdeas} onChange={u("showTradeIdeas")} label="Trade Ideas" />
              <Toggle checked={s.showFlows} onChange={u("showFlows")} label="LS Desk Flows" />
              <Toggle checked={s.showMacroEstimates} onChange={u("showMacroEstimates")} label="Macro Estimates" />
              <Toggle checked={s.showCorporate} onChange={u("showCorporate")} label="Corporate" />
            </div>
          </Card>
          {s.showMacro && <Card title="Macro / Political">{s.macroBlocks.map(b => (<div key={b.id} style={{ padding: 12, background: "#fafbfc", borderRadius: 6, marginBottom: 10, border: "1px solid #eee" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}><input value={b.title} onChange={e => ul("macroBlocks", b.id, "title", e.target.value)} style={{ fontSize: 12, fontWeight: 700, border: "none", background: "transparent", color: BRAND.navy, textTransform: "uppercase", letterSpacing: 0.5, width: "80%" }} /><X onClick={() => rl("macroBlocks", b.id)} /></div><Inp label="Body" value={b.body} onChange={v => ul("macroBlocks", b.id, "body", v)} multi rows={3} /><Inp label="LS Pick" value={b.lsPick} onChange={v => ul("macroBlocks", b.id, "lsPick", v)} placeholder="Optional" /></div>))}<DashBtn onClick={() => al("macroBlocks", { id: Date.now().toString(), title: "NEW SECTION", body: "", lsPick: "" })}>+ Add Macro Block</DashBtn></Card>}
          {s.showTradeIdeas && <Card title="Trade Ideas" color={BRAND.teal}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Equity Top Picks</label>
              {s.equityPicks.map((pk, i) => {
                const allTk = s.analysts.flatMap(a => a.coverage.map(c => ({ ticker: c.ticker, rating: c.rating, analyst: a.name, tp: c.tp })));
                const info = allTk.find(x => x.ticker === pk.ticker);
                const upk = (k, v) => setS(p => { const a = [...p.equityPicks]; a[i] = { ...a[i], [k]: v }; return { ...p, equityPicks: a }; });
                return (<div key={i} style={{ padding: 10, background: "#fff", borderRadius: 6, marginBottom: 8, border: "1px solid #eee" }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 4, alignItems: "center" }}>
                    <select value={pk.ticker} onChange={e => upk("ticker", e.target.value)} style={{ ...is, flex: 1, fontWeight: 700, color: info ? rc(info.rating) : "#333" }}>
                      <option value="">— Select ticker —</option>
                      {s.analysts.map(a => <optgroup key={a.id} label={`${a.name} (${a.title})`}>{a.coverage.filter(c => c.ticker).map(c => <option key={c.ticker} value={c.ticker}>{c.ticker} — {c.rating} | TP {c.tp}</option>)}</optgroup>)}
                      {pk.ticker && !allTk.find(x => x.ticker === pk.ticker) && <option value={pk.ticker}>{pk.ticker} (custom)</option>}
                    </select>
                    {info && <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 3, background: rb(info.rating), color: rc(info.rating), fontWeight: 700, whiteSpace: "nowrap" }}>{info.rating}</span>}
                    <input value={pk.ticker} onChange={e => upk("ticker", e.target.value.toUpperCase())} placeholder="or type" style={{ ...is, width: 80, fontWeight: 700, textAlign: "center" }} />
                    <X onClick={() => setS(p => ({ ...p, equityPicks: p.equityPicks.filter((_, j) => j !== i) }))} />
                  </div>
                  <input value={pk.reason} onChange={e => upk("reason", e.target.value)} placeholder="Why this pick? (optional)" style={{ ...is, width: "100%", fontSize: 12, fontStyle: "italic", color: "#555" }} />
                </div>);
              })}
              <button onClick={() => setS(p => ({ ...p, equityPicks: [...p.equityPicks, {ticker:"",reason:""}] }))} style={{ padding: "6px 14px", border: "1px dashed #d0d5dd", borderRadius: 6, background: "transparent", color: BRAND.teal, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>+ Add Equity Pick</button>
            </div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Fixed Income Ideas</label>
            {s.fiIdeas.map((fi, i) => {
              const uif = (k, v) => setS(p => { const a = [...p.fiIdeas]; a[i] = { ...a[i], [k]: v }; return { ...p, fiIdeas: a }; });
              return (<div key={i} style={{ padding: 10, background: "#fff", borderRadius: 6, marginBottom: 8, border: "1px solid #eee" }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                  <input value={fi.idea} onChange={e => uif("idea", e.target.value)} placeholder="Trade idea" style={{ flex: 1, ...is, fontSize: 13, fontWeight: 600 }} />
                  <X onClick={() => setS(p => ({ ...p, fiIdeas: p.fiIdeas.filter((_, j) => j !== i) }))} />
                </div>
                <input value={fi.reason} onChange={e => uif("reason", e.target.value)} placeholder="Rationale (optional)" style={{ ...is, width: "100%", fontSize: 12, fontStyle: "italic", color: "#555" }} />
              </div>);
            })}
            <button onClick={() => setS(p => ({ ...p, fiIdeas: [...p.fiIdeas, {idea:"",reason:""}] }))} style={{ padding: "6px 14px", border: "1px dashed #d0d5dd", borderRadius: 6, background: "transparent", color: BRAND.teal, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>+ Add FI Idea</button>
          </Card>}
          {s.showFlows && <Card title="LS Trading Desk Flows" color="#27864a"><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}><Inp label="EQ Buyer" value={s.eqBuyer} onChange={u("eqBuyer")} /><Inp label="EQ Seller" value={s.eqSeller} onChange={u("eqSeller")} /><Inp label="FI Net Buyer" value={s.fiBuyer} onChange={u("fiBuyer")} /><Inp label="FI Net Seller" value={s.fiSeller} onChange={u("fiSeller")} /></div></Card>}
          {s.showMacroEstimates && <Card title="Macro Estimates" color={BRAND.navy}><Inp label="Source" value={s.macroSource} onChange={u("macroSource")} /><table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}><thead><tr style={{ background: BRAND.navy }}><th style={{ padding: "6px 8px", fontSize: 11, color: "#fff", textAlign: "left" }}>Metric</th><th style={{ padding: "6px 8px", fontSize: 11, color: "#fff", textAlign: "center" }}>2026</th><th style={{ padding: "6px 8px", fontSize: 11, color: "#fff", textAlign: "center" }}>2027</th></tr></thead><tbody>{s.macroRows.map((r, i) => (<tr key={i} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}><td style={{ padding: 4 }}><input value={r.label} onChange={e => umr(i, "label", e.target.value)} style={{ ...is, width: "100%", fontWeight: 600 }} /></td><td style={{ padding: 4 }}><input value={r.v2026} onChange={e => umr(i, "v2026", e.target.value)} style={{ ...is, width: "100%", textAlign: "center" }} /></td><td style={{ padding: 4 }}><input value={r.v2027} onChange={e => umr(i, "v2027", e.target.value)} style={{ ...is, width: "100%", textAlign: "center" }} /></td></tr>))}</tbody></table></Card>}

          {s.showCorporate && <Card title="Corporate">{s.corpBlocks.map(c => {
            const sa = s.analysts.find(a => a.id === c.analystId);
            const tks = sa ? sa.coverage.map(x => x.ticker).filter(Boolean) : [];
            const cv = sa ? sa.coverage.find(x => x.ticker === c.ticker) : null;
            return (<div key={c.id} style={{ padding: 14, background: "#fafbfc", borderRadius: 8, marginBottom: 12, border: "1px solid #eee" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                <div><label style={{ fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", display: "block", marginBottom: 3 }}>Analyst</label><select value={c.analystId || ""} onChange={e => { ul("corpBlocks", c.id, "analystId", e.target.value); ul("corpBlocks", c.id, "ticker", ""); }} style={{ ...ss, width: "100%", fontWeight: 600 }}><option value="">— Select —</option>{s.analysts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.title})</option>)}</select></div>
                <div><label style={{ fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", display: "block", marginBottom: 3 }}>Ticker</label><select value={c.ticker || ""} onChange={e => ul("corpBlocks", c.id, "ticker", e.target.value)} style={{ ...ss, width: "100%", fontWeight: 700 }} disabled={!c.analystId}><option value="">— Select —</option>{tks.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              </div>
              {cv && <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8, padding: "6px 10px", background: rb(cv.rating), borderRadius: 4, border: `1px solid ${rc(cv.rating)}30` }}><span style={{ fontSize: 12, fontWeight: 700, color: rc(cv.rating) }}>{cv.rating}</span><span style={{ fontSize: 12, color: "#333" }}>TP {cv.tp}</span><span style={{ fontSize: 12, color: "#666", fontStyle: "italic" }}>{sa.name}, {sa.title}</span></div>}
              <Inp label="Headline" value={c.headline} onChange={v => ul("corpBlocks", c.id, "headline", v)} placeholder="e.g. 4Q25 SNAPSHOT" />
              <Inp label="Body" value={c.body} onChange={v => ul("corpBlocks", c.id, "body", v)} multi rows={3} />
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}><div style={{ flex: 1 }}><Inp label="Report Link" value={c.link} onChange={v => ul("corpBlocks", c.id, "link", v)} placeholder="https://..." /></div><X onClick={() => rl("corpBlocks", c.id)} /></div>
            </div>);
          })}<DashBtn onClick={() => al("corpBlocks", { id: `c${Date.now()}`, ticker: "", headline: "", analystId: "", body: "", link: "" })}>+ Add Company</DashBtn></Card>}

          <Card title="Signatures" color={BRAND.navy}>
            {s.signatures.map(sig => (<div key={sig.id} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-end" }}><div style={{ flex: 1 }}><Inp label="Name" value={sig.name} onChange={v => ul("signatures", sig.id, "name", v)} /></div><div style={{ flex: 1 }}><Inp label="Role" value={sig.role} onChange={v => ul("signatures", sig.id, "role", v)} /></div><div style={{ flex: 1 }}><Inp label="Email" value={sig.email} onChange={v => ul("signatures", sig.id, "email", v)} /></div>{s.signatures.length > 1 && <div style={{ paddingBottom: 10 }}><X onClick={() => rl("signatures", sig.id)} /></div>}</div>))}
            <DashBtn onClick={() => al("signatures", { id: `s${Date.now()}`, name: "", role: "", email: "" })}>+ Add Signature</DashBtn>
          </Card>
        </div>
      )}

      {tab === "preview" && (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: 20 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {["html", "bbg"].map(m => <button key={m} onClick={() => setPm(m)} style={{ padding: "8px 20px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, textTransform: "uppercase", background: pm === m ? BRAND.navy : "#e4e8ed", color: pm === m ? "#fff" : "#666" }}>{m === "html" ? "SendGrid HTML" : "Bloomberg Text"}</button>)}
            <div style={{ flex: 1 }} />
            <button onClick={() => copy(pm === "html" ? html : bbg, pm)} style={{ padding: "8px 20px", borderRadius: 6, border: `2px solid ${BRAND.sky}`, background: BRAND.navy, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "uppercase" }}>{cp === pm ? "\u2713 Copied!" : `Copy ${pm === "html" ? "HTML" : "BBG"}`}</button>
          </div>
          {pm === "html" ? <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,57,0.1)" }}><iframe ref={ref} srcDoc={html} style={{ width: "100%", height: 800, border: "none" }} title="Preview" /></div> : <div style={{ background: "#1a1a2e", color: "#e0e0e0", padding: 24, borderRadius: 8, fontFamily: "'Courier New',monospace", fontSize: 12.5, lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 800, overflow: "auto" }}>{bbg}</div>}
        </div>
      )}
    </div>
  );
}

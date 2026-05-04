import type { Analyst, DailyState } from "../types";

export const DEFAULT_ANALYSTS: Analyst[] = [
  { id: "a1", name: "George Gasztowtt", title: "O&G Analyst", coverage: [
    { ticker: "VIST", rating: "Overweight", tp: "US$68.00" },
    { ticker: "YPF", rating: "Overweight", tp: "US$45.00" },
    { ticker: "PAM", rating: "Neutral", tp: "US$85.00" },
  ]},
  { id: "a2", name: "Pedro Offenhenden", title: "Financials Analyst", coverage: [
    { ticker: "BMA", rating: "Neutral", tp: "US$100.00" },
    { ticker: "BBAR", rating: "Overweight", tp: "US$18.00" },
    { ticker: "GGAL", rating: "Overweight", tp: "US$95.00" },
    { ticker: "SUPV", rating: "Overweight", tp: "US$30.00" },
  ]},
];

export const DEFAULT_STATE: DailyState & { flows: { global: string; local: string; positioning: string } } = {
  date: new Date().toISOString().split("T")[0],
  sections: [
    { key: "snapshot", label: "Market Snapshot", on: true },
    { key: "watchToday", label: "What to Watch Today", on: true },
    { key: "marketComment", label: "Market Comment", on: true },
    { key: "macro", label: "Macro / Political", on: true },
    { key: "tradeIdeas", label: "Trade Ideas", on: true },
    { key: "flows", label: "Market Color", on: true },
    { key: "corporate", label: "Corporate", on: true },
    { key: "research", label: "Research Reports", on: true },
    { key: "latestReports", label: "Latest Research Reports", on: true },
    { key: "topMovers", label: "Top Movers", on: false },
    { key: "tweets", label: "Market Intelligence", on: false },
    { key: "latam", label: "LatAm Context", on: false },
    { key: "bcra", label: "BCRA Dashboard", on: false },
    { key: "events", label: "Upcoming", on: false },
    { key: "macroEstimates", label: "Macro Estimates", on: false },
    { key: "chart", label: "Chart of the Day", on: false },
  ],
  summaryBar: "",
  macroBlocks: [
    { id: "1", title: "TREASURY AUCTION RESULTS", body: "", lsPick: "" },
    { id: "2", title: "FX / BCRA", body: "", lsPick: "" },
  ],
  equityPicks: [
    { id: "ep-bbar", ticker: "BBAR", reason: "" },
    { id: "ep-vist", ticker: "VIST", reason: "" },
    { id: "ep-irs", ticker: "IRS", reason: "" },
    { id: "ep-caap", ticker: "CAAP", reason: "" },
  ],
  fiIdeas: [
    { id: "fi-1", idea: "Long ARGENT 35/38", reason: "Attractive yield on long-duration sovereign" },
    { id: "fi-2", idea: "Long end of BONCAP curve (Apr/May/Jun 2027)", reason: "" },
    { id: "fi-3", idea: "RV: Sell BONTE 30 / Buy long-end BONCAP curve", reason: "" },
    { id: "fi-4", idea: "Long BONCER 2028", reason: "" },
  ],
  showEquity: true,
  showFI: true,
  eqBuyer: "bank names (BBAR, BMA, GGAL)",
  eqSeller: "O&G names (VIST, YPF, PAM)",
  fiBuyer: "ST Bonares, ARGENT 35/38, BONTE 30, EDNAR 30",
  fiSeller: "ARGENT 29/30, YPFDAR 34",
  macroSource: "REM (BCRA) Jan-26",
  macroCols: ["2026", "2027"],
  macroRows: [
    { label: "CPI m/m (Mar→Jun)", vals: { "2026": "2.2% → 1.6%", "2027": "—" } },
    { label: "CPI full year", vals: { "2026": "22.4%", "2027": "~10%" } },
    { label: "GDP growth", vals: { "2026": "3.2%", "2027": "4.0%" } },
    { label: "FX EoP ($/USD)", vals: { "2026": "1,750", "2027": "~2,100" } },
    { label: "FX avg ($/USD)", vals: { "2026": "~1,600", "2027": "~1,900" } },
  ],
  corpBlocks: [
    { id: "c1", tickers: ["VIST"], headline: "4Q25 SNAPSHOT: IN THE GROOVE", analystId: "a1", body: "", link: "" },
  ],
  researchReports: [
    { id: "rr1", type: "Macro", title: "", author: "", body: "", link: "" },
  ],
  marketComment: "",
  latestReports: [],
  signatures: [
    { id: "s1", name: "Rodrigo Nistor", role: "Institutional Sales", email: "rodrigo.nistor@latinsecurities.ar" },
  ],
  analysts: DEFAULT_ANALYSTS,
  disclaimer: "This material has been prepared by Latin Securities S.A. for informational purposes only and does not constitute an offer, solicitation, or recommendation to buy or sell any financial instrument. Past performance is not indicative of future results. This communication is intended solely for the use of the addressee(s) and may contain privileged or confidential information.",

  // Market Snapshot
  snapshot: {
    merval: "", mervalChg: "",
    adrs: "", adrsChg: "",
    sp500: "", sp500Chg: "",
    ust10y: "",
    dxy: "",
    soja: "",
    wti: "",
    ccl: "", cclChg: "",
    mep: "", mepChg: "",
    blue: "",
  },

  // What to Watch Today
  watchToday: [""],

  // LatAm Context
  latam: "",

  // New sections state
  topMovers: {
    gainers: [{ ticker: "", chgPct: "", comment: "" }],
    losers: [{ ticker: "", chgPct: "", comment: "" }],
  },
  cclRate: null,
  tweets: [],
  bcraData: null,
  bcraHiddenRows: {},
  events: [],
  keyEvents: [],
  chartImage: null,

  // Flows fields (match CLAUDE.md shape)
  flows: { global: "", local: "", positioning: "" },
};

export const STORAGE_KEY: string = "ls-daily-builder-state";

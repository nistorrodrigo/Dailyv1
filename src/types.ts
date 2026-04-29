// LS Daily Builder — State Type Definitions

export interface CoverageItem {
  ticker: string;
  rating: "Overweight" | "Neutral" | "Underweight" | "NR" | "UR";
  tp: string;
  last?: string;
}

export interface Analyst {
  id: string;
  name: string;
  title: string;
  coverage: CoverageItem[];
}

export interface Section {
  key: string;
  label: string;
  on: boolean;
}

export interface NewsLink {
  /** Display label (defaults to the URL hostname when empty). */
  label: string;
  /** Full URL including protocol. */
  url: string;
}

export interface MacroBlock {
  id: string;
  title: string;
  body: string;
  lsPick: string;
  /** External news article links shown under the block in HTML/BBG output. */
  newsLinks?: NewsLink[];
}

export interface EquityPick {
  /** Stable id for drag-and-drop reordering. New items get a random id. */
  id: string;
  ticker: string;
  reason: string;
}

export interface FIIdea {
  /** Stable id for drag-and-drop reordering. New items get a random id. */
  id: string;
  idea: string;
  reason: string;
}

export interface MacroRow {
  label: string;
  vals: Record<string, string>;
}

export interface CorpBlock {
  id: string;
  tickers: string[];
  headline: string;
  analystId: string;
  body: string;
  /** Primary LS report link (rendered as "Full LS report ↗"). */
  link: string;
  /** External news article links rendered alongside the report link. */
  newsLinks?: NewsLink[];
}

export interface ResearchReport {
  id: string;
  type: "Macro" | "Weekly" | "Strategy" | "Sector" | "Special";
  title: string;
  author: string;
  body: string;
  link: string;
}

export interface Signature {
  id: string;
  name: string;
  role: string;
  email: string;
}

export interface Mover {
  ticker: string;
  chgPct: string;
  comment: string;
}

export interface TopMovers {
  gainers: Mover[];
  losers: Mover[];
}

export interface Tweet {
  content: string;
  link: string;
  time: string;
  sentiment: "Bullish" | "Bearish" | "Neutral";
  impactType: "Market" | "Sector" | "Stock";
  impactValue: string;
}

export interface DailyEvent {
  title: string;
  type: "Webinar" | "Conference" | "Corporate Access" | "Roadshow" | "Earnings Call" | "Investor Day" | "Other";
  date: string;
  timeET: string;
  timeBUE: string;
  timeLON: string;
  description: string;
  link: string;
}

export interface KeyEvent {
  date: string;
  event: string;
}

export interface ChartImage {
  base64: string;
  data?: string;
  title: string;
  caption: string;
  fileName?: string;
  sizeKB?: number;
}

export interface MarketSnapshot {
  merval: string; mervalChg: string;
  adrs: string; adrsChg: string;
  sp500: string; sp500Chg: string;
  ust10y: string;
  dxy: string;
  soja: string;
  wti: string;
  ccl: string; cclChg: string;
  mep: string; mepChg: string;
  blue: string;
}

export interface DailyState {
  date: string;
  sections: Section[];
  summaryBar: string;
  snapshot: MarketSnapshot;
  watchToday: string[];
  latam: string;
  macroBlocks: MacroBlock[];
  equityPicks: EquityPick[];
  fiIdeas: FIIdea[];
  showEquity: boolean;
  showFI: boolean;
  eqBuyer: string;
  eqSeller: string;
  fiBuyer: string;
  fiSeller: string;
  macroSource: string;
  macroCols: string[];
  macroRows: MacroRow[];
  corpBlocks: CorpBlock[];
  researchReports: ResearchReport[];
  signatures: Signature[];
  analysts: Analyst[];
  disclaimer: string;
  topMovers: TopMovers;
  cclRate: number | null;
  tweets: Tweet[];
  bcraData: Record<string, string> | null;
  bcraHiddenRows: Record<string, boolean>;
  events: DailyEvent[];
  keyEvents: KeyEvent[];
  chartImage: ChartImage | null;
}

export interface UIState {
  tab: "edit" | "analysts" | "ai" | "preview" | "email-editor" | "dashboard";
  previewMode: "html" | "bbg";
  copiedLabel: string;
  saveStatus: "idle" | "saving" | "saved" | "error";
  darkMode: boolean;
}

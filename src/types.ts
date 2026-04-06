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

export interface MacroBlock {
  id: string;
  title: string;
  body: string;
  lsPick: string;
}

export interface EquityPick {
  ticker: string;
  reason: string;
}

export interface FIIdea {
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
  link: string;
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

export interface DailyState {
  date: string;
  sections: Section[];
  summaryBar: string;
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
  tab: "edit" | "analysts" | "preview" | "dashboard";
  previewMode: "html" | "bbg";
  copiedLabel: string;
  saveStatus: "idle" | "saving" | "saved" | "error";
  darkMode: boolean;
}

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
  /** "What would change my mind?" — the explicit invalidation
   *  trigger the desk would use to close the position. Foreign
   *  PMs forward research with stops; a vague "monitor for risks"
   *  is what gets filed-without-reading. Optional because not
   *  every pick has a clean trigger. Renders below the body in
   *  the email when set. */
  exitTrigger?: string;
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

/** Compact "what we just published" listing — title + author + link
 *  with no embedded body. Distinct from `ResearchReport` (which the
 *  Research Reports section uses to drop the full text into the
 *  daily). Use this when the analyst just wants to point clients at
 *  recent LS publications without quoting them in line. */
export interface LatestReport {
  id: string;
  /** Optional report type tag. Free-form string rather than a strict
   *  union so the desk can use whatever taxonomy they already track
   *  (e.g. "Banks 1Q26", "FX strategy", "Sovereign curve"). */
  type: string;
  title: string;
  /** Free-text author. Kept for backwards compat with rows persisted
   *  before the dropdown shipped, and as a fallback when the report
   *  is by someone outside the Analysts catalogue (e.g. an external
   *  contributor). When `analystId` is set, the resolved analyst's
   *  name takes precedence. */
  author: string;
  /** Reference into the canonical Analysts list (`state.analysts`).
   *  When set, the renderer resolves to that analyst's name + title
   *  rather than the free-text `author` field — mirrors the same
   *  pattern Corporate blocks use. Optional so the analyst can leave
   *  it blank for external authors. */
  analystId?: string;
  /** ISO date the report was published (YYYY-MM-DD). Optional
   *  because some uploads don't have it; rendered when present. */
  publishedDate?: string;
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
  /** Subject-line hook — the provocative, specific one-liner that goes
   *  into the email's `Subject:` header in place of the boilerplate
   *  "Argentina Daily - May 5". Foreign institutional inboxes get
   *  50+ research pieces a day; the headline is what decides whether
   *  the daily gets opened or filed. Max ~70 characters by convention
   *  to keep the full text visible in Outlook/Gmail preview. */
  headline: string;
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
  /** Free-form market commentary block — single prose section the
   *  analyst writes in their own voice. Different from `macroBlocks`
   *  (which are reactions to specific data prints) — this one is the
   *  "desk colour / opinion" piece that often goes after the
   *  snapshot. Empty string when the section is off or not used. */
  marketComment: string;
  /** Compact list of recent LS publications surfaced in today's
   *  daily. Title + author + link only — no body. See
   *  `researchReports` for the full-embed variant. */
  latestReports: LatestReport[];
  /** Yesterday-in-review block — short prose (3-4 sentences) that
   *  scores the desk's prior-day calls against today's price action.
   *  Builds credibility with foreign institutional readers by being
   *  publicly honest about what worked and what didn't. Free-form
   *  so the analyst can refine the AI-generated draft. Renders
   *  prominently above the macro section when the section is on. */
  yesterdayRecap: string;
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

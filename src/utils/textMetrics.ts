import type { DailyState } from "../types";
import { resolveCorporateBlock } from "./ratings";

const STRIP_HTML_TAGS = /<[^>]*>/g;
const STRIP_MD_MARKERS = /[*_`#>~]/g;
const COLLAPSE_WHITESPACE = /\s+/g;

/** Average words-per-minute for a comfortable reading pace. */
const WPM = 220;

/** Strip HTML/markdown noise and split on whitespace to count "real" words. */
export function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  const cleaned = text.replace(STRIP_HTML_TAGS, " ").replace(STRIP_MD_MARKERS, "").replace(COLLAPSE_WHITESPACE, " ").trim();
  if (!cleaned) return 0;
  return cleaned.split(" ").filter(Boolean).length;
}

/** Round 220 WPM to whole minutes; minimum 1. */
export function readingTimeMinutes(words: number): number {
  if (!words) return 0;
  return Math.max(1, Math.round(words / WPM));
}

/**
 * Aggregate word count across every text field that ends up in the email
 * body. Returns the total and a section-by-section breakdown so callers
 * can show "200 words · 1 min" or drill down per section.
 */
export interface TextMetrics {
  total: number;
  perSection: Record<string, number>;
}

/**
 * Memoize by state ref. zustand emits a new state object only when state
 * actually changes, so a WeakMap keyed on state is safe and ALSO essential
 * here: passing this directly to `useDailyStore(...)` as a selector returns
 * a fresh object on every call, which zustand interprets as "value changed"
 * and causes an infinite render loop (React error #185). Memoizing means
 * the same state ref returns the same metrics object — stable identity.
 */
const cache = new WeakMap<DailyState, TextMetrics>();

export function getDailyTextMetrics(s: DailyState): TextMetrics {
  const cached = cache.get(s);
  if (cached) return cached;

  const perSection: Record<string, number> = {};
  const add = (key: string, n: number) => {
    if (n) perSection[key] = (perSection[key] || 0) + n;
  };

  add("summary", countWords(s.summaryBar));
  add("watch", (s.watchToday || []).reduce((acc, w) => acc + countWords(w), 0));
  add("latam", countWords(s.latam));

  s.macroBlocks.forEach((b) => {
    add("macro", countWords(b.title) + countWords(b.body) + countWords(b.lsPick));
  });

  s.equityPicks.forEach((p) => add("equity", countWords(p.reason)));
  s.fiIdeas.forEach((f) => add("fi", countWords(f.idea) + countWords(f.reason)));

  s.corpBlocks.forEach((c) => {
    const r = resolveCorporateBlock(c, s.analysts);
    add("corporate", countWords(r.headline) + countWords(r.body));
  });

  (s.researchReports || []).forEach((r) => {
    add("research", countWords(r.title) + countWords(r.body));
  });

  (s.tweets || []).forEach((t) => add("tweets", countWords(t.content)));

  const total = Object.values(perSection).reduce((a, b) => a + b, 0);
  const result: TextMetrics = { total, perSection };
  cache.set(s, result);
  return result;
}

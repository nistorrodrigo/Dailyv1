import { supabase } from "./supabase";
import type { DailyState, Analyst, ResearchReport, LatestReport, CorpBlock } from "../types";

/**
 * Research Reports Library — flattens every report the desk has ever
 * shipped across all persisted dailies into a single searchable list.
 *
 * Source of truth: the `dailies` table in Supabase, which contains
 * the full DailyState for every day the analyst has saved. Each row
 * carries the day's `researchReports`, `latestReports`, and
 * `corpBlocks` arrays — we walk all three across all dailies and
 * project them into a unified `LibraryItem` shape with a chip
 * indicating which surface they came from.
 *
 * Why fetch state-by-row and reduce client-side rather than running
 * a SQL projection: the per-row arrays live inside the `state` JSONB
 * column, so any filter / sort / dedupe in SQL would need recursive
 * jsonb_array_elements + manual schema knowledge per item type. The
 * dataset is small (~250 dailies per year × ~5 reports each = ~1k
 * rows of leaf data) so the bandwidth cost is acceptable and the
 * derivation logic stays close to the rest of the renderer code.
 *
 * Author resolution: every item type uses the same pattern — prefer
 * the analyst's catalogue name (looked up via `analystId`) over the
 * free-text `author` field. We carry the row's own `analysts` array
 * into the lookup so historical dailies resolve correctly even if
 * the analyst has since been renamed or removed in the live store.
 */

export type LibraryItemType = "research" | "latest" | "corporate";

export interface LibraryItem {
  /** Stable deterministic id used for pin-set membership in
   *  localStorage. Built from `sourceDate + type + normalised title +
   *  link hash` so a re-edit of the original report on the same daily
   *  keeps the same pin status as long as the title and link survive. */
  signature: string;
  type: LibraryItemType;
  /** Sub-type label shown in the chip — "Macro" / "Weekly" / "Banks 1Q26"
   *  for research items, "VIST / YPF" for corporate (joined tickers),
   *  empty for items with no inherent sub-type. */
  subType: string;
  title: string;
  /** Resolved author name. `analystId` (catalogue lookup) wins over
   *  free-text; falls back to free-text when the analyst is external
   *  or analystId is the `__external__` sentinel. */
  author: string;
  /** Optional inline body — present for research + corporate, absent
   *  for latestReports (which are headline-only). Used for the
   *  formatted-copy snippet. */
  body: string;
  /** Original link href (LS report URL). May be empty if the analyst
   *  hadn't filled it in yet on the source daily. */
  link: string;
  /** YYYY-MM-DD of the daily this item came from. */
  sourceDate: string;
  /** Optional published-date for `latestReports` (analyst's own
   *  free-form date string, usually ISO). Empty otherwise. */
  publishedDate?: string;
}

interface DailyRowWithState {
  date: string;
  state: DailyState;
}

/**
 * Pull every daily's `date + state` from Supabase. Capped at 365
 * rows so a long-running deployment doesn't return 5 years of data
 * in one round-trip — covers a year of trading days comfortably and
 * the analyst rarely needs older context than that.
 */
async function listDailyStates(limit: number = 365): Promise<DailyRowWithState[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("dailies")
    .select("date, state")
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as DailyRowWithState[];
}

/** Resolve an `analystId` (which may be the `__external__` sentinel,
 *  a real catalogue id, or empty) to a display name. Falls back to
 *  the free-text `author` field when no catalogue match. */
function resolveAuthor(analystId: string | undefined, freeText: string, analysts: Analyst[]): string {
  if (analystId && analystId !== "__external__") {
    const a = analysts.find((x) => x.id === analystId);
    if (a) return a.name;
  }
  return (freeText || "").trim();
}

/** Build a deterministic signature for pin-set membership. Same
 *  daily + same type + same title + same link → same signature. A
 *  hash over the link rather than the raw URL keeps signatures
 *  short and obscures the URL from any localStorage inspection. */
function buildSignature(sourceDate: string, type: LibraryItemType, title: string, link: string): string {
  const normTitle = title.trim().toLowerCase().replace(/\s+/g, " ");
  // Tiny stable hash — not cryptographic, just collision-resistant
  // enough for ~1k items in localStorage. DJB2.
  let h = 5381;
  const combined = link || "";
  for (let i = 0; i < combined.length; i++) h = ((h << 5) + h + combined.charCodeAt(i)) | 0;
  const linkHash = (h >>> 0).toString(36);
  return `${sourceDate}|${type}|${normTitle}|${linkHash}`;
}

function flattenResearch(state: DailyState, sourceDate: string): LibraryItem[] {
  const out: LibraryItem[] = [];
  for (const r of state.researchReports || []) {
    if (!r.title?.trim()) continue;
    const author = resolveAuthor(r.analystId, r.author, state.analysts || []);
    out.push({
      signature: buildSignature(sourceDate, "research", r.title, r.link),
      type: "research",
      subType: r.type || "",
      title: r.title,
      author,
      body: r.body || "",
      link: r.link || "",
      sourceDate,
    });
  }
  return out;
}

function flattenLatest(state: DailyState, sourceDate: string): LibraryItem[] {
  const out: LibraryItem[] = [];
  for (const r of state.latestReports || []) {
    if (!r.title?.trim()) continue;
    const author = resolveAuthor(r.analystId, r.author, state.analysts || []);
    out.push({
      signature: buildSignature(sourceDate, "latest", r.title, r.link),
      type: "latest",
      subType: (r.type || "").trim(),
      title: r.title,
      author,
      body: "",
      link: r.link || "",
      sourceDate,
      publishedDate: r.publishedDate?.trim() || undefined,
    });
  }
  return out;
}

function flattenCorporate(state: DailyState, sourceDate: string): LibraryItem[] {
  const out: LibraryItem[] = [];
  for (const b of state.corpBlocks || []) {
    if (!b.headline?.trim()) continue;
    const author = resolveAuthor(b.analystId, "", state.analysts || []);
    const tickers = (b.tickers || []).join(" / ");
    out.push({
      signature: buildSignature(sourceDate, "corporate", b.headline, b.link),
      type: "corporate",
      subType: tickers,
      title: b.headline,
      author,
      body: b.body || "",
      link: b.link || "",
      sourceDate,
    });
  }
  return out;
}

/** Build the full unified library across every persisted daily.
 *  Sorted most-recent-source-date first; within a source date the
 *  order mirrors the daily's own array order (which the analyst
 *  controls via drag-reorder). */
export async function buildLibrary(): Promise<LibraryItem[]> {
  const rows = await listDailyStates();
  const items: LibraryItem[] = [];
  for (const row of rows) {
    if (!row.state) continue;
    items.push(
      ...flattenResearch(row.state, row.date),
      ...flattenLatest(row.state, row.date),
      ...flattenCorporate(row.state, row.date),
    );
  }
  return items;
}

// ──────────────────────────────────────────────────────────────
// Pure pin-set helpers — exposed for unit testing the persistence
// shape. The component layer wraps these in React state.
// ──────────────────────────────────────────────────────────────

const PIN_STORAGE_KEY = "ls-library-pins";

export function loadPinnedSignatures(): Set<string> {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(PIN_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((s) => typeof s === "string")) : new Set();
  } catch {
    // Corrupt JSON — wipe and start fresh; don't crash the tab.
    return new Set();
  }
}

export function savePinnedSignatures(pins: Set<string>): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(Array.from(pins)));
  } catch {
    // Quota exceeded / private-mode Safari — silent fail; the pin
    // toggle just won't persist across reload.
  }
}

// Re-exports for testability — keep the local item types referenced
// in tests aligned with the upstream definitions.
export type { ResearchReport, LatestReport, CorpBlock };

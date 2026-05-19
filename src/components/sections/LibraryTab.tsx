import { useEffect, useMemo, useState } from "react";
import { BRAND } from "../../constants/brand";
import { copyText } from "../../utils/clipboard";
import { fmtEventDate } from "../../utils/dates";
import {
  buildLibrary,
  loadPinnedSignatures,
  savePinnedSignatures,
  type LibraryItem,
  type LibraryItemType,
} from "../../lib/libraryApi";

/**
 * Research Reports Library tab — searchable archive of every report
 * the desk has ever shipped (research / latest / corporate), pulled
 * from `daily_versions` in Supabase via `buildLibrary()`.
 *
 * Why a dedicated tab rather than a slide-in panel: the analyst wants
 * to browse / filter / scan, not "open, do one thing, close". A full
 * page gives room for the filters + a wide list + a body-preview
 * tooltip without competing with the editor for screen space.
 *
 * Pinned items are stored as a Set of stable signatures in
 * localStorage — no Supabase round-trip for the pin toggle, and the
 * signature survives re-edits of the source daily as long as the
 * report's title + link don't change. Cross-device sync is out of
 * scope for v1; the desk runs from one laptop per analyst so this
 * isn't a practical limitation.
 *
 * The two primary actions per row mirror the desk's actual workflow:
 *   - "Link" — copies just the URL for a quick chat / email paste
 *   - "Snippet" — copies a "[Type] Title — Author · URL" line ready
 *     to drop into BBG chat / Teams without further formatting
 */

type TypeFilter = "all" | LibraryItemType;

const TYPE_LABEL: Record<LibraryItemType, string> = {
  research: "Research",
  latest: "Latest",
  corporate: "Corporate",
};
const TYPE_COLOR: Record<LibraryItemType, string> = {
  research: BRAND.blue,
  latest: BRAND.teal,
  corporate: BRAND.navy,
};

export default function LibraryTab() {
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [pinnedOnly, setPinnedOnly] = useState<boolean>(false);
  const [pinned, setPinned] = useState<Set<string>>(() => loadPinnedSignatures());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const built = await buildLibrary();
        if (!cancelled) setItems(built);
      } catch (err) {
        if (!cancelled) setError((err as Error).message || String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const togglePin = (signature: string) => {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(signature)) next.delete(signature);
      else next.add(signature);
      savePinnedSignatures(next);
      return next;
    });
  };

  // Counts per type — shown on the filter chips. Computed off the
  // unfiltered list so the chips don't flicker as the analyst types
  // in the search box.
  const typeCounts = useMemo(() => {
    const counts: Record<LibraryItemType, number> = { research: 0, latest: 0, corporate: 0 };
    for (const item of items || []) counts[item.type]++;
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (pinnedOnly && !pinned.has(item.signature)) return false;
      if (q) {
        const hay = `${item.title} ${item.author} ${item.subType} ${item.body}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, typeFilter, pinnedOnly, pinned]);

  const formatSnippet = (item: LibraryItem): string => {
    const typeTag = `[${TYPE_LABEL[item.type]}${item.subType ? ` · ${item.subType}` : ""}]`;
    const authorBit = item.author ? ` — ${item.author}` : "";
    const linkBit = item.link ? ` · ${item.link}` : "";
    return `${typeTag} ${item.title}${authorBit}${linkBit}`;
  };

  if (loading) {
    return <div className="text-center py-20 text-[var(--text-muted)]">Loading library…</div>;
  }
  if (error) {
    return (
      <div className="max-w-[900px] mx-auto p-5">
        <div className="p-4 rounded-md border border-red-300 bg-red-50 text-red-700 text-sm">
          Library unavailable: {error}
        </div>
      </div>
    );
  }
  if (!items || items.length === 0) {
    return (
      <div className="max-w-[900px] mx-auto p-5">
        <div className="p-6 rounded-md border border-dashed border-[var(--border-light)] bg-[var(--bg-card-alt)] text-center text-[var(--text-muted)] text-sm">
          <div className="font-bold text-[var(--text-primary)] mb-1">No reports yet</div>
          Once a daily with research, latest, or corporate blocks is saved, it'll show up here.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto p-5">
      {/* Header */}
      <div className="mb-4">
        <div className="text-[20px] font-light text-[var(--text-primary)] tracking-tight">Research Library</div>
        <div className="text-[12px] text-[var(--text-muted)] mt-1">
          {items.length.toLocaleString()} reports across the desk's daily history. Copy a link or a formatted
          snippet to share over chat / email, or pin items you reference often.
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, author, body…"
          aria-label="Search reports"
          className="themed-input flex-1 min-w-[200px] px-3 py-2 rounded-md border border-[var(--border-input)] text-[13px] bg-[var(--bg-input)] text-[var(--text-primary)]"
        />
        <div role="tablist" aria-label="Filter by type" className="flex gap-1">
          {(["all", "research", "latest", "corporate"] as const).map((t) => {
            const active = typeFilter === t;
            const label = t === "all" ? `All (${items.length})` : `${TYPE_LABEL[t]} (${typeCounts[t]})`;
            return (
              <button
                key={t}
                role="tab"
                aria-selected={active}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wide border cursor-pointer ${
                  active
                    ? "bg-[var(--brand-navy)] text-white border-[var(--brand-navy)]"
                    : "bg-transparent text-[var(--text-muted)] border-[var(--border-input)] hover:text-[var(--text-primary)]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setPinnedOnly((v) => !v)}
          aria-pressed={pinnedOnly}
          className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wide border cursor-pointer ${
            pinnedOnly
              ? "bg-amber-100 text-amber-900 border-amber-300"
              : "bg-transparent text-[var(--text-muted)] border-[var(--border-input)] hover:text-[var(--text-primary)]"
          }`}
          title="Show only pinned reports"
        >
          {"★"} Pinned ({pinned.size})
        </button>
      </div>

      {/* List */}
      {filtered.length === 0 && (
        <div className="p-6 rounded-md border border-dashed border-[var(--border-light)] bg-[var(--bg-card-alt)] text-center text-[var(--text-muted)] text-sm">
          No reports match the current filter.
        </div>
      )}
      <div className="rounded-md border border-[var(--border-light)] bg-[var(--bg-card)] overflow-hidden">
        {filtered.map((item) => {
          const isPinned = pinned.has(item.signature);
          return (
            <div
              key={item.signature}
              className="flex items-start gap-3 px-4 py-3 border-b border-[var(--border-light)] last:border-0"
            >
              {/* Pin toggle */}
              <button
                onClick={() => togglePin(item.signature)}
                aria-label={isPinned ? `Unpin ${item.title}` : `Pin ${item.title}`}
                aria-pressed={isPinned}
                title={isPinned ? "Unpin" : "Pin"}
                className="bg-transparent border-none cursor-pointer text-base leading-none p-1 mt-0.5"
                style={{ color: isPinned ? "#d97706" : "var(--text-muted)" }}
              >
                {isPinned ? "★" : "☆"}
              </button>

              {/* Type chip */}
              <span
                className="text-[9px] font-bold uppercase tracking-wider text-white px-2 py-1 rounded flex-shrink-0 mt-1"
                style={{ background: TYPE_COLOR[item.type] }}
                title={TYPE_LABEL[item.type]}
              >
                {TYPE_LABEL[item.type]}
              </span>

              {/* Title + meta */}
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[var(--text-primary)] leading-snug">
                  {item.title}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                  {item.subType && <span className="font-semibold" style={{ color: TYPE_COLOR[item.type] }}>{item.subType}</span>}
                  {item.author && <span>{item.author}</span>}
                  <span>· {fmtEventDate(item.sourceDate)}</span>
                  {item.publishedDate && item.publishedDate !== item.sourceDate && (
                    <span>· published {item.publishedDate}</span>
                  )}
                </div>
                {item.body && (
                  <div className="text-[11px] text-[var(--text-secondary)] mt-1 line-clamp-2 leading-snug">
                    {item.body}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => copyText(item.link, {
                    successMessage: item.link ? "Link copied" : "No link on this report",
                  })}
                  disabled={!item.link}
                  className="px-2.5 py-1.5 rounded text-[10px] font-bold uppercase tracking-wide border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border-[var(--border-input)] text-[var(--text-secondary)] bg-transparent hover:text-[var(--text-primary)]"
                  title="Copy report URL"
                  aria-label={`Copy link to ${item.title}`}
                >
                  Link
                </button>
                <button
                  onClick={() => copyText(formatSnippet(item), { successMessage: "Snippet copied" })}
                  className="px-2.5 py-1.5 rounded text-[10px] font-bold uppercase tracking-wide border cursor-pointer border-[var(--brand-navy)] text-[var(--brand-navy)] bg-transparent hover:bg-[var(--bg-card-alt)]"
                  title="Copy [Type] Title — Author · URL"
                  aria-label={`Copy formatted snippet for ${item.title}`}
                >
                  Snippet
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

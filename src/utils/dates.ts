/** ISO-shape (`YYYY-MM-DD`) format of a `Date` in the **browser's
 *  local timezone**. Internal building block for `todayLocal` and
 *  `addDaysLocal` — exported so it's testable but most callers want
 *  one of those wrappers, not this raw formatter. */
const formatLocalDate = (d: Date): string =>
  d.toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" });

/**
 * Today's date as `YYYY-MM-DD` in the **browser's local timezone**.
 *
 * Why not `new Date().toISOString().split("T")[0]`? That returns UTC.
 * For an analyst in Buenos Aires (UTC-3) editing at 23:00 local on
 * April 30, that path gives "2026-05-01" — not what the calendar on
 * the wall says. We want the date the user is looking at, so we
 * format with `en-CA` (the only common locale that emits ISO-shape
 * `YYYY-MM-DD` in local time) and use that consistently.
 */
export const todayLocal = (now: Date = new Date()): string => formatLocalDate(now);

/**
 * Shift a `YYYY-MM-DD` date by `n` calendar days (negative for past)
 * and return the result in the same `YYYY-MM-DD` shape, using
 * local-TZ semantics. Anchors at noon of the source date so DST
 * transitions can't push the result into the wrong day.
 *
 * Examples:
 *   addDaysLocal("2026-04-30", -1)  → "2026-04-29"
 *   addDaysLocal("2026-04-30", -7)  → "2026-04-23"
 *   addDaysLocal("2026-12-31", 1)   → "2027-01-01"
 *
 * Returns "" for invalid input rather than throwing — the same
 * forgiving shape the rest of the date helpers use, lets callers
 * inline this in JSX without conditional checks.
 */
export const addDaysLocal = (iso: string, n: number): string => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return formatLocalDate(d);
};

/**
 * True iff `iso` (a `YYYY-MM-DD` string) is the current local date.
 * Returns false for invalid input rather than throwing — the caller
 * is usually rendering a UI hint and silently treating garbage as
 * "not today" is safer than a crash.
 */
export const isToday = (iso: string | null | undefined, now: Date = new Date()): boolean => {
  if (!iso || typeof iso !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  return iso === todayLocal(now);
};

export const formatDate = (iso: string): string => {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export const fmtEventDate = (iso: string): string => {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export const fmtTime = (hhmm: string): string => {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
};

/**
 * Render a relative time like "2 hours ago" / "just now". Used in the
 * Send panel's "last sent" warning and similar UI where the absolute
 * timestamp is less useful than the recency.
 *
 * Falls back to the absolute toLocaleString output for anything older
 * than ~1 day — past that, "5 days ago" stops being precise enough to
 * be useful and the calendar date is more informative.
 *
 * Returns "" for null/undefined/invalid inputs so callers can use it
 * directly inside JSX without conditional checks.
 */
export const fmtRelativeTime = (iso: string | null | undefined, now: Date = new Date()): string => {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diffSec = Math.max(0, Math.floor((now.getTime() - t) / 1000));

  if (diffSec < 30) return "just now";
  if (diffSec < 60) return `${diffSec} seconds ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  // Past 24h, fall through to an absolute date.
  return new Date(iso).toLocaleString();
};

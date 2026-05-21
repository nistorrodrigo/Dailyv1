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

/**
 * Format `YYYY-MM-DD` as e.g. `"Wednesday, May 6, 2026"`.
 *
 * Defensive input validation — previously `formatDate("")` or
 * `formatDate(undefined as unknown as string)` evaluated
 * `new Date("T12:00:00")` which is Invalid Date, and
 * `toLocaleDateString` on Invalid Date literally returns the
 * string `"Invalid Date"` in Chrome / Node. That string would
 * land in the email header. Now: return "" for any input that
 * doesn't match the ISO shape — callers (header banner, BBG
 * footer) already gracefully handle empty strings.
 *
 * `"en-US"` locale is pinned explicitly so CI runners with
 * non-US locale env vars (Spanish, German, etc.) don't render
 * "miércoles, 6 mayo 2026" — the audit flagged this as a
 * brittleness in the snapshot tests.
 */
export const formatDate = (iso: string | null | undefined): string => {
  if (!iso || typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const d = new Date(iso + "T12:00:00");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

/** Short event date — e.g. `"May 6, 2026"`. Same defensive shape
 *  as `formatDate` above (empty string on garbage input, en-US
 *  locale pinned). */
export const fmtEventDate = (iso: string | null | undefined): string => {
  if (!iso || typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const d = new Date(iso + "T12:00:00");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

/**
 * Render `HH:MM` (24-h, zero-padded) as 12-hour with AM/PM.
 *
 * Previously did no input validation, so:
 *   `fmtTime("morning")` → "12:undefined AM"
 *   `fmtTime("8:30")`    → ok
 *   `fmtTime("8")`       → "8:undefined AM"
 * Each of those landed in the rendered email's Events row. Now
 * we require a strict `H{1,2}:MM` regex and pad single-digit
 * minutes / hours; anything else returns `""`.
 */
export const fmtTime = (hhmm: string | null | undefined): string => {
  if (!hhmm || typeof hhmm !== "string") return "";
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return "";
  const hour = parseInt(m[1], 10);
  const minute = m[2];
  if (Number.isNaN(hour) || hour < 0 || hour > 23) return "";
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${minute} ${ampm}`;
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

/**
 * Convert a Buenos Aires wall-clock time into US-Eastern + London
 * display times — used by the "What to Watch This Week" bullets so
 * the analyst types one time and foreign PMs see all three zones.
 *
 * Argentina (ART) is a fixed UTC-3 with no daylight saving, so a
 * BUE time + date pins an exact UTC instant with no ambiguity. ET
 * and London DO observe DST, which is why the reference `isoDate`
 * matters — the same 11:00 BUE maps to a different ET clock time in
 * January vs. July. We let `Intl` / the host's IANA timezone
 * database do the DST arithmetic rather than hard-coding offset
 * tables (which rot whenever a government changes the rules).
 *
 * When `isoDate` is absent or malformed we fall back to
 * `todayLocal()` — good enough for the "this week" window the
 * section covers; the error is at most a one-hour offset right at a
 * DST boundary.
 *
 * Returns `null` for a missing / malformed time so callers guard
 * inline. Output is 12-hour with AM/PM, e.g. `{ et: "10:00 AM",
 * london: "3:00 PM" }`.
 */
export const bueTimeToZones = (
  hhmm: string | null | undefined,
  isoDate?: string | null,
): { et: string; london: string } | null => {
  if (!hhmm || typeof hhmm !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  if (Number.isNaN(hour) || hour < 0 || hour > 23) return null;
  if (Number.isNaN(minute) || minute < 0 || minute > 59) return null;

  const dateStr = isoDate && /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? isoDate : todayLocal();
  const [y, mo, d] = dateStr.split("-").map(Number);

  // BUE wall-clock → UTC instant: ART is UTC-3, so UTC = BUE + 3h.
  // `Date.UTC` rolls `hour + 3 >= 24` into the next calendar day
  // automatically, so a late-evening BUE time converts correctly.
  const instant = new Date(Date.UTC(y, mo - 1, d, hour + 3, minute));
  if (Number.isNaN(instant.getTime())) return null;

  const fmt = (tz: string): string =>
    instant.toLocaleTimeString("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  return { et: fmt("America/New_York"), london: fmt("Europe/London") };
};

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

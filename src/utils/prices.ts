/**
 * Parse a price string like "US$18.00", "1,750", "ARS 1.250,50",
 * "~$22" into a number.
 *
 * The previous version stripped EVERY non-digit/non-`.` character —
 * so a LatAm-formatted "1,750" became "1.750" → 1.75, an off-by-
 * 1000x bug that made every upside% calculation against
 * thousands-comma-separated prices catastrophically wrong (a TP of
 * "1,750" against a "1,200" Last printed `+0%` when it should have
 * been `+45.8%`).
 *
 * The shape we need to handle:
 *
 *   - US convention  "1,750.25"  → 1750.25
 *   - LatAm/EU       "1.750,25"  → 1750.25
 *   - Plain          "18.5"      → 18.5
 *   - Currency/prefix "US$1,750" → 1750
 *   - Approximate    "~22"       → 22 (NOT 2.2 — leading `~` stripped)
 *
 * Heuristic: if the string has BOTH `,` and `.`, the rightmost one
 * is the decimal separator (true in both US and LatAm conventions);
 * the other character is a thousands separator and gets stripped.
 * If only one separator type is present and it appears once near
 * the end (2-3 digits after), it's a decimal; if it appears
 * multiple times OR with 3+ digits after, it's a thousands
 * separator.
 *
 * Returns null for empty / non-numeric / range strings like "TBD"
 * or "$18-22" (the dash makes the regex find two numbers; we'd
 * silently pick the first which is misleading — better to bail).
 */
export const parsePrice = (s: string | number | null | undefined): number | null => {
  if (s === null || s === undefined) return null;
  if (typeof s === "number") return Number.isFinite(s) ? s : null;
  const raw = s.toString().trim();
  if (!raw) return null;
  // Strip currency / approx / whitespace, keep digits + separators.
  let cleaned = raw.replace(/[^0-9.,-]/g, "");
  // A leading minus is fine; an internal dash means range — bail.
  if (cleaned.lastIndexOf("-") > 0) return null;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  if (hasComma && hasDot) {
    // Rightmost separator wins as the decimal; the other is
    // thousands.
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    if (lastComma > lastDot) {
      // LatAm: "1.750,25" — drop dots, swap comma to dot.
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      // US: "1,750.25" — drop commas.
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (hasComma) {
    // Only commas: heuristic — if the LAST comma is followed by
    // exactly 1 or 2 digits, it's a decimal ("18,5"). Otherwise
    // it's a thousands separator ("1,750", "1,750,250").
    const idx = cleaned.lastIndexOf(",");
    const tail = cleaned.slice(idx + 1);
    if (/^\d{1,2}$/.test(tail) && cleaned.match(/,/g)!.length === 1) {
      cleaned = cleaned.replace(",", ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  }
  // hasDot only: parseFloat handles natively.
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
};

export const calcUpside = (tp: string, last: string): number | null => {
  const t = parsePrice(tp);
  const l = parsePrice(last);
  if (!t || !l || l === 0) return null;
  return (t / l - 1) * 100;
};

export const fmtUpside = (tp: string, last: string): string => {
  const u = calcUpside(tp, last);
  if (u === null) return "";
  return u >= 0 ? `Upside +${u.toFixed(1)}%` : `Downside ${u.toFixed(1)}%`;
};

export const upsideColor = (tp: string, last: string): string => {
  const u = calcUpside(tp, last);
  if (u === null) return "#666";
  return u >= 0 ? "#27864a" : "#c0392b";
};

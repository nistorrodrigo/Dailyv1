import type { User } from "@supabase/supabase-js";

/**
 * Derive a human-readable display name for a Supabase user. Used as the
 * "From" name on outgoing emails so each analyst's name shows up in the
 * recipient's inbox instead of a generic "Latin Securities Daily" tag.
 *
 * Resolution order:
 *   1. `user.user_metadata.full_name` — set explicitly via Supabase signup
 *      or a profile-update flow. Wins when present and non-empty.
 *   2. Title-cased local part of the email — `rodrigo.nistor@…` becomes
 *      "Rodrigo Nistor". Splits on `.`, `_`, or `-` so common conventions
 *      all collapse to space-separated words.
 *
 * Returns an empty string only if the user has neither a metadata name
 * nor a usable email local-part — callers should treat that as a signal
 * to fall back to the system default ("Latin Securities Daily").
 */
export function displayNameFromUser(user: User): string {
  const meta = user.user_metadata?.full_name;
  if (typeof meta === "string" && meta.trim()) return meta.trim();

  const local = (user.email || "").split("@")[0] || "";
  if (!local) return "";

  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

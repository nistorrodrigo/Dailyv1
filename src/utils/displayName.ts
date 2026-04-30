import type { User } from "@supabase/supabase-js";

/**
 * Derive a human-readable display name from an email address. Title-cases
 * the local part using `.`, `_`, or `-` as word separators — so all of
 * `rodrigo.nistor@…`, `rodrigo_nistor@…`, `RODRIGO.NISTOR@…` collapse to
 * "Rodrigo Nistor".
 *
 * Used for:
 *   - The fallback path of {@link displayNameFromUser} (when Supabase
 *     metadata doesn't have a full_name)
 *   - Rendering `sent_by` strings in the Send History UI, where we only
 *     have the email string from the Supabase row, not the full User
 *
 * Returns "" if the email is empty/null/undefined or has no usable
 * local part. Callers should treat that as a signal to fall back.
 */
export function displayNameFromEmail(email: string | null | undefined): string {
  const local = (email || "").split("@")[0] || "";
  if (!local) return "";

  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Derive a human-readable display name for a Supabase user. Used as the
 * "From" name on outgoing emails so each analyst's name shows up in the
 * recipient's inbox instead of a generic "Latin Securities Daily" tag.
 *
 * Resolution order:
 *   1. `user.user_metadata.full_name` — set explicitly via Supabase signup
 *      or a profile-update flow. Wins when present and non-empty.
 *   2. {@link displayNameFromEmail} — title-cased local-part of the email.
 *
 * Returns an empty string only if the user has neither a metadata name
 * nor a usable email local-part — callers should treat that as a signal
 * to fall back to the system default ("Latin Securities Daily").
 */
export function displayNameFromUser(user: User): string {
  const meta = user.user_metadata?.full_name;
  if (typeof meta === "string" && meta.trim()) return meta.trim();
  return displayNameFromEmail(user.email);
}

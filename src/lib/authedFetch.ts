import { supabase } from "./supabase";

/**
 * Fetch wrapper that automatically attaches the current Supabase
 * session as `Authorization: Bearer <jwt>`. Use for any /api/* call
 * that the server gates with `requireAuth` — analytics, ai-draft,
 * send-email, etc.
 *
 * Falls through silently when no session exists (the request is sent
 * without the header). The server returns 401 in that case and the
 * caller surfaces a "log out and back in" message.
 *
 * Why a wrapper rather than inlining the session-grab everywhere:
 *
 *   - Reading the session is async and stateful — every endpoint that
 *     wants auth would otherwise duplicate the same getSession dance,
 *     and we'd inevitably forget the `Content-Type: application/json`
 *     default in one of them.
 *
 *   - When (not if) we add request signing, refresh-token retry, or a
 *     central error-toast on 401, this helper is the one place that
 *     needs to change. Without it, we'd have to update ten call sites.
 */
export async function authedFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});

  // Default to JSON unless the caller already set a Content-Type
  // (multipart uploads, etc.). Keeps every call site from repeating
  // `headers: { "Content-Type": "application/json" }`.
  if (!headers.has("Content-Type") && init.body && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) headers.set("Authorization", `Bearer ${token}`);
    } catch {
      // Non-fatal — fall through without the header. The server will
      // return 401 and the caller can prompt the user to re-auth.
    }
  }

  return fetch(input, { ...init, headers });
}

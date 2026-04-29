// SendGrid Marketing API helpers — wraps the /api/sendgrid-lists serverless function.
//
// The serverless endpoint has a 3-step protocol because SendGrid's contact
// export is async:
//   1. GET  /api/sendgrid-lists                  → all lists
//   2. GET  /api/sendgrid-lists?listId=X         → returns { exportId } (or contacts directly for tiny lists)
//   3. GET  /api/sendgrid-lists?exportId=Y       → poll until status === "ready"
//
// This module collapses all of that into:
//   - fetchSendGridLists()          — cached for 5 min
//   - fetchSendGridContacts(listId) — start export + poll until ready
//
// Both throw Error with a useful message on failure — wrap in try/catch and
// show err.message to the user.

export interface SendGridList {
  id: string;
  name: string;
  count: number;
}

export interface SendGridContact {
  email: string;
  name: string;
}

export interface FetchContactsOptions {
  /** Called with status updates suitable for showing in UI ("Starting export...", "Exporting 4737 contacts... (12s)"). */
  onProgress?: (msg: string) => void;
  /** Max polling attempts at 2s each. Default 30 = 60s. Bump for very large lists. */
  maxAttempts?: number;
  /** Polling interval in ms. Default 2000. */
  pollIntervalMs?: number;
  /** AbortSignal to cancel the operation. */
  signal?: AbortSignal;
}

interface ListsCacheEntry {
  lists: SendGridList[];
  fetchedAt: number;
}

const LISTS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let listsCache: ListsCacheEntry | null = null;

/**
 * Parse a fetch Response as JSON, with helpful errors when the server returned HTML
 * (e.g. running `vite dev` instead of `vercel dev` makes /api/* fall through to index.html).
 */
async function parseJsonOrThrow(resp: Response, label: string): Promise<unknown> {
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch {
    if (resp.status === 404) {
      throw new Error(
        `${label}: API route not found. If running locally, use \`vercel dev\` (not \`vite dev\`) — Vite alone doesn't serve /api/* serverless functions.`
      );
    }
    throw new Error(`${label}: non-JSON response (HTTP ${resp.status}). First 200 chars: ${text.slice(0, 200)}`);
  }
}

/**
 * Fetch all SendGrid lists. Cached for 5 minutes.
 * Pass `force = true` to bypass the cache (e.g. for a manual refresh button).
 */
export async function fetchSendGridLists(force = false): Promise<SendGridList[]> {
  if (!force && listsCache && Date.now() - listsCache.fetchedAt < LISTS_CACHE_TTL_MS) {
    return listsCache.lists;
  }

  const resp = await fetch("/api/sendgrid-lists");
  const data = (await parseJsonOrThrow(resp, "fetchSendGridLists")) as { ok?: boolean; lists?: SendGridList[]; error?: string };

  if (!resp.ok || !data.ok) {
    throw new Error(data.error || `fetchSendGridLists: HTTP ${resp.status}`);
  }

  const lists = data.lists || [];
  listsCache = { lists, fetchedAt: Date.now() };
  return lists;
}

/** Drop the in-memory cache so the next fetchSendGridLists() hits the server. */
export function invalidateSendGridListsCache(): void {
  listsCache = null;
}

/**
 * Start a SendGrid contact export for `listId` and poll until it's ready.
 * Reports progress via opts.onProgress so the UI can show "Exporting N contacts... (Xs)".
 */
export async function fetchSendGridContacts(
  listId: string,
  opts: FetchContactsOptions = {}
): Promise<SendGridContact[]> {
  const { onProgress, maxAttempts = 30, pollIntervalMs = 2000, signal } = opts;

  const checkAborted = () => {
    if (signal?.aborted) throw new Error("fetchSendGridContacts: aborted");
  };

  // Step 1: kick off export
  onProgress?.("Starting export...");
  checkAborted();
  const startResp = await fetch(`/api/sendgrid-lists?listId=${encodeURIComponent(listId)}`, { signal });
  const startData = (await parseJsonOrThrow(startResp, "fetchSendGridContacts(start)")) as {
    ok?: boolean;
    exportId?: string;
    contacts?: SendGridContact[];
    error?: string;
  };

  if (!startResp.ok || !startData.ok) {
    throw new Error(startData.error || `fetchSendGridContacts: HTTP ${startResp.status}`);
  }

  // Tiny lists may be returned synchronously — short-circuit.
  if (startData.contacts) return startData.contacts;

  if (!startData.exportId) {
    throw new Error("fetchSendGridContacts: server returned neither contacts nor exportId");
  }

  // Step 2: poll until ready
  const exportId = startData.exportId;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    checkAborted();
    onProgress?.(`Exporting contacts... (${attempt * (pollIntervalMs / 1000)}s)`);
    await new Promise((r) => setTimeout(r, pollIntervalMs));

    const pollResp = await fetch(`/api/sendgrid-lists?exportId=${encodeURIComponent(exportId)}`, { signal });
    const pollData = (await parseJsonOrThrow(pollResp, "fetchSendGridContacts(poll)")) as {
      ok?: boolean;
      status?: string;
      contacts?: SendGridContact[];
      error?: string;
    };

    if (pollData.status === "ready" && pollData.contacts) {
      return pollData.contacts;
    }
    if (pollData.status === "failure") {
      throw new Error("fetchSendGridContacts: SendGrid reported export failure");
    }
    if (!pollResp.ok || pollData.ok === false) {
      throw new Error(pollData.error || `fetchSendGridContacts(poll): HTTP ${pollResp.status}`);
    }
    // status is "pending" or similar — keep polling
  }

  const totalSeconds = (maxAttempts * pollIntervalMs) / 1000;
  throw new Error(`fetchSendGridContacts: export timed out after ${totalSeconds}s. For very large lists, raise maxAttempts.`);
}

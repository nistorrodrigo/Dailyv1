import { authedFetch } from "./authedFetch";

/** Best-effort metadata about a URL — every field optional because
 *  publishers vary wildly in what they expose. */
export interface LinkMeta {
  title?: string;
  author?: string;
  description?: string;
  siteName?: string;
}

/**
 * Call the server-side metadata extractor to read title / author /
 * description / site name from a URL. Returns `null` when the
 * upstream call failed for any reason — callers should leave the
 * analyst-typed fields alone rather than blanking them on a
 * transient network blip.
 *
 * Why server-side: browsers can't fetch arbitrary cross-origin URLs
 * and read the response body, even with permissive CORS — most
 * publishers don't set ACAO. The serverless function is also where
 * the SSRF / size / timeout safety nets live.
 *
 * Implementation note: the server-side code lives inside
 * /api/ai-draft.js as `mode: "link-meta"` rather than a dedicated
 * /api/link-meta.js — Vercel Hobby tier caps deployments at 12
 * serverless functions and we'd hit it. From the client's
 * perspective the contract is unchanged: POST a url, get back a
 * `{ok, title?, author?, ...}` shape.
 */
export async function fetchLinkMeta(url: string): Promise<LinkMeta | null> {
  if (!url || !url.trim()) return null;
  try {
    const resp = await authedFetch("/api/ai-draft", {
      method: "POST",
      body: JSON.stringify({ mode: "link-meta", url: url.trim() }),
    });
    const data = await resp.json();
    if (!data?.ok) return null;
    return {
      title: data.title || undefined,
      author: data.author || undefined,
      description: data.description || undefined,
      siteName: data.siteName || undefined,
    };
  } catch {
    return null;
  }
}

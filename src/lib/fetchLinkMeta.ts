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
 * Call the server-side /api/link-meta endpoint to extract title /
 * author / description / site name from a URL. Returns `null` when
 * the upstream call failed for any reason — callers should fall back
 * to leaving the analyst-typed fields alone rather than blanking
 * them on a transient network blip.
 *
 * Why server-side: browsers can't fetch arbitrary cross-origin URLs
 * and read the response body, even with permissive CORS — most
 * publishers don't set ACAO. The serverless function is also where
 * we enforce the SSRF / size / timeout safety nets, since those
 * shouldn't live in the editor.
 */
export async function fetchLinkMeta(url: string): Promise<LinkMeta | null> {
  if (!url || !url.trim()) return null;
  try {
    const resp = await authedFetch("/api/link-meta", {
      method: "POST",
      body: JSON.stringify({ url: url.trim() }),
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

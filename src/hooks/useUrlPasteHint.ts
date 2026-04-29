import { toast } from "../store/useToastStore";
import type { NewsLink } from "../types";

/**
 * URL detector. Looks for `https://...` or `http://...` substrings. Returns
 * the matched URLs in order, deduplicated. Strict enough that things like
 * "/api/foo" or "ftp://x" don't false-positive.
 */
const URL_RE = /https?:\/\/[^\s<>"'`]+/gi;

export function extractUrls(text: string): string[] {
  if (!text) return [];
  const matches = text.match(URL_RE) || [];
  // Dedupe while preserving order.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    // Trim trailing punctuation that often glues onto pasted URLs.
    const cleaned = m.replace(/[.,;:!?)\]]+$/, "");
    if (!seen.has(cleaned)) {
      seen.add(cleaned);
      out.push(cleaned);
    }
  }
  return out;
}

/**
 * Build a paste handler that, when a paste event includes a URL,
 * shows a toast with an "Add as news link" action that appends the URL(s)
 * to the supplied newsLinks array via `onAddLinks`.
 *
 * Doesn't intercept the paste itself — the URL still lands in the body
 * field, the toast is just a shortcut to *also* attach it as a Source.
 */
export function makeUrlPasteHandler(
  currentLinks: NewsLink[] | undefined,
  onAddLinks: (next: NewsLink[]) => void,
): (e: React.ClipboardEvent) => void {
  return (e) => {
    const pasted = e.clipboardData?.getData("text");
    if (!pasted) return;
    const urls = extractUrls(pasted);
    if (!urls.length) return;

    const existing = new Set((currentLinks || []).map((l) => l.url));
    const fresh = urls.filter((u) => !existing.has(u));
    if (!fresh.length) return;

    const label = fresh.length === 1
      ? `Pasted a link — add as Source?`
      : `Pasted ${fresh.length} links — add as Sources?`;

    toast.info(label, {
      durationMs: 8000,
      action: {
        label: "Add",
        onClick: () => {
          const additions: NewsLink[] = fresh.map((url) => ({ label: "", url }));
          onAddLinks([...(currentLinks || []), ...additions]);
          toast.success(`Added ${additions.length} link${additions.length === 1 ? "" : "s"} to Sources`);
        },
      },
    });
  };
}

import React, { useState } from "react";
import { fetchLinkMeta, type LinkMeta } from "../../lib/fetchLinkMeta";
import { toast } from "../../store/useToastStore";

/**
 * "Auto-fill from URL" button — fetches title/author/description from
 * the link the analyst pasted, and hands them back via `onFill` so
 * the parent can patch its editor fields.
 *
 * The parent decides what to overwrite. We pass the entire `LinkMeta`
 * payload and let the caller cherry-pick (typical pattern: only fill
 * a field when it's currently empty, so the analyst's manual edits
 * aren't clobbered). That keeps this component dumb — no knowledge
 * of which fields exist in the parent's row schema.
 *
 * Disabled when the URL is empty so the analyst doesn't fire off a
 * pointless server call. Loading-state spinner inline so the button
 * reads "Filling…" while the fetch is in flight (typical 600-1500ms).
 */
interface AutofillLinkBtnProps {
  url: string;
  onFill: (meta: LinkMeta) => void;
  /** Compact = icon-only style for tight grids; default shows a label. */
  compact?: boolean;
}

export default function AutofillLinkBtn({ url, onFill, compact = false }: AutofillLinkBtnProps): React.ReactElement {
  const [busy, setBusy] = useState(false);
  const trimmed = url?.trim() || "";
  const disabled = busy || !trimmed;

  const handleClick = async (): Promise<void> => {
    setBusy(true);
    try {
      const meta = await fetchLinkMeta(trimmed);
      if (!meta) {
        toast.error("Couldn't read that link — fill manually");
        return;
      }
      // Defer to the parent to decide what to overwrite. We only
      // surface a generic toast on success — the parent typically
      // shows nothing because the form fields visibly populate.
      const filled = [meta.title, meta.author, meta.description].filter(Boolean).length;
      if (filled === 0) {
        toast.info("Link parsed but no metadata found");
        return;
      }
      onFill(meta);
      toast.success(`Filled ${filled} field${filled === 1 ? "" : "s"} from the link`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={
        disabled && !busy
          ? "Paste a URL above first"
          : "Fetch title / author / description from this URL"
      }
      className="text-[10px] font-bold border-none cursor-pointer rounded px-2 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: "rgba(30,90,176,0.12)",
        color: "#1e5ab0",
        whiteSpace: "nowrap",
      }}
    >
      {busy ? "⟳ Filling…" : compact ? "⤓ Auto-fill" : "⤓ Auto-fill from URL"}
    </button>
  );
}

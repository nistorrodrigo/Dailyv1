import React from "react";
import { BRAND } from "../constants/brand";
import useUIStore from "../store/useUIStore";
import { fmtRelativeTime } from "../utils/dates";

/**
 * Cross-device sync conflict dialog.
 *
 * Surfaces when a focus-triggered refetch (see supabaseSync) finds
 * the server copy of the daily is newer than what's on screen AND
 * the analyst has unsaved local edits. Rather than silently picking
 * a winner — which is how edits quietly vanished before — we make
 * the analyst choose:
 *
 *   - "Use the other device's version" → discard local edits, load
 *     the server copy.
 *   - "Keep my version" → discard the server copy; the next autosave
 *     pushes the local edits and wins.
 *
 * Deliberately NOT dismissable by click-outside or Escape — a
 * conflict is a real fork in the data and needs an explicit
 * decision; an accidental dismiss would leave the sync watermark
 * stale and the autosave blocked.
 *
 * The resolver callbacks live on the `syncConflict` object (set by
 * supabaseSync) because they close over that module's sync
 * watermark — the modal is a pure view over them.
 */
export default function SyncConflictModal(): React.ReactElement | null {
  const conflict = useUIStore((s) => s.syncConflict);

  if (!conflict) return null;

  const editedAgo = conflict.serverUpdatedAt ? fmtRelativeTime(conflict.serverUpdatedAt) : "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-conflict-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 3500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: 8,
          maxWidth: 440,
          width: "100%",
          boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
          overflow: "hidden",
        }}
      >
        <div style={{ background: BRAND.navy, padding: "14px 20px" }}>
          <h2
            id="sync-conflict-title"
            style={{ color: "#fff", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, margin: 0 }}
          >
            Daily edited on another device
          </h2>
        </div>

        <div style={{ padding: "18px 20px" }}>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-primary)", margin: "0 0 8px" }}>
            The <strong>{conflict.serverDate}</strong> daily was changed on another device
            {editedAgo ? <> ({editedAgo})</> : null} while you have unsaved edits open here.
          </p>
          <p style={{ fontSize: 12, lineHeight: 1.55, color: "var(--text-muted)", margin: "0 0 16px" }}>
            Pick which version to keep — the other one is discarded. To merge by hand instead,
            choose "Keep my version" and copy the missing bits in from the History panel.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              onClick={conflict.onUseServer}
              style={{
                padding: "10px 14px",
                borderRadius: 6,
                border: "none",
                background: BRAND.navy,
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              Use the other device's version
              <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.75, marginTop: 2 }}>
                Loads the server copy. Your unsaved edits here are discarded.
              </div>
            </button>
            <button
              onClick={conflict.onKeepMine}
              style={{
                padding: "10px 14px",
                borderRadius: 6,
                border: "1px solid var(--border-input)",
                background: "transparent",
                color: "var(--text-primary)",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              Keep my version
              <div style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)", marginTop: 2 }}>
                Discards the other device's changes. Your next save overwrites them.
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

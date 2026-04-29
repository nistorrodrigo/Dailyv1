import React from "react";
import { BRAND } from "../constants/brand";
import useUIStore from "../store/useUIStore";
import { SHORTCUTS } from "../hooks/useKeyboardShortcuts";

/**
 * Modal listing every keyboard shortcut. Toggled with `?`, closed with
 * Esc or by clicking outside. The list is the single source of truth
 * exported from `useKeyboardShortcuts.ts`.
 */
export default function KeyboardShortcutsOverlay(): React.ReactElement | null {
  const open = useUIStore((s) => s.shortcutsOverlayOpen);
  const close = useUIStore((s) => s.setShortcutsOverlayOpen);

  if (!open) return null;

  return (
    <div
      onClick={() => close(false)}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 3000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-card)",
          borderRadius: 8,
          maxWidth: 500,
          width: "100%",
          maxHeight: "85vh",
          overflow: "auto",
          boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ background: BRAND.navy, padding: "14px 20px", borderTopLeftRadius: 8, borderTopRightRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
            Keyboard Shortcuts
          </span>
          <button
            onClick={() => close(false)}
            style={{ background: "transparent", border: "none", color: BRAND.sky, fontSize: 20, cursor: "pointer", padding: 0, lineHeight: 1 }}
            aria-label="Close"
          >
            {"×"}
          </button>
        </div>

        <div style={{ padding: "8px 0" }}>
          {SHORTCUTS.map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 20px",
                borderBottom: i < SHORTCUTS.length - 1 ? "1px solid var(--border-light)" : "none",
                fontSize: 13,
              }}
            >
              <span style={{ color: "var(--text-primary)" }}>{s.description}</span>
              <kbd
                style={{
                  background: "var(--bg-card-alt)",
                  border: "1px solid var(--border-input)",
                  borderRadius: 4,
                  padding: "3px 8px",
                  fontSize: 11,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  color: "var(--text-secondary)",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  marginLeft: 16,
                }}
              >
                {s.combo}
              </kbd>
            </div>
          ))}
        </div>

        <div style={{ padding: "12px 20px 16px", fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
          Press{" "}
          <kbd style={{ background: "var(--bg-card-alt)", border: "1px solid var(--border-input)", borderRadius: 3, padding: "1px 5px", fontSize: 10, fontFamily: "monospace" }}>Esc</kbd>
          {" "}or click outside to close
        </div>
      </div>
    </div>
  );
}

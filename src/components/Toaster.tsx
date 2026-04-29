import React from "react";
import useToastStore from "../store/useToastStore";

/**
 * Render container for toast notifications. Mount once near the app root.
 * Toasts are pushed with `toast.success(...)`, `toast.error(...)`,
 * `toast.info(...)` from anywhere; they auto-dismiss based on their
 * durationMs, or can be dismissed by clicking the X.
 */
export default function Toaster(): React.ReactElement {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 5000,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 380,
        pointerEvents: "none",
      }}
      aria-live="polite"
    >
      {toasts.map((t) => {
        const palette = COLORS[t.kind];
        return (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            style={{
              pointerEvents: "auto",
              background: palette.bg,
              color: palette.fg,
              border: `1px solid ${palette.border}`,
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              lineHeight: 1.45,
              fontFamily: "'Segoe UI', Calibri, Arial, sans-serif",
              boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              animation: "ls-toast-in 180ms ease",
            }}
          >
            <span style={{ flexShrink: 0, fontWeight: 700, lineHeight: 1.4 }}>{palette.icon}</span>
            <span style={{ flex: 1, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              style={{
                background: "transparent",
                border: "none",
                color: palette.fg,
                opacity: 0.6,
                cursor: "pointer",
                fontSize: 16,
                lineHeight: 1,
                padding: 0,
                marginTop: 1,
              }}
            >
              {"×"}
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes ls-toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

const COLORS = {
  success: { bg: "#f0faf4", fg: "#1a6e3c", border: "#bde5cb", icon: "✓" },
  error:   { bg: "#fdf2f2", fg: "#a4302a", border: "#f1b9b6", icon: "!" },
  info:    { bg: "#eef4fc", fg: "#1d4d8c", border: "#bcd2ee", icon: "i" },
};

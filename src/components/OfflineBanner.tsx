import React from "react";
import useOnlineStatus from "../hooks/useOnlineStatus";

/**
 * Slim banner that appears at the top of the page when the browser
 * reports `navigator.onLine === false`. Sticky so the user can't miss
 * it; auto-disappears the moment connectivity comes back.
 *
 * Important context: the app autosaves to Supabase. Without internet,
 * the autosave will fail and the user could keep typing for minutes
 * thinking everything's saved. This banner makes that state obvious.
 */
export default function OfflineBanner(): React.ReactElement | null {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="alert"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 4000,
        background: "#c0392b",
        color: "#fff",
        padding: "8px 16px",
        textAlign: "center",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: 0.3,
        boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
        fontFamily: "'Segoe UI', Calibri, Arial, sans-serif",
      }}
    >
      <span style={{ marginRight: 8 }}>⚠</span>
      You're offline — autosave is paused. Don't refresh until you reconnect.
    </div>
  );
}

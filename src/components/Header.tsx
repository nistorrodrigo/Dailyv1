import React, { useState, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { useStore } from "zustand";
import { BRAND, LOGO_WHITE_URL } from "../constants/brand";
import useDailyStore from "../store/useDailyStore";
import useUIStore from "../store/useUIStore";
import { toast } from "../store/useToastStore";
import { generateHTML } from "../utils/generateHTML";
import { generateBBG } from "../utils/generateBBG";
import { fmtEventDate } from "../utils/dates";
import { getDailyTextMetrics, readingTimeMinutes } from "../utils/textMetrics";
import HistoryPanel from "./HistoryPanel";
import TemplatesPanel from "./TemplatesPanel";
import EmailSendPanel from "./EmailSendPanel";
import DuplicateYesterdayBtn from "./DuplicateYesterdayBtn";
import DiffPanel from "./DiffPanel";
import SchedulePanel from "./SchedulePanel";
import { logout } from "./LoginGate";
import PresenceIndicator from "./PresenceIndicator";
import AIReviewPanel from "./AIReviewPanel";
import ContactsPanel from "./ContactsPanel";

type PanelName = "history" | "templates" | "email" | "diff" | "schedule" | "ai-review" | "contacts" | null;

function timeAgo(ts: number): string {
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

/**
 * Toolbar button. Defaults to a neutral transparent style; pass an `accent`
 * to tint the text/hover but keep the border + background uniform across
 * the toolbar. Pass `primary` for the prominent filled CTA (Send Email).
 */
interface TBProps {
  onClick: () => void;
  children: React.ReactNode;
  accent?: string;
  primary?: boolean;
  title?: string;
}

const TBtn = ({ onClick, children, accent, primary, title }: TBProps) => {
  const [hover, setHover] = useState(false);
  if (primary) {
    return (
      <button
        onClick={onClick}
        title={title}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          padding: "7px 18px",
          borderRadius: 6,
          border: "none",
          background: hover ? "#2868c8" : BRAND.blue,
          color: "#fff",
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          whiteSpace: "nowrap",
          boxShadow: hover ? "0 2px 6px rgba(30,90,176,0.4)" : "0 1px 3px rgba(30,90,176,0.25)",
          transition: "all 120ms ease",
        }}
      >
        {children}
      </button>
    );
  }
  const color = accent || "rgba(255,255,255,0.85)";
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "6px 12px",
        borderRadius: 6,
        border: "1px solid rgba(255,255,255,0.18)",
        background: hover ? "rgba(255,255,255,0.08)" : "transparent",
        color,
        fontSize: 10,
        fontWeight: 700,
        cursor: "pointer",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        whiteSpace: "nowrap",
        transition: "all 120ms ease",
      }}
    >
      {children}
    </button>
  );
};

const Divider = () => (
  <div style={{ width: 1, height: 22, background: "rgba(255,255,255,0.15)", margin: "0 4px" }} aria-hidden />
);

export default function Header(): React.ReactElement {
  const { copiedLabel, saveStatus, darkMode, lastSavedAt } = useUIStore(
    useShallow((s) => ({ copiedLabel: s.copiedLabel, saveStatus: s.saveStatus, darkMode: s.darkMode, lastSavedAt: s.lastSavedAt })),
  );
  const date = useDailyStore((s) => s.date);
  // Subscribe ONLY to the primitive total — the underlying selector returns
  // a fresh object on each call (memoized by WeakMap on state ref), so we
  // pluck the number out so zustand's Object.is comparison is bulletproof
  // against accidental re-render loops (React error #185).
  const totalWords = useDailyStore((s) => getDailyTextMetrics(s).total);
  const minutes = readingTimeMinutes(totalWords);
  const copyToClipboard = useUIStore((s) => s.copyToClipboard);
  const toggleDarkMode = useUIStore((s) => s.toggleDarkMode);
  const toggleShortcutsOverlay = useUIStore((s) => s.toggleShortcutsOverlay);
  const newDaily = useDailyStore((s) => s.newDaily);
  const [openPanel, setOpenPanel] = useState<PanelName>(null);

  // zundo's temporal store — subscribe so the Undo/Redo buttons enable/disable
  // reactively as the user edits or undoes.
  const canUndo = useStore(useDailyStore.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useDailyStore.temporal, (s) => s.futureStates.length > 0);
  const doUndo = () => { useDailyStore.temporal.getState().undo(); toast.info("Undone", 1500); };
  const doRedo = () => { useDailyStore.temporal.getState().redo(); toast.info("Redone", 1500); };

  const copyGenerated = useCallback(
    (type: "html" | "bbg") => {
      const state = useDailyStore.getState();
      const text = type === "html" ? generateHTML(state) : generateBBG(state);
      copyToClipboard(text, type);
    },
    [copyToClipboard],
  );

  const sendWhatsApp = () => {
    const state = useDailyStore.getState();
    const bbg = generateBBG(state);
    window.open("https://web.whatsapp.com/send?text=" + encodeURIComponent(bbg), "_blank");
  };

  return (
    <>
      <div
        className="header-content"
        style={{
          background: "var(--bg-header)",
          padding: "12px 22px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `3px solid ${BRAND.sky}`,
          gap: 16,
        }}
      >
        {/* Brand block */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <img src={LOGO_WHITE_URL} alt="Latin Securities" style={{ height: 34, width: "auto", flexShrink: 0 }} />
          <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.18)" }} aria-hidden />
          <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
            <span style={{ fontSize: 13, color: "#fff", fontWeight: 700, letterSpacing: 0.4, lineHeight: 1.1 }}>
              Argentina Daily
            </span>
            <span style={{ fontSize: 10, letterSpacing: 1.4, color: BRAND.sky, textTransform: "uppercase", fontWeight: 600 }}>
              {fmtEventDate(date) || "Daily Builder"}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="header-buttons" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "nowrap" }}>
          <PresenceIndicator />

          {/* Save status (no border, just text) */}
          {(saveStatus === "saved" || saveStatus === "idle") && lastSavedAt && (
            <span style={{ fontSize: 10, color: BRAND.green, fontWeight: 600, letterSpacing: 0.5, marginRight: 4 }}>
              {"✓"} Saved {timeAgo(lastSavedAt)}
            </span>
          )}
          {saveStatus === "saving" && (
            <span style={{ fontSize: 10, color: BRAND.orange, fontWeight: 600, letterSpacing: 0.5, marginRight: 4 }}>
              SAVING…
            </span>
          )}
          {saveStatus === "error" && (
            <span style={{ fontSize: 10, color: "#e74c3c", fontWeight: 600, marginRight: 4 }}>
              OFFLINE
            </span>
          )}

          {/* Word count + reading time */}
          {totalWords > 0 && (
            <span
              style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", fontWeight: 500, letterSpacing: 0.3, marginRight: 4 }}
              title={`${totalWords} words · ~${minutes} min read`}
            >
              {totalWords.toLocaleString()} words · {minutes}m
            </span>
          )}

          {/* Undo / Redo */}
          <button
            onClick={doUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            style={{
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 6,
              background: "transparent",
              color: canUndo ? "#fff" : "rgba(255,255,255,0.3)",
              fontSize: 14,
              padding: "4px 10px",
              cursor: canUndo ? "pointer" : "default",
              lineHeight: 1,
              transition: "all 120ms ease",
            }}
          >
            ↶
          </button>
          <button
            onClick={doRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
            aria-label="Redo"
            style={{
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 6,
              background: "transparent",
              color: canRedo ? "#fff" : "rgba(255,255,255,0.3)",
              fontSize: 14,
              padding: "4px 10px",
              cursor: canRedo ? "pointer" : "default",
              lineHeight: 1,
              transition: "all 120ms ease",
            }}
          >
            ↷
          </button>

          <Divider />

          {/* Output group: copy/share */}
          <TBtn onClick={() => copyGenerated("html")} accent={BRAND.sky} title="Copy HTML email body">
            {copiedLabel === "html" ? "✓ Copied" : "Copy HTML"}
          </TBtn>
          <TBtn onClick={() => copyGenerated("bbg")} accent={BRAND.green} title="Copy Bloomberg-formatted text">
            {copiedLabel === "bbg" ? "✓ Copied" : "Copy BBG"}
          </TBtn>
          <TBtn onClick={sendWhatsApp} accent="#25D366" title="Open WhatsApp Web with BBG text">
            WhatsApp
          </TBtn>
          <TBtn onClick={() => import("../utils/exportPDF").then((m) => m.exportPDF())} accent="#e74c3c" title="Export as PDF">
            PDF
          </TBtn>

          <Divider />

          {/* Workflow group */}
          <TBtn onClick={() => setOpenPanel("contacts")} accent="#2ecc71">Contacts</TBtn>
          <TBtn onClick={() => setOpenPanel("templates")} accent={BRAND.teal}>Templates</TBtn>
          <TBtn onClick={() => setOpenPanel("history")} accent={BRAND.salmon}>History</TBtn>
          <TBtn onClick={() => setOpenPanel("diff")} accent="#9b59b6">Diff</TBtn>
          <TBtn onClick={() => setOpenPanel("schedule")} accent="#e67e22">Schedule</TBtn>
          <TBtn onClick={() => setOpenPanel("ai-review")} accent="#8b5cf6">AI Review</TBtn>

          <Divider />

          {/* State group */}
          <DuplicateYesterdayBtn />
          <TBtn onClick={newDaily} accent={BRAND.orange}>New Daily</TBtn>

          <Divider />

          {/* Primary CTA */}
          <TBtn onClick={() => setOpenPanel("email")} primary>Send Email</TBtn>

          <Divider />

          {/* Utilities */}
          <button
            onClick={toggleShortcutsOverlay}
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
            style={{
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 6,
              background: "transparent",
              color: "#fff",
              fontSize: 13,
              padding: "5px 10px",
              cursor: "pointer",
              lineHeight: 1,
              fontWeight: 700,
            }}
          >
            ?
          </button>
          <button
            onClick={toggleDarkMode}
            title={darkMode ? "Switch to light mode (Ctrl+D)" : "Switch to dark mode (Ctrl+D)"}
            style={{
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 6,
              background: "transparent",
              color: "#fff",
              fontSize: 14,
              padding: "5px 10px",
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            {darkMode ? "☀" : "☾"}
          </button>
          <TBtn onClick={logout} title="Log out">Logout</TBtn>
        </div>
      </div>
      <HistoryPanel open={openPanel === "history"} onClose={() => setOpenPanel(null)} />
      <TemplatesPanel open={openPanel === "templates"} onClose={() => setOpenPanel(null)} />
      <EmailSendPanel open={openPanel === "email"} onClose={() => setOpenPanel(null)} />
      <DiffPanel open={openPanel === "diff"} onClose={() => setOpenPanel(null)} />
      <SchedulePanel open={openPanel === "schedule"} onClose={() => setOpenPanel(null)} />
      <AIReviewPanel open={openPanel === "ai-review"} onClose={() => setOpenPanel(null)} />
      <ContactsPanel open={openPanel === "contacts"} onClose={() => setOpenPanel(null)} />
    </>
  );
}

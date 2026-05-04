import React, { useState, useCallback, Suspense, lazy } from "react";
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
import EmailSendPanel from "./EmailSendPanel";
import ContactsPanel from "./ContactsPanel";
import DuplicateYesterdayBtn from "./DuplicateYesterdayBtn";
import { logout } from "./LoginGate";
import PresenceIndicator from "./PresenceIndicator";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useWorkflowProgress } from "../hooks/useWorkflowProgress";

// Lazy-load the panels that keep no cross-open state. The slide-in
// pattern is designed for "open, do one thing, close" — losing internal
// state between opens is acceptable, and deferring the JS until the
// first time the analyst clicks the corresponding button shaves
// ~30-40 KB off the initial bundle. EmailSendPanel and ContactsPanel
// stay eagerly imported because they keep imported-recipient lists
// across open/close cycles which would be costly to re-fetch.
const HistoryPanel = lazy(() => import("./HistoryPanel"));
const TemplatesPanel = lazy(() => import("./TemplatesPanel"));
const DiffPanel = lazy(() => import("./DiffPanel"));
const SchedulePanel = lazy(() => import("./SchedulePanel"));
const AIReviewPanel = lazy(() => import("./AIReviewPanel"));
const WorkflowPanel = lazy(() => import("./WorkflowPanel"));

type PanelName = "history" | "templates" | "email" | "diff" | "schedule" | "ai-review" | "contacts" | "workflow" | null;

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
  // Workflow progress chip — opens the WorkflowPanel side panel
  // when clicked. Updates live as the analyst fills in fields.
  const { doneCount, total: stepTotal, estimatedMinutesRemaining } = useWorkflowProgress();
  const workflowAllDone = doneCount === stepTotal;
  // Currently authenticated user (if Supabase is configured + logged in).
  const currentUser = useCurrentUser();
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
      {/* ───── Row 1: identity + ambient status ─────────────────── */}
      <div
        className="header-identity"
        style={{
          background: "var(--bg-header)",
          padding: "10px 22px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          rowGap: 8,
        }}
      >
        {/* Brand block — never shrinks, so the title is always readable. */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          <img src={LOGO_WHITE_URL} alt="Latin Securities" style={{ height: 34, width: "auto", flexShrink: 0 }} />
          <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.18)" }} aria-hidden />
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ fontSize: 13, color: "#fff", fontWeight: 700, letterSpacing: 0.4, lineHeight: 1.1 }}>
              Argentina Daily
            </span>
            <span style={{ fontSize: 10, letterSpacing: 1.4, color: BRAND.sky, textTransform: "uppercase", fontWeight: 600 }}>
              {fmtEventDate(date) || "Daily Builder"}
            </span>
          </div>
        </div>

        {/* Status group — separate space, can wrap below logo on narrow viewports. */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", rowGap: 6 }}>
          <PresenceIndicator />

          {/* Workflow progress chip — clickable, opens the WorkflowPanel
              checklist. Colour shifts: green when all steps done,
              amber when 1-2 left, sky when more outstanding. */}
          <button
            onClick={() => setOpenPanel("workflow")}
            title={
              workflowAllDone
                ? "All steps done — ready to send"
                : `${stepTotal - doneCount} steps left · ~${estimatedMinutesRemaining} min to ready`
            }
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 10px",
              borderRadius: 14,
              border: `1px solid ${workflowAllDone ? "rgba(26,122,58,0.5)" : "rgba(255,255,255,0.18)"}`,
              background: workflowAllDone
                ? "rgba(172,212,132,0.18)"
                : doneCount >= stepTotal - 2
                  ? "rgba(231,158,76,0.18)"
                  : "rgba(255,255,255,0.06)",
              color: workflowAllDone ? "#acd484" : doneCount >= stepTotal - 2 ? "#ffbe65" : "#fff",
              cursor: "pointer",
              whiteSpace: "nowrap",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: "uppercase",
            }}
          >
            <span style={{ fontSize: 11 }}>{workflowAllDone ? "✓" : "◔"}</span>
            <span>{doneCount}/{stepTotal} ready</span>
            {!workflowAllDone && estimatedMinutesRemaining > 0 && (
              <span style={{ fontWeight: 500, opacity: 0.8 }}>· ~{estimatedMinutesRemaining}m</span>
            )}
          </button>

          {(saveStatus === "saved" || saveStatus === "idle") && lastSavedAt && (
            <span style={{ fontSize: 10, color: BRAND.green, fontWeight: 600, letterSpacing: 0.5, whiteSpace: "nowrap" }}>
              {"✓"} Saved {timeAgo(lastSavedAt)}
            </span>
          )}
          {saveStatus === "saving" && (
            <span style={{ fontSize: 10, color: BRAND.orange, fontWeight: 600, letterSpacing: 0.5, whiteSpace: "nowrap" }}>
              SAVING…
            </span>
          )}
          {saveStatus === "error" && (
            <span style={{ fontSize: 10, color: "#e74c3c", fontWeight: 600, whiteSpace: "nowrap" }}>
              OFFLINE
            </span>
          )}

          {totalWords > 0 && (
            <span
              className="header-wordcount"
              style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", fontWeight: 500, letterSpacing: 0.3, whiteSpace: "nowrap" }}
              title={`${totalWords} words · ~${minutes} min read`}
            >
              {totalWords.toLocaleString()} words · {minutes}m
            </span>
          )}

          {/* Authenticated user chip — visible source of truth for "who am I
              about to send mail as". Shown only when there's a real session;
              forks running without Supabase don't see anything here. */}
          {currentUser && (
            <div
              title={`Signed in as ${currentUser.user.email}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 10px 3px 4px",
                borderRadius: 14,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                whiteSpace: "nowrap",
              }}
            >
              <span style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: BRAND.sky,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 700,
              }}>
                {(currentUser.user.email || "?").charAt(0).toUpperCase()}
              </span>
              <span
                className="header-user-chip-text"
                style={{ fontSize: 11, color: "#fff", fontWeight: 500 }}
              >
                {(currentUser.user.email || "").split("@")[0]}
              </span>
            </div>
          )}

          {/* Utilities live up here too — Help, dark mode, logout. */}
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

      {/* ───── Row 2: action toolbar ───────────────────────────── */}
      <div
        className="header-toolbar"
        style={{
          background: "var(--bg-header)",
          padding: "8px 22px 12px",
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
          rowGap: 8,
          borderBottom: `3px solid ${BRAND.sky}`,
        }}
      >
        <div className="header-buttons" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", rowGap: 8 }}>
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
        </div>
      </div>
      {/* Eager panels — keep state across open/close cycles. */}
      <EmailSendPanel open={openPanel === "email"} onClose={() => setOpenPanel(null)} />
      <ContactsPanel open={openPanel === "contacts"} onClose={() => setOpenPanel(null)} />

      {/* Lazy panels — only mount when actually opened. fallback={null}
          because the panel slide-in animation handles the visual
          "appearing" gracefully; an explicit spinner would feel
          janky for what's typically a sub-second download. */}
      <Suspense fallback={null}>
        {openPanel === "history" && <HistoryPanel open onClose={() => setOpenPanel(null)} />}
        {openPanel === "templates" && <TemplatesPanel open onClose={() => setOpenPanel(null)} />}
        {openPanel === "diff" && <DiffPanel open onClose={() => setOpenPanel(null)} />}
        {openPanel === "schedule" && <SchedulePanel open onClose={() => setOpenPanel(null)} />}
        {openPanel === "ai-review" && <AIReviewPanel open onClose={() => setOpenPanel(null)} />}
        {openPanel === "workflow" && <WorkflowPanel open onClose={() => setOpenPanel(null)} />}
      </Suspense>
    </>
  );
}

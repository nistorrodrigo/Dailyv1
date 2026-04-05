import { useState, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { BRAND, LOGO_WHITE_URL } from "../constants/brand";
import useDailyStore from "../store/useDailyStore";
import useUIStore from "../store/useUIStore";
import { generateHTML } from "../utils/generateHTML";
import { generateBBG } from "../utils/generateBBG";
import HistoryPanel from "./HistoryPanel";
import TemplatesPanel from "./TemplatesPanel";
import EmailSendPanel from "./EmailSendPanel";
import DuplicateYesterdayBtn from "./DuplicateYesterdayBtn";
import DiffPanel from "./DiffPanel";

const hBtn = (borderColor, textColor, bg = "transparent") => ({
  padding: "6px 14px", borderRadius: 6,
  border: bg === "transparent" ? `1px solid ${borderColor}` : "none",
  background: bg, color: textColor,
  fontSize: 10, fontWeight: 700, cursor: "pointer",
  textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap",
});

export default function Header() {
  const { copiedLabel, saveStatus, darkMode } = useUIStore(useShallow((s) => ({ copiedLabel: s.copiedLabel, saveStatus: s.saveStatus, darkMode: s.darkMode })));
  const copyToClipboard = useUIStore((s) => s.copyToClipboard);
  const toggleDarkMode = useUIStore((s) => s.toggleDarkMode);
  const newDaily = useDailyStore((s) => s.newDaily);
  const [openPanel, setOpenPanel] = useState(null); // "history" | "templates" | "email" | "diff" | null

  const copyGenerated = useCallback((type) => {
    const state = useDailyStore.getState();
    const text = type === "html" ? generateHTML(state) : generateBBG(state);
    copyToClipboard(text, type);
  }, [copyToClipboard]);

  return (
    <>
      <div className="header-content" style={{
        background: "var(--bg-header)", padding: "10px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: `3px solid ${BRAND.sky}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src={LOGO_WHITE_URL} alt="LS" style={{ height: 26 }} />
          <span className="header-logo-text" style={{
            fontSize: 10, letterSpacing: 1.2, color: BRAND.sky,
            textTransform: "uppercase", fontWeight: 600,
          }}>
            Daily Builder
          </span>
        </div>
        <div className="header-buttons" style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {saveStatus === "saved" && (
            <span className="save-indicator" style={{ fontSize: 10, color: BRAND.green, fontWeight: 600, letterSpacing: 0.5 }}>
              {"\u2713"} SAVED
            </span>
          )}
          {saveStatus === "saving" && (
            <span className="save-indicator" style={{ fontSize: 10, color: BRAND.orange, fontWeight: 600, letterSpacing: 0.5 }}>
              SAVING...
            </span>
          )}
          {saveStatus === "error" && (
            <span className="save-indicator" style={{ fontSize: 10, color: "#e74c3c", fontWeight: 600 }}>
              OFFLINE
            </span>
          )}

          {/* Dark mode toggle */}
          <button
            onClick={toggleDarkMode}
            style={{
              ...hBtn("transparent", "#fff", "transparent"),
              border: "none", fontSize: 16, padding: "4px 8px",
            }}
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? "\u2600" : "\u263E"}
          </button>

          <button onClick={() => setOpenPanel("templates")} style={hBtn(BRAND.teal, BRAND.teal)}>Templates</button>
          <button onClick={() => setOpenPanel("history")} style={hBtn(BRAND.salmon, BRAND.salmon)}>History</button>
          <button onClick={() => setOpenPanel("diff")} style={hBtn("#9b59b6", "#9b59b6")}>Diff</button>
          <DuplicateYesterdayBtn />
          <button onClick={newDaily} style={hBtn(BRAND.orange, BRAND.orange)}>New Daily</button>
          <button onClick={() => copyGenerated("html")} style={hBtn(BRAND.sky, BRAND.sky)}>
            {copiedLabel === "html" ? "\u2713 Copied!" : "Copy HTML"}
          </button>
          <button onClick={() => copyGenerated("bbg")} style={hBtn(BRAND.green, BRAND.green)}>
            {copiedLabel === "bbg" ? "\u2713 Copied!" : "Copy BBG"}
          </button>
          <button onClick={() => setOpenPanel("email")} style={hBtn("none", "#fff", BRAND.blue)}>
            Send Email
          </button>
        </div>
      </div>
      <HistoryPanel open={openPanel === "history"} onClose={() => setOpenPanel(null)} />
      <TemplatesPanel open={openPanel === "templates"} onClose={() => setOpenPanel(null)} />
      <EmailSendPanel open={openPanel === "email"} onClose={() => setOpenPanel(null)} />
      <DiffPanel open={openPanel === "diff"} onClose={() => setOpenPanel(null)} />
    </>
  );
}

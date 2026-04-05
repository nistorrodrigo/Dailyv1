import { useState } from "react";
import { BRAND, LOGO_WHITE_URL } from "../constants/brand";
import useDailyStore from "../store/useDailyStore";
import { generateHTML } from "../utils/generateHTML";
import { generateBBG } from "../utils/generateBBG";
import HistoryPanel from "./HistoryPanel";
import TemplatesPanel from "./TemplatesPanel";
import EmailSendPanel from "./EmailSendPanel";

export default function Header() {
  const s = useDailyStore();
  const copiedLabel = useDailyStore((s) => s.copiedLabel);
  const copyToClipboard = useDailyStore((s) => s.copyToClipboard);
  const newDaily = useDailyStore((s) => s.newDaily);
  const saveStatus = useDailyStore((s) => s.saveStatus);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const html = generateHTML(s);
  const bbg = generateBBG(s);

  return (
    <div style={{
      background: BRAND.navy, padding: "12px 24px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      borderBottom: `3px solid ${BRAND.sky}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <img src={LOGO_WHITE_URL} alt="LS" style={{ height: 28 }} />
        <div style={{
          fontSize: 10, letterSpacing: 1, color: BRAND.sky, textTransform: "uppercase",
        }}>
          Daily Builder
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {saveStatus === "saved" && (
          <span style={{ fontSize: 10, color: BRAND.green, fontWeight: 600, letterSpacing: 0.5 }}>
            {"\u2713"} SAVED
          </span>
        )}
        {saveStatus === "saving" && (
          <span style={{ fontSize: 10, color: BRAND.orange, fontWeight: 600, letterSpacing: 0.5 }}>
            SAVING...
          </span>
        )}
        <button
          onClick={() => setTemplatesOpen(true)}
          style={{
            padding: "7px 16px", borderRadius: 6,
            border: `1px solid ${BRAND.teal}`, background: "transparent",
            color: BRAND.teal, fontSize: 11, fontWeight: 700,
            cursor: "pointer", textTransform: "uppercase",
          }}
        >
          Templates
        </button>
        <button
          onClick={() => setHistoryOpen(true)}
          style={{
            padding: "7px 16px", borderRadius: 6,
            border: `1px solid ${BRAND.salmon}`, background: "transparent",
            color: BRAND.salmon, fontSize: 11, fontWeight: 700,
            cursor: "pointer", textTransform: "uppercase",
          }}
        >
          History
        </button>
        <button
          onClick={newDaily}
          style={{
            padding: "7px 16px", borderRadius: 6,
            border: `1px solid ${BRAND.orange}`, background: "transparent",
            color: BRAND.orange, fontSize: 11, fontWeight: 700,
            cursor: "pointer", textTransform: "uppercase",
          }}
        >
          New Daily
        </button>
        <button
          onClick={() => copyToClipboard(html, "html")}
          style={{
            padding: "7px 16px", borderRadius: 6,
            border: `1px solid ${BRAND.sky}`, background: "transparent",
            color: BRAND.sky, fontSize: 11, fontWeight: 700,
            cursor: "pointer", textTransform: "uppercase",
          }}
        >
          {copiedLabel === "html" ? "\u2713 Copied!" : "Copy HTML"}
        </button>
        <button
          onClick={() => copyToClipboard(bbg, "bbg")}
          style={{
            padding: "7px 16px", borderRadius: 6,
            border: `1px solid ${BRAND.green}`, background: "transparent",
            color: BRAND.green, fontSize: 11, fontWeight: 700,
            cursor: "pointer", textTransform: "uppercase",
          }}
        >
          {copiedLabel === "bbg" ? "\u2713 Copied!" : "Copy BBG"}
        </button>
        <button
          onClick={() => setEmailOpen(true)}
          style={{
            padding: "7px 16px", borderRadius: 6,
            border: "none", background: BRAND.blue,
            color: "#fff", fontSize: 11, fontWeight: 700,
            cursor: "pointer", textTransform: "uppercase",
          }}
        >
          Send Email
        </button>
      </div>
      <HistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />
      <TemplatesPanel open={templatesOpen} onClose={() => setTemplatesOpen(false)} />
      <EmailSendPanel open={emailOpen} onClose={() => setEmailOpen(false)} />
    </div>
  );
}

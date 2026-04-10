import { useRef, useState, useEffect, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { BRAND } from "../../constants/brand";
import useDailyStore from "../../store/useDailyStore";
import useUIStore from "../../store/useUIStore";
import { generateHTML } from "../../utils/generateHTML";
import { generateBBG } from "../../utils/generateBBG";

export default function PreviewTab() {
  const ref = useRef<HTMLIFrameElement>(null);
  const { previewMode, copiedLabel } = useUIStore(useShallow((s) => ({ previewMode: s.previewMode, copiedLabel: s.copiedLabel })));
  const setPreviewMode = useUIStore((s) => s.setPreviewMode);
  const copyToClipboard = useUIStore((s) => s.copyToClipboard);

  const [html, setHtml] = useState<string>("");
  const [bbg, setBbg] = useState<string>("");
  const [emailTemplate, setEmailTemplate] = useState<string>("formal");

  useEffect(() => {
    const state = useDailyStore.getState();
    setHtml(generateHTML(state, "full", emailTemplate));
    setBbg(generateBBG(state));
  }, [emailTemplate]);

  const handleCopy = useCallback(() => {
    const state = useDailyStore.getState();
    const text = previewMode === "html" ? generateHTML(state, "full", emailTemplate) : generateBBG(state);
    copyToClipboard(text, previewMode);
  }, [previewMode, emailTemplate, copyToClipboard]);

  const handleRefresh = useCallback(() => {
    const state = useDailyStore.getState();
    setHtml(generateHTML(state, "full", emailTemplate));
    setBbg(generateBBG(state));
  }, [emailTemplate]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {["html", "bbg"].map((m) => (
          <button
            key={m}
            onClick={() => setPreviewMode(m as "html" | "bbg")}
            style={{
              padding: "8px 20px", borderRadius: 6, border: "none",
              cursor: "pointer", fontSize: 12, fontWeight: 700,
              textTransform: "uppercase",
              background: previewMode === m ? "var(--brand-navy)" : "var(--bg-card-alt)",
              color: previewMode === m ? "#fff" : "var(--text-muted)",
            }}
          >
            {m === "html" ? "SendGrid HTML" : "Bloomberg Text"}
          </button>
        ))}
        <button
          onClick={handleRefresh}
          style={{
            padding: "8px 16px", borderRadius: 6, border: "1px solid var(--border-input)",
            background: "transparent", color: "var(--text-secondary)",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}
        >
          Refresh
        </button>
        {previewMode === "html" && (
          <div className="flex gap-1 ml-2">
            {[
              { key: "formal", label: "Formal" },
              { key: "flash", label: "Flash" },
              { key: "executive", label: "Executive" },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setEmailTemplate(t.key)}
                className={`px-2.5 py-1.5 rounded text-[10px] font-bold border-none cursor-pointer ${
                  emailTemplate === t.key ? "bg-navy text-white" : "bg-[var(--bg-card-alt)] text-[var(--text-muted)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={handleCopy}
          style={{
            padding: "8px 20px", borderRadius: 6,
            border: `2px solid ${BRAND.sky}`, background: "var(--brand-navy)",
            color: "#fff", fontSize: 12, fontWeight: 700,
            cursor: "pointer", textTransform: "uppercase",
          }}
        >
          {copiedLabel === previewMode ? "\u2713 Copied!" : `Copy ${previewMode === "html" ? "HTML" : "BBG"}`}
        </button>
      </div>
      {previewMode === "html" ? (
        <div style={{
          background: "#fff", borderRadius: 8, overflow: "hidden",
          boxShadow: "var(--shadow-panel)",
        }}>
          <iframe
            ref={ref}
            srcDoc={html}
            style={{ width: "100%", height: 800, border: "none" }}
            title="Preview"
          />
        </div>
      ) : (
        <div style={{
          background: "#1a1a2e", color: "#e0e0e0", padding: 24,
          borderRadius: 8, fontFamily: "'Courier New',monospace",
          fontSize: 12.5, lineHeight: 1.6, whiteSpace: "pre-wrap",
          maxHeight: 800, overflow: "auto",
        }}>
          {bbg}
        </div>
      )}
    </div>
  );
}

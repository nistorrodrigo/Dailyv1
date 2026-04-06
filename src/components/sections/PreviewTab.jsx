import { useRef, useState, useEffect, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { BRAND } from "../../constants/brand";
import useDailyStore from "../../store/useDailyStore";
import useUIStore from "../../store/useUIStore";
import { generateHTML } from "../../utils/generateHTML";
import { generateBBG } from "../../utils/generateBBG";

export default function PreviewTab() {
  const ref = useRef(null);
  const { previewMode, copiedLabel } = useUIStore(useShallow((s) => ({ previewMode: s.previewMode, copiedLabel: s.copiedLabel })));
  const setPreviewMode = useUIStore((s) => s.setPreviewMode);
  const copyToClipboard = useUIStore((s) => s.copyToClipboard);

  const [html, setHtml] = useState("");
  const [bbg, setBbg] = useState("");
  const [emailMode, setEmailMode] = useState("full"); // "full" | "toc" | "compact"

  // Generate on mount
  useEffect(() => {
    const state = useDailyStore.getState();
    setHtml(generateHTML(state, emailMode));
    setBbg(generateBBG(state));
  }, []);

  // Regenerate when mode changes
  useEffect(() => {
    const state = useDailyStore.getState();
    setHtml(generateHTML(state, emailMode));
  }, [emailMode]);

  const handleCopy = useCallback(() => {
    const state = useDailyStore.getState();
    const text = previewMode === "html" ? generateHTML(state, emailMode) : generateBBG(state);
    copyToClipboard(text, previewMode);
  }, [previewMode, emailMode, copyToClipboard]);

  const handleRefresh = useCallback(() => {
    const state = useDailyStore.getState();
    setHtml(generateHTML(state, emailMode));
    setBbg(generateBBG(state));
  }, [emailMode]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {["html", "bbg"].map((m) => (
          <button
            key={m}
            onClick={() => setPreviewMode(m)}
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
        <div style={{ flex: 1 }} />
        {previewMode === "html" && (
          <div style={{ display: "flex", gap: 4, marginRight: 8 }}>
            {[
              { key: "full", label: "Full" },
              { key: "toc", label: "TOC" },
              { key: "compact", label: "Compact" },
            ].map((m) => (
              <button
                key={m.key}
                onClick={() => setEmailMode(m.key)}
                style={{
                  padding: "6px 12px", borderRadius: 4, border: "none",
                  cursor: "pointer", fontSize: 10, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: 0.5,
                  background: emailMode === m.key ? "var(--brand-navy)" : "var(--bg-card-alt)",
                  color: emailMode === m.key ? "#fff" : "var(--text-muted)",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
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

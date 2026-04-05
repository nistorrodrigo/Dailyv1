import { useRef, useState, useEffect, useCallback } from "react";
import { BRAND } from "../../constants/brand";
import useDailyStore from "../../store/useDailyStore";
import { generateHTML } from "../../utils/generateHTML";
import { generateBBG } from "../../utils/generateBBG";

export default function PreviewTab() {
  const ref = useRef(null);
    const { previewMode, copiedLabel } = useDailyStore(useShallow((s) => ({ previewMode: s.previewMode, copiedLabel: s.copiedLabel })));
  const setPreviewMode = useDailyStore((s) => s.setPreviewMode);
    const copyToClipboard = useDailyStore((s) => s.copyToClipboard);

  const [html, setHtml] = useState("");
  const [bbg, setBbg] = useState("");

  // Generate on mount and when tab becomes visible
  useEffect(() => {
    const state = useDailyStore.getState();
    setHtml(generateHTML(state));
    setBbg(generateBBG(state));
  }, []);

  const handleCopy = useCallback(() => {
    // Regenerate fresh on copy
    const state = useDailyStore.getState();
    const text = pm === "html" ? generateHTML(state) : generateBBG(state);
    copyToClipboard(text, pm);
  }, [pm, copyToClipboard]);

  const handleRefresh = useCallback(() => {
    const state = useDailyStore.getState();
    setHtml(generateHTML(state));
    setBbg(generateBBG(state));
  }, []);

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
              background: pm === m ? "var(--brand-navy)" : "var(--bg-card-alt)",
              color: pm === m ? "#fff" : "var(--text-muted)",
            }}
          >
            {m === "html" ? "SendGrid HTML" : "Bloomberg Text"}
          </button>
        ))}
        <button
          onClick={handleRefresh}
          style={{
            padding: "8px 16px", borderRadius: 6, border: `1px solid var(--border-input)`,
            background: "transparent", color: "var(--text-secondary)",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}
        >
          Refresh
        </button>
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
          {copiedLabel === pm ? "\u2713 Copied!" : `Copy ${pm === "html" ? "HTML" : "BBG"}`}
        </button>
      </div>
      {pm === "html" ? (
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

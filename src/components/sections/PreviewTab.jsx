import { useRef } from "react";
import { BRAND } from "../../constants/brand";
import useDailyStore from "../../store/useDailyStore";
import { generateHTML } from "../../utils/generateHTML";
import { generateBBG } from "../../utils/generateBBG";

export default function PreviewTab() {
  const ref = useRef(null);
  const s = useDailyStore();
  const pm = useDailyStore((s) => s.previewMode);
  const setPreviewMode = useDailyStore((s) => s.setPreviewMode);
  const copiedLabel = useDailyStore((s) => s.copiedLabel);
  const copyToClipboard = useDailyStore((s) => s.copyToClipboard);

  const html = generateHTML(s);
  const bbg = generateBBG(s);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["html", "bbg"].map((m) => (
          <button
            key={m}
            onClick={() => setPreviewMode(m)}
            style={{
              padding: "8px 20px", borderRadius: 6, border: "none",
              cursor: "pointer", fontSize: 12, fontWeight: 700,
              textTransform: "uppercase",
              background: pm === m ? BRAND.navy : "#e4e8ed",
              color: pm === m ? "#fff" : "#666",
            }}
          >
            {m === "html" ? "SendGrid HTML" : "Bloomberg Text"}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => copyToClipboard(pm === "html" ? html : bbg, pm)}
          style={{
            padding: "8px 20px", borderRadius: 6,
            border: `2px solid ${BRAND.sky}`, background: BRAND.navy,
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
          boxShadow: "0 2px 12px rgba(0,0,57,0.1)",
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

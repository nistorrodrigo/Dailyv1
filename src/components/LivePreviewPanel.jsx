import { useState, useRef, useMemo } from "react";
import { BRAND } from "../constants/brand";
import useDailyStore from "../store/useDailyStore";
import { generateHTML } from "../utils/generateHTML";

export default function LivePreviewPanel({ children }) {
  const [showPreview, setShowPreview] = useState(false);
  const ref = useRef(null);
  const s = useDailyStore();
  const html = useMemo(() => generateHTML(s), [s]);

  if (!showPreview) {
    return (
      <div>
        <div style={{ textAlign: "right", padding: "0 20px", marginBottom: -8 }}>
          <button
            onClick={() => setShowPreview(true)}
            style={{
              padding: "5px 12px", borderRadius: 4, border: `1px solid ${BRAND.sky}`,
              background: "transparent", color: BRAND.sky, fontSize: 10,
              fontWeight: 700, cursor: "pointer", textTransform: "uppercase",
            }}
          >
            Show Live Preview
          </button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 0, minHeight: "calc(100vh - 100px)" }}>
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ textAlign: "right", padding: "12px 20px 0" }}>
          <button
            onClick={() => setShowPreview(false)}
            style={{
              padding: "5px 12px", borderRadius: 4, border: `1px solid ${BRAND.sky}`,
              background: BRAND.navy, color: "#fff", fontSize: 10,
              fontWeight: 700, cursor: "pointer", textTransform: "uppercase",
            }}
          >
            Hide Preview
          </button>
        </div>
        {children}
      </div>
      <div style={{
        width: 720, flexShrink: 0, borderLeft: `2px solid ${BRAND.sky}`,
        background: "#f0f2f5", overflow: "auto",
      }}>
        <div style={{
          padding: "8px 12px", background: BRAND.navy, fontSize: 10,
          fontWeight: 700, color: BRAND.sky, textTransform: "uppercase",
          letterSpacing: 1, textAlign: "center",
        }}>
          Live Preview
        </div>
        <iframe
          ref={ref}
          srcDoc={html}
          style={{ width: "100%", height: "calc(100% - 30px)", border: "none", background: "#fff" }}
          title="Live Preview"
        />
      </div>
    </div>
  );
}

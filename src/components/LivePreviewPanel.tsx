import React, { useState, useRef, useEffect, useCallback } from "react";
import { BRAND } from "../constants/brand";
import useDailyStore from "../store/useDailyStore";
import { generateHTML } from "../utils/generateHTML";

interface LivePreviewPanelProps {
  children: React.ReactNode;
}

export default function LivePreviewPanel({ children }: LivePreviewPanelProps): React.ReactElement {
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const ref = useRef<HTMLIFrameElement | null>(null);
  const [html, setHtml] = useState<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Only subscribe and generate when preview is visible, debounced
  useEffect(() => {
    if (!showPreview) return;

    const update = () => {
      const state = useDailyStore.getState();
      setHtml(generateHTML(state));
    };

    // Initial render
    update();

    // Subscribe with debounce
    const unsub = useDailyStore.subscribe(() => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(update, 500);
    });

    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [showPreview]);

  if (!showPreview) {
    return (
      <div>
        <div style={{ textAlign: "right", padding: "0 20px", marginBottom: -8 }}>
          <button
            onClick={() => setShowPreview(true)}
            style={{
              padding: "5px 12px", borderRadius: 4, border: `1px solid ${BRAND.sky}`,
              background: "transparent", color: "var(--brand-sky)", fontSize: 10,
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
              background: "var(--brand-navy)", color: "#fff", fontSize: 10,
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
        background: "var(--bg-page)", overflow: "auto",
      }}>
        <div style={{
          padding: "8px 12px", background: "var(--brand-navy)", fontSize: 10,
          fontWeight: 700, color: "var(--brand-sky)", textTransform: "uppercase",
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

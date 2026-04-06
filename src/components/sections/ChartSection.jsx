import { useShallow } from "zustand/react/shallow";
import { useRef } from "react";
import useDailyStore from "../../store/useDailyStore";
import { Card, Inp } from "../ui";
import { BRAND } from "../../constants/brand";

export default function ChartSection() {
    const { sections, chartImage } = useDailyStore(useShallow((s) => ({ sections: s.sections, chartImage: s.chartImage })));
    const setChartImage = useDailyStore((s) => s.setChartImage);
  const setField = useDailyStore((s) => s.setField);
  const fileRef = useRef();

  if (!sections.find((x) => x.key === "chart")?.on) return null;

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Compress image to max 680px width (email width) for smaller base64
    const img = new Image();
    img.onload = () => {
      const MAX_W = 680;
      let w = img.width, h = img.height;
      if (w > MAX_W) { h = Math.round(h * (MAX_W / w)); w = MAX_W; }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL("image/jpeg", 0.85);
      const sizeKB = Math.round(compressed.length * 0.75 / 1024);
      setChartImage({
        ...(chartImage || {}),
        base64: compressed,
        data: compressed,
        fileName: file.name,
        sizeKB,
      });
    };
    img.src = URL.createObjectURL(file);
  };

  const img = chartImage || {};

  return (
    <Card title="Chart of the Day" color={BRAND.navy}>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>
          Upload Image
        </label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          style={{ fontSize: 12 }}
        />
        {img.data && (
          <button
            onClick={() => setChartImage(null)}
            style={{
              marginLeft: 8, padding: "4px 10px", borderRadius: 4,
              border: "1px solid #c0392b", background: "transparent",
              color: "#c0392b", fontSize: 11, cursor: "pointer",
            }}
          >
            Remove
          </button>
        )}
      </div>

      <Inp
        label="Title"
        value={img.title || ""}
        onChange={(v) => setChartImage({ ...img, title: v })}
        placeholder="Chart title"
      />
      <Inp
        label="Caption"
        value={img.caption || ""}
        onChange={(v) => setChartImage({ ...img, caption: v })}
        placeholder="Source / description"
      />

      {img.data && (
        <div style={{ marginTop: 12, textAlign: "center" }}>
          <img
            src={img.data}
            alt={img.title || "Chart"}
            style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 6, border: "1px solid #e4e8ed" }}
          />
          {img.fileName && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              {img.fileName}{img.sizeKB ? ` (${img.sizeKB} KB)` : ""}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

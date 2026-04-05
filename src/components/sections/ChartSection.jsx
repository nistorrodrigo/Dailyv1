import { useRef } from "react";
import useDailyStore from "../../store/useDailyStore";
import { Card, Inp } from "../ui";
import { BRAND } from "../../constants/brand";

export default function ChartSection() {
  const sections = useDailyStore((s) => s.sections);
  const chartImage = useDailyStore((s) => s.chartImage);
  const setChartImage = useDailyStore((s) => s.setChartImage);
  const setField = useDailyStore((s) => s.setField);
  const fileRef = useRef();

  if (!sections.find((x) => x.key === "chart")?.on) return null;

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setChartImage({
        ...(chartImage || {}),
        data: ev.target.result,
        fileName: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  const img = chartImage || {};

  return (
    <Card title="Chart of the Day" color={BRAND.navy}>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>
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
            <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>{img.fileName}</div>
          )}
        </div>
      )}
    </Card>
  );
}

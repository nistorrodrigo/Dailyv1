import { BRAND } from "./constants/brand";
import useDailyStore from "./store/useDailyStore";
import Header from "./components/Header";
import EditorTab from "./components/sections/EditorTab";
import AnalystsTab from "./components/sections/AnalystsTab";
import PreviewTab from "./components/sections/PreviewTab";

export default function App() {
  const tab = useDailyStore((s) => s.tab);
  const setTab = useDailyStore((s) => s.setTab);

  const ts = (t) => ({
    padding: "10px 20px", cursor: "pointer", fontSize: 13, fontWeight: 700,
    letterSpacing: 0.5, textTransform: "uppercase", border: "none",
    borderBottom: tab === t ? `3px solid ${BRAND.sky}` : "3px solid transparent",
    background: tab === t ? BRAND.navy : "transparent",
    color: tab === t ? "#fff" : "#666", transition: "all 0.2s",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f0f2f5", fontFamily: "'Segoe UI',Calibri,Arial,sans-serif" }}>
      <Header />
      <div style={{ display: "flex", background: "#fff", borderBottom: "1px solid #e4e8ed" }}>
        <button onClick={() => setTab("edit")} style={ts("edit")}>Editor</button>
        <button onClick={() => setTab("analysts")} style={ts("analysts")}>Analysts</button>
        <button onClick={() => setTab("preview")} style={ts("preview")}>Preview</button>
      </div>
      {tab === "edit" && <EditorTab />}
      {tab === "analysts" && <AnalystsTab />}
      {tab === "preview" && <PreviewTab />}
    </div>
  );
}

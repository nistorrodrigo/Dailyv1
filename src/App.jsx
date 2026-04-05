import useUIStore from "./store/useUIStore";
import useKeyboardShortcuts from "./hooks/useKeyboardShortcuts";
import Header from "./components/Header";
import EditorTab from "./components/sections/EditorTab";
import AnalystsTab from "./components/sections/AnalystsTab";
import PreviewTab from "./components/sections/PreviewTab";

const tabCls = (active) =>
  `px-5 py-2.5 cursor-pointer text-[13px] font-bold tracking-wide uppercase border-none transition-all duration-200 ${
    active
      ? "border-b-3 border-sky bg-navy text-white"
      : "border-b-3 border-transparent bg-transparent text-[var(--text-muted)]"
  }`;

export default function App() {
  const tab = useUIStore((s) => s.tab);
  const setTab = useUIStore((s) => s.setTab);
  useKeyboardShortcuts();

  return (
    <div className="min-h-screen bg-[var(--bg-page)] font-sans">
      <Header />
      <div className="flex bg-[var(--bg-tab-bar)] border-b border-[var(--border-light)] max-md:justify-center">
        <button onClick={() => setTab("edit")} className={tabCls(tab === "edit")}>Editor</button>
        <button onClick={() => setTab("analysts")} className={tabCls(tab === "analysts")}>Analysts</button>
        <button onClick={() => setTab("preview")} className={tabCls(tab === "preview")}>Preview</button>
      </div>
      {tab === "edit" && <EditorTab />}
      {tab === "analysts" && <AnalystsTab />}
      {tab === "preview" && <PreviewTab />}
    </div>
  );
}

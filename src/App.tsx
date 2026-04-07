import useUIStore from "./store/useUIStore";
import useKeyboardShortcuts from "./hooks/useKeyboardShortcuts";
import type { UIState } from "./types";
import Header from "./components/Header";
import EditorTab from "./components/sections/EditorTab";
import AnalystsTab from "./components/sections/AnalystsTab";
import PreviewTab from "./components/sections/PreviewTab";
import DashboardTab from "./components/sections/DashboardTab";
import AIDraftTab from "./components/sections/AIDraftTab";
import EmailEditorTab from "./components/sections/EmailEditorTab";

const tabCls = (active: boolean): string =>
  `px-5 py-2.5 cursor-pointer text-[13px] font-bold tracking-wide uppercase border-none transition-all duration-200 ${
    active
      ? "border-b-3 border-sky bg-navy text-white"
      : "border-b-3 border-transparent bg-transparent text-[var(--text-muted)]"
  }`;

export default function App() {
  const tab: UIState["tab"] = useUIStore((s) => s.tab);
  const setTab = useUIStore((s) => s.setTab);
  useKeyboardShortcuts();

  return (
    <div className="min-h-screen bg-[var(--bg-page)] font-sans">
      <Header />
      <div className="flex bg-[var(--bg-tab-bar)] border-b border-[var(--border-light)] max-md:justify-center">
        <button onClick={() => setTab("edit")} className={tabCls(tab === "edit")}>Editor</button>
        <button onClick={() => setTab("analysts")} className={tabCls(tab === "analysts")}>Analysts</button>
        <button onClick={() => setTab("ai")} className={tabCls(tab === "ai")}>AI Draft</button>
        <button onClick={() => setTab("preview")} className={tabCls(tab === "preview")}>Preview</button>
        <button onClick={() => setTab("email-editor")} className={tabCls(tab === "email-editor")}>HTML Editor</button>
        <button onClick={() => setTab("dashboard")} className={tabCls(tab === "dashboard")}>Dashboard</button>
      </div>
      <div key={tab} className="page-enter">
        {tab === "edit" && <EditorTab />}
        {tab === "analysts" && <AnalystsTab />}
        {tab === "ai" && <AIDraftTab />}
        {tab === "preview" && <PreviewTab />}
        {tab === "email-editor" && <EmailEditorTab />}
        {tab === "dashboard" && <DashboardTab />}
      </div>
    </div>
  );
}

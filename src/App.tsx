import { Suspense, lazy } from "react";
import useUIStore from "./store/useUIStore";
import useKeyboardShortcuts from "./hooks/useKeyboardShortcuts";
import useUnsavedChangesGuard from "./hooks/useUnsavedChangesGuard";
import { useStepTimingsTracker } from "./hooks/useStepTimingsTracker";
import { useSectionCatalogueSync } from "./hooks/useSectionCatalogueSync";
import { useAutoSnapshot } from "./hooks/useAutoSnapshot";
import type { UIState } from "./types";
import Header from "./components/Header";
import Toaster from "./components/Toaster";
import KeyboardShortcutsOverlay from "./components/KeyboardShortcutsOverlay";
import OfflineBanner from "./components/OfflineBanner";
import EditorTab from "./components/sections/EditorTab";

// Lazy-load every tab except the Editor (the default landing). The
// Editor is the only tab that's >90 % of analyst time so eager-loading
// it keeps the first paint instant; the others load on demand the
// first time the analyst clicks their tab button. Net effect on the
// initial bundle: ~40-60 KB shifted out of the index chunk into
// per-tab chunks Vite emits automatically.
const AnalystsTab = lazy(() => import("./components/sections/AnalystsTab"));
const PreviewTab = lazy(() => import("./components/sections/PreviewTab"));
const DashboardTab = lazy(() => import("./components/sections/DashboardTab"));
const AIDraftTab = lazy(() => import("./components/sections/AIDraftTab"));
const EmailEditorTab = lazy(() => import("./components/sections/EmailEditorTab"));

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
  useUnsavedChangesGuard();
  // Patches up `sections` after persist rehydrates with a stale
  // (pre-catalogue-update) shape. Runs once on mount and is a no-op
  // when the array is already current. See the hook header for why
  // this isn't redundant with the persist `migrate` callback.
  useSectionCatalogueSync();
  // Records every workflow step's pending → done duration to the
  // persistent timings store. Mounted at App level (not inside the
  // chip / panel) so each transition is recorded exactly once,
  // regardless of which surfaces happen to be reading workflow
  // progress at the same time.
  useStepTimingsTracker();
  // Background snapshot writer — every 5 minutes, if there have
  // been edits, captures the current state into the rollback log
  // (`daily_versions`). Surfaces in the History panel so the
  // analyst can revert an aggressive edit without losing the rest
  // of the session's work.
  useAutoSnapshot();

  return (
    <div className="min-h-screen bg-[var(--bg-page)] font-sans">
      <OfflineBanner />
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
        <Suspense fallback={<div className="text-center py-20 text-[var(--text-muted)]">Loading…</div>}>
          {tab === "analysts" && <AnalystsTab />}
          {tab === "ai" && <AIDraftTab />}
          {tab === "preview" && <PreviewTab />}
          {tab === "email-editor" && <EmailEditorTab />}
          {tab === "dashboard" && <DashboardTab />}
        </Suspense>
      </div>
      <Toaster />
      <KeyboardShortcutsOverlay />
    </div>
  );
}

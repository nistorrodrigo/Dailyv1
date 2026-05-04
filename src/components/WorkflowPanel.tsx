import React from "react";
import { BRAND } from "../constants/brand";
import useUIStore from "../store/useUIStore";
import { useWorkflowProgress, type WorkflowStep } from "../hooks/useWorkflowProgress";

interface WorkflowPanelProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Morning workflow checklist — the "what's left to do before I can
 * send" panel. Each item is derived live from store state via
 * `useWorkflowProgress`, so the analyst sees their progress update
 * as they fill in fields.
 *
 * Click a pending item → scrolls the editor to that section, switches
 * to the Editor tab if the analyst is somewhere else (Analysts, AI
 * Draft, etc.).
 *
 * Skipped items (e.g. Yesterday Recap when the section is toggled
 * off) render as "(skipped)" with a muted tone — they don't count
 * as failure, just as conscious decisions.
 */
export default function WorkflowPanel({ open, onClose }: WorkflowPanelProps): React.ReactElement | null {
  const { steps, doneCount, total } = useWorkflowProgress();
  const setTab = useUIStore((s) => s.setTab);

  if (!open) return null;

  const allDone = doneCount === total;
  const pct = Math.round((doneCount / total) * 100);

  const goToStep = (step: WorkflowStep): void => {
    if (!step.anchor) return;
    // Switch to the Editor tab if the analyst is elsewhere — the
    // section anchors only exist when the editor is rendered.
    setTab("edit");
    // Defer to the next animation frame so the tab swap completes
    // (and the section is mounted) before scrollIntoView fires.
    requestAnimationFrame(() => {
      const el = document.getElementById(step.anchor!);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        // Brief highlight so the analyst's eye locks onto the right
        // section after the scroll.
        el.style.transition = "box-shadow 200ms ease";
        el.style.boxShadow = `0 0 0 3px ${BRAND.sky}`;
        setTimeout(() => {
          el.style.boxShadow = "";
        }, 1200);
      }
    });
  };

  return (
    <div
      className="fixed top-0 right-0 bottom-0 w-[400px] bg-[var(--bg-card)] shadow-[var(--shadow-panel)] z-[1000] flex flex-col panel-slide"
    >
      <div className="flex justify-between items-center px-5 py-4" style={{ background: BRAND.navy }}>
        <span className="text-white text-sm font-bold uppercase tracking-wider">Daily Workflow</span>
        <button onClick={onClose} className="bg-transparent border-none text-[var(--color-sky)] text-xl cursor-pointer">
          {"×"}
        </button>
      </div>

      <div className="px-5 py-4 border-b border-[var(--border-light)]" style={{ background: "var(--bg-card-alt)" }}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
            Progress
          </div>
          <div
            className="text-sm font-bold"
            style={{ color: allDone ? "#1a7a3a" : doneCount >= total - 2 ? "#c97a2c" : "var(--text-primary)" }}
          >
            {doneCount}/{total} {allDone && "✓"}
          </div>
        </div>
        <div className="w-full h-1.5 rounded-full bg-[var(--bg-input)] overflow-hidden">
          <div
            className="h-full transition-[width] duration-300"
            style={{
              width: `${pct}%`,
              background: allDone ? "#1a7a3a" : doneCount >= total - 2 ? "#c97a2c" : BRAND.sky,
            }}
          />
        </div>
        {allDone && (
          <div className="mt-2 text-[12px] font-bold text-green-700">
            ✓ Ready to send. Open the Send Email panel from the header.
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-3">
        {steps.map((step) => {
          const isSkipped = step.label.includes("(skipped)");
          return (
            <button
              key={step.id}
              onClick={() => goToStep(step)}
              disabled={!step.anchor}
              className="w-full text-left p-3 mb-2 rounded-md border bg-transparent flex items-start gap-3 cursor-pointer disabled:cursor-default hover:bg-[var(--bg-hover)]"
              style={{
                borderColor: step.done ? "var(--border-light)" : "rgba(231,158,76,0.4)",
                background: step.done ? "transparent" : "rgba(231,158,76,0.06)",
                opacity: isSkipped ? 0.6 : 1,
              }}
            >
              <span
                className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold mt-0.5"
                style={{
                  background: step.done
                    ? isSkipped
                      ? "var(--text-muted)"
                      : "#1a7a3a"
                    : "rgba(231,158,76,0.2)",
                  color: step.done ? "#fff" : "#c97a2c",
                  border: step.done ? "none" : "1px solid #c97a2c",
                }}
              >
                {step.done ? (isSkipped ? "—" : "✓") : "○"}
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className="text-[13px] font-semibold"
                  style={{ color: step.done ? "var(--text-secondary)" : "var(--text-primary)" }}
                >
                  {step.label}
                </div>
                {!step.done && step.hint && (
                  <div className="text-[11px] mt-1 leading-snug" style={{ color: "var(--text-muted)" }}>
                    {step.hint}
                  </div>
                )}
              </div>
              {step.anchor && !step.done && (
                <span className="flex-shrink-0 text-[10px] font-bold mt-1" style={{ color: BRAND.sky }}>
                  →
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="px-5 py-3 border-t border-[var(--border-light)] text-[10px] text-[var(--text-muted)] italic">
        Updates live as you edit. Click a pending item to jump to that section.
      </div>
    </div>
  );
}

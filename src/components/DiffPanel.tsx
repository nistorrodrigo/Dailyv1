import React, { useState, useEffect } from "react";
import { BRAND } from "../constants/brand";
import { loadDaily, listDailies } from "../lib/dailyApi";
import { supabase } from "../lib/supabase";
import useDailyStore from "../store/useDailyStore";
import { toast } from "../store/useToastStore";

interface DiffPanelProps {
  open: boolean;
  onClose: () => void;
}

interface DailyListItem {
  id: string;
  date: string;
}

interface FieldDiff {
  label: string;
  current?: string;
  previous?: string;
  added?: number;
  removed?: number;
  changed?: number;
}

function diffField(label: string, current: string, previous: string): FieldDiff | null {
  if (current === previous) return null;
  return { label, current: current || "(empty)", previous: previous || "(empty)" };
}

function diffArrayField(label: string, current: Record<string, unknown>[], previous: Record<string, unknown>[], key: string = "id"): FieldDiff | null {
  const added = current.filter((c) => !previous.find((p) => p[key] === c[key]));
  const removed = previous.filter((p) => !current.find((c) => c[key] === p[key]));
  const changed = current.filter((c) => {
    const p = previous.find((x) => x[key] === c[key]);
    return p && JSON.stringify(c) !== JSON.stringify(p);
  });
  if (!added.length && !removed.length && !changed.length) return null;
  return { label, added: added.length, removed: removed.length, changed: changed.length };
}

export default function DiffPanel({ open, onClose }: DiffPanelProps): React.ReactElement | null {
  const [dailies, setDailies] = useState<DailyListItem[]>([]);
  const [compareDate, setCompareDate] = useState<string>("");
  const [diffs, setDiffs] = useState<FieldDiff[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (open && supabase) {
      listDailies(10).then(setDailies);
    }
  }, [open]);

  const handleCompare = async (): Promise<void> => {
    if (!compareDate) return;
    setLoading(true);
    try {
      const prev = await loadDaily(compareDate);
      if (!prev?.state) { toast.info("No data for " + compareDate); return; }
      const current = useDailyStore.getState();
      const ps = prev.state;

      const results = [
        diffField("Summary Bar", current.summaryBar, ps.summaryBar),
        diffField("EQ Buyer", current.eqBuyer, ps.eqBuyer),
        diffField("EQ Seller", current.eqSeller, ps.eqSeller),
        diffField("FI Buyer", current.fiBuyer, ps.fiBuyer),
        diffField("FI Seller", current.fiSeller, ps.fiSeller),
        diffField("Macro Source", current.macroSource, ps.macroSource),
        diffArrayField("Macro Blocks", (current.macroBlocks || []) as unknown as Record<string, unknown>[], (ps.macroBlocks || []) as unknown as Record<string, unknown>[]),
        diffArrayField("Equity Picks", (current.equityPicks || []) as unknown as Record<string, unknown>[], (ps.equityPicks || []) as unknown as Record<string, unknown>[], "ticker"),
        diffArrayField("FI Ideas", (current.fiIdeas || []) as unknown as Record<string, unknown>[], (ps.fiIdeas || []) as unknown as Record<string, unknown>[], "idea"),
        diffArrayField("Corp Blocks", (current.corpBlocks || []) as unknown as Record<string, unknown>[], (ps.corpBlocks || []) as unknown as Record<string, unknown>[]),
        diffArrayField("Research Reports", (current.researchReports || []) as unknown as Record<string, unknown>[], (ps.researchReports || []) as unknown as Record<string, unknown>[]),
      ].filter(Boolean);

      // Check section toggles
      const sectionDiffs = current.sections
        .map((s) => {
          const prev = (ps.sections || []).find((x) => x.key === s.key);
          if (!prev) return { label: `Section: ${s.label}`, current: s.on ? "ON" : "OFF", previous: "NEW" };
          if (s.on !== prev.on) return { label: `Section: ${s.label}`, current: s.on ? "ON" : "OFF", previous: prev.on ? "ON" : "OFF" };
          return null;
        })
        .filter(Boolean);

      setDiffs([...results, ...sectionDiffs] as FieldDiff[]);
    } catch (err) {
      toast.error("Compare failed: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed top-0 right-0 bottom-0 w-[420px] bg-[var(--bg-card)] shadow-[var(--shadow-panel)] z-[1000] flex flex-col panel-slide">
      <div className="flex justify-between items-center px-5 py-4" style={{ background: BRAND.navy }}>
        <span className="text-white text-sm font-bold uppercase tracking-wider">Compare Dailies</span>
        <button onClick={onClose} className="bg-transparent border-none text-sky text-xl cursor-pointer">{"\u00D7"}</button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {!supabase && <p className="text-sm text-[var(--text-muted)] text-center p-5">Supabase required for diff.</p>}
        {supabase && (
          <>
            <div className="flex gap-2 mb-4">
              <select
                value={compareDate}
                onChange={(e) => setCompareDate(e.target.value)}
                className="themed-input flex-1 px-2 py-1.5 rounded border border-[var(--border-input)] text-sm bg-[var(--bg-input)] text-[var(--text-primary)]"
              >
                <option value="">Select date to compare...</option>
                {dailies.map((d) => (
                  <option key={d.id} value={d.date}>{d.date}</option>
                ))}
              </select>
              <button
                onClick={handleCompare}
                disabled={!compareDate || loading}
                className="px-4 py-1.5 rounded-md border-none bg-ls-blue text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {loading ? "..." : "Compare"}
              </button>
            </div>

            {diffs && diffs.length === 0 && (
              <p className="text-sm text-[var(--text-muted)] text-center py-4">No differences found.</p>
            )}

            {diffs && diffs.length > 0 && (
              <div className="space-y-2">
                {diffs.map((d, i) => (
                  <div key={i} className="p-3 rounded-md border border-[var(--border-light)] bg-[var(--bg-card-alt)]">
                    <div className="text-xs font-bold text-[var(--text-primary)] mb-1">{d.label}</div>
                    {d.current !== undefined && d.previous !== undefined && !d.added && (
                      <div className="text-xs space-y-0.5">
                        <div><span className="text-red-500 font-mono">- {String(d.previous).substring(0, 80)}</span></div>
                        <div><span className="text-green-500 font-mono">+ {String(d.current).substring(0, 80)}</span></div>
                      </div>
                    )}
                    {d.added !== undefined && (
                      <div className="text-xs text-[var(--text-secondary)]">
                        {d.added > 0 && <span className="text-green-500">+{d.added} added </span>}
                        {(d.removed ?? 0) > 0 && <span className="text-red-500">-{d.removed} removed </span>}
                        {(d.changed ?? 0) > 0 && <span className="text-amber-500">~{d.changed} changed</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { BRAND } from "../constants/brand";
import { listDailies, loadDaily, deleteDaily } from "../lib/dailyApi";
import { listVersions, loadVersion, saveVersion, deleteVersion, type VersionMeta } from "../lib/versionsApi";
import { supabase } from "../lib/supabase";
import useDailyStore from "../store/useDailyStore";
import type { DailyState } from "../types";
import { toast } from "../store/useToastStore";

interface HistoryPanelProps {
  open: boolean;
  onClose: () => void;
}

interface DailyListItem {
  id: string;
  date: string;
  updated_at: string;
  state?: DailyState;
}

type HistoryTab = "today" | "past";

export default function HistoryPanel({ open, onClose }: HistoryPanelProps): React.ReactElement | null {
  const [tab, setTab] = useState<HistoryTab>("today");
  const [dailies, setDailies] = useState<DailyListItem[]>([]);
  const [versions, setVersions] = useState<VersionMeta[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [savingSnapshot, setSavingSnapshot] = useState<boolean>(false);

  // Subscribe to the editor's current daily date so the
  // "Versions for today" header and refresh logic line up with
  // whatever the analyst is editing (renamed to avoid shadowing
  // the local `today` calendar-date in handleDuplicate below).
  const currentDate = useDailyStore((s) => s.date);

  // Fetch versions + dailies whenever the panel opens, the tab
  // switches, or the editor's date changes (rare — usually after
  // newDaily).
  useEffect(() => {
    if (!open || !supabase) return;
    setLoading(true);
    if (tab === "today") {
      listVersions(currentDate)
        .then(setVersions)
        .finally(() => setLoading(false));
    } else {
      listDailies(50)
        .then(setDailies)
        .finally(() => setLoading(false));
    }
  }, [open, tab, currentDate]);

  if (!open) return null;

  const handleLoad = async (date: string): Promise<void> => {
    if (!window.confirm(`Load daily from ${date}? Current unsaved changes will be lost.`)) return;
    try {
      const daily = await loadDaily(date);
      if (daily?.state) {
        useDailyStore.setState({ ...daily.state });
        onClose();
      }
    } catch (err) {
      toast.error("Failed to load: " + (err as Error).message);
    }
  };

  const handleRestoreVersion = async (version: VersionMeta): Promise<void> => {
    const stamp = new Date(version.created_at).toLocaleString();
    if (!window.confirm(`Restore version "${version.label || stamp}"? Current unsaved changes will be lost.`)) return;
    try {
      const full = await loadVersion(version.id);
      if (full?.state) {
        useDailyStore.setState({ ...full.state });
        toast.success(`Restored "${version.label || stamp}"`);
        onClose();
      } else {
        toast.error("Could not load that version");
      }
    } catch (err) {
      toast.error("Restore failed: " + (err as Error).message);
    }
  };

  const handleDeleteVersion = async (version: VersionMeta): Promise<void> => {
    const stamp = new Date(version.created_at).toLocaleString();
    if (!window.confirm(`Delete version "${version.label || stamp}"? This cannot be undone.`)) return;
    try {
      const ok = await deleteVersion(version.id);
      if (ok) {
        setVersions((vs) => vs.filter((v) => v.id !== version.id));
      } else {
        toast.error("Delete failed");
      }
    } catch (err) {
      toast.error("Delete failed: " + (err as Error).message);
    }
  };

  const handleSaveSnapshot = async (): Promise<void> => {
    const label = window.prompt("Label for this snapshot (optional):", "")?.trim();
    setSavingSnapshot(true);
    try {
      const state = useDailyStore.getState();
      const meta = await saveVersion(state.date, state, label || undefined);
      if (meta) {
        // Optimistically prepend so the analyst sees the row land
        // without waiting for a re-list round-trip.
        setVersions((vs) => [meta, ...vs]);
        toast.success(`Snapshot saved${label ? `: "${label}"` : ""}`);
      } else {
        toast.error("Snapshot failed — check the network tab");
      }
    } catch (err) {
      toast.error("Snapshot failed: " + (err as Error).message);
    } finally {
      setSavingSnapshot(false);
    }
  };

  const handleDuplicate = async (sourceDate: string): Promise<void> => {
    const today = new Date().toISOString().split("T")[0];
    if (!window.confirm(`Duplicate daily from ${sourceDate} as today's (${today})?`)) return;
    try {
      const source = await loadDaily(sourceDate);
      if (source?.state) {
        const prev = useDailyStore.getState();
        useDailyStore.setState({
          ...source.state,
          date: today,
          analysts: prev.analysts,
          signatures: prev.signatures,
        });
        onClose();
      }
    } catch (err) {
      toast.error("Failed to duplicate: " + (err as Error).message);
    }
  };

  const handleDelete = async (id: string, date: string): Promise<void> => {
    if (!window.confirm(`Delete daily from ${date}? This cannot be undone.`)) return;
    try {
      await deleteDaily(id);
      setDailies((d) => d.filter((x) => x.id !== id));
    } catch (err) {
      toast.error("Failed to delete: " + (err as Error).message);
    }
  };

  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0, width: 360,
      background: "var(--bg-card)", boxShadow: "var(--shadow-panel)",
      zIndex: 1000, display: "flex", flexDirection: "column", animation: "slideInRight 0.2s ease",
    }}>
      <div style={{
        background: BRAND.navy, padding: "16px 20px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ color: "#fff", fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
          Daily History
        </span>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: BRAND.sky,
          fontSize: 20, cursor: "pointer",
        }}>
          {"\u00D7"}
        </button>
      </div>
      {/* Tab strip — Today's versions vs. past dailies. The two
          views answer different questions: "undo this morning's
          aggressive edit" (today) vs. "what was last Friday's
          daily" (past). Sharing the same panel saves real estate. */}
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "1px solid var(--border-light)",
          background: "var(--bg-card-alt)",
        }}
      >
        {([
          { key: "today" as const, label: "Today's versions" },
          { key: "past" as const, label: "Past dailies" },
        ]).map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1,
              padding: "10px 12px",
              border: "none",
              borderBottom: tab === t.key ? `2px solid ${BRAND.blue}` : "2px solid transparent",
              background: "transparent",
              color: tab === t.key ? BRAND.blue : "var(--text-muted)",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {!supabase && (
          <p style={{ fontSize: 12, color: "#999", textAlign: "center", padding: 20 }}>
            Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable history.
          </p>
        )}
        {loading && <p style={{ fontSize: 12, color: "#666", textAlign: "center" }}>Loading...</p>}

        {/* Today's versions tab — manual snapshot button at the top
            then a chronological list. Versions are immutable rows
            in `daily_versions`; the live editor state writes to
            `dailies` separately via supabaseSync. */}
        {tab === "today" && supabase && (
          <>
            <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--border-light)" }}>
              <button
                onClick={handleSaveSnapshot}
                disabled={savingSnapshot}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: `1px solid ${BRAND.blue}`,
                  background: BRAND.blue,
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  cursor: savingSnapshot ? "not-allowed" : "pointer",
                  opacity: savingSnapshot ? 0.6 : 1,
                }}
              >
                {savingSnapshot ? "Saving…" : "+ Save snapshot now"}
              </button>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.4 }}>
                Auto-snapshots fire every 5 min when you've made edits.
                Manual snapshots above let you mark a "before X" rollback point.
              </div>
            </div>
            {!loading && versions.length === 0 && (
              <p style={{ fontSize: 12, color: "#999", textAlign: "center" }}>
                No versions for {currentDate} yet.
              </p>
            )}
            {versions.map((v) => (
              <div
                key={v.id}
                style={{
                  padding: 10,
                  marginBottom: 6,
                  borderRadius: 6,
                  border: "1px solid var(--border-light)",
                  background: "var(--bg-card-alt)",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>
                  {v.label || "(untitled)"}
                </div>
                <div style={{ fontSize: 10, color: "#999", marginBottom: 6 }}>
                  {new Date(v.created_at).toLocaleString()}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => handleRestoreVersion(v)}
                    style={{
                      padding: "3px 10px",
                      borderRadius: 4,
                      border: `1px solid ${BRAND.blue}`,
                      background: "transparent",
                      color: BRAND.blue,
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => handleDeleteVersion(v)}
                    style={{
                      padding: "3px 10px",
                      borderRadius: 4,
                      border: "1px solid #c0392b",
                      background: "transparent",
                      color: "#c0392b",
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === "past" && !loading && dailies.length === 0 && supabase && (
          <p style={{ fontSize: 12, color: "#999", textAlign: "center" }}>No saved dailies yet.</p>
        )}
        {tab === "past" && dailies.map((d) => (
          <div key={d.id} style={{
            padding: 12, marginBottom: 8, borderRadius: 6,
            border: "1px solid var(--border-light)", background: "var(--bg-card-alt)",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
              {d.date}
            </div>
            <div style={{ fontSize: 10, color: "#999", marginBottom: 8 }}>
              Updated: {new Date(d.updated_at).toLocaleString()}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => handleLoad(d.date)} style={{
                padding: "4px 10px", borderRadius: 4, border: `1px solid ${BRAND.blue}`,
                background: "transparent", color: BRAND.blue, fontSize: 10,
                fontWeight: 600, cursor: "pointer",
              }}>
                Load
              </button>
              <button onClick={() => handleDuplicate(d.date)} style={{
                padding: "4px 10px", borderRadius: 4, border: `1px solid ${BRAND.teal}`,
                background: "transparent", color: BRAND.teal, fontSize: 10,
                fontWeight: 600, cursor: "pointer",
              }}>
                Duplicate
              </button>
              <button onClick={() => handleDelete(d.id, d.date)} style={{
                padding: "4px 10px", borderRadius: 4, border: "1px solid #c0392b",
                background: "transparent", color: "#c0392b", fontSize: 10,
                fontWeight: 600, cursor: "pointer",
              }}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
